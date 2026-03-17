from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
import os
import json
import time
import logging
from dotenv import load_dotenv

load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

logger = logging.getLogger(__name__)
router = APIRouter()


class TranscriptInput(BaseModel):
    transcript: str


FHIR_SYSTEM_PROMPT = """
You are a highly capable clinical AI assistant specializing in FHIR R4 data extraction.

Your task: receive a transcript of a doctor-patient conversation (which may be in Hinglish, Hindi, or English) and extract structured clinical data into a valid FHIR R4 Bundle.

RULES:
1. Output ONLY valid JSON representing a FHIR Bundle (resourceType: "Bundle", type: "collection").
2. Each entry must have a "fullUrl" (format: "urn:uuid:<uuid>") and a "resource" object.
3. Generate proper UUIDs for all resource IDs.
4. Use standard coding systems:
   - SNOMED CT (http://snomed.info/sct) for clinical findings & conditions
   - ICD-10 (http://hl7.org/fhir/sid/icd-10) for diagnoses
   - LOINC (http://loinc.org) for observations/vitals
   - RxNorm (http://www.nlm.nih.gov/research/umls/rxnorm) for medications
5. Include proper references between resources (e.g., Observation.subject → Patient).
6. Required resource types to extract (when applicable):
   - Patient (name, gender, approximate age if mentioned)
   - Encounter (status, class, period)
   - Observation (vitals: BP, temperature, pulse, SpO2, weight, etc.)
   - Condition (diagnoses, symptoms with severity)
   - MedicationRequest (drug name, dosage, frequency, route)
7. If no patient name is mentioned, use "Unknown Patient" as placeholder.
8. Do NOT include any explanatory text, markdown, or comments — pure JSON only.
"""

STRUCTURED_NOTES_PROMPT = """
You are a clinical documentation assistant. Given the following doctor-patient conversation transcript, generate structured clinical notes in JSON format.

Output a JSON object with these exact keys (use empty string "" if not mentioned):
{
  "chief_complaint": "Main reason for visit",
  "history_of_present_illness": "Detailed HPI",
  "vitals": [{"name": "...", "value": "...", "unit": "..."}],
  "examination_findings": "Physical exam findings",
  "diagnoses": [{"name": "...", "icd_code": "...", "severity": "..."}],
  "medications": [{"name": "...", "dosage": "...", "frequency": "...", "duration": "...", "route": "..."}],
  "follow_up": "Follow-up instructions",
  "advice": "Lifestyle/dietary advice given"
}

Output ONLY valid JSON. No markdown, no explanation.
"""


@router.post("/")
async def process_fhir(input_data: TranscriptInput):
    if not input_data.transcript or not input_data.transcript.strip():
        raise HTTPException(status_code=400, detail="No transcript provided")

    if len(input_data.transcript) > 50000:
        raise HTTPException(status_code=400, detail="Transcript too long (max 50,000 characters)")

    try:
        # --- Generate FHIR Bundle ---
        fhir_model = genai.GenerativeModel(
            'gemini-2.5-flash',
            system_instruction=FHIR_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.0,
                response_mime_type="application/json",
            )
        )

        fhir_start = time.time()
        fhir_response = fhir_model.generate_content(
            f"Transcript to process:\n{input_data.transcript}"
        )
        fhir_time_ms = int((time.time() - fhir_start) * 1000)

        fhir_content = fhir_response.text
        # Strip markdown fences just in case
        if fhir_content.startswith("```json"):
            fhir_content = fhir_content[7:]
        if fhir_content.startswith("```"):
            fhir_content = fhir_content[3:]
        if fhir_content.endswith("```"):
            fhir_content = fhir_content[:-3]

        fhir_bundle = json.loads(fhir_content.strip())
        logger.info(f"FHIR Bundle generated in {fhir_time_ms}ms with {len(fhir_bundle.get('entry', []))} entries")

        # --- Generate Structured Clinical Notes ---
        notes_model = genai.GenerativeModel(
            'gemini-2.5-flash',
            system_instruction=STRUCTURED_NOTES_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.0,
                response_mime_type="application/json",
            )
        )

        notes_start = time.time()
        notes_response = notes_model.generate_content(
            f"Transcript:\n{input_data.transcript}"
        )
        notes_time_ms = int((time.time() - notes_start) * 1000)

        notes_content = notes_response.text
        if notes_content.startswith("```json"):
            notes_content = notes_content[7:]
        if notes_content.startswith("```"):
            notes_content = notes_content[3:]
        if notes_content.endswith("```"):
            notes_content = notes_content[:-3]

        structured_notes = json.loads(notes_content.strip())
        logger.info(f"Structured notes generated in {notes_time_ms}ms")

        total_time_ms = fhir_time_ms + notes_time_ms

        return {
            "fhir_bundle": fhir_bundle,
            "structured_notes": structured_notes,
            "fhir_processing_time_ms": fhir_time_ms,
            "notes_processing_time_ms": notes_time_ms,
            "total_processing_time_ms": total_time_ms,
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse model output as JSON: {str(e)}"
        )
    except Exception as e:
        logger.error(f"FHIR processing failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
