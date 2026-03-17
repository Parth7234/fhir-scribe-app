from fastapi import APIRouter, HTTPException, Depends
from .auth import verify_token
from pydantic import BaseModel
from typing import Any
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class FHIRBundleInput(BaseModel):
    bundle: dict[str, Any]


VALID_RESOURCE_TYPES = {
    "Patient", "Encounter", "Observation", "Condition",
    "MedicationRequest", "AllergyIntolerance", "Procedure",
    "DiagnosticReport", "Immunization", "CarePlan",
}

REQUIRED_FIELDS = {
    "Patient": ["resourceType"],
    "Encounter": ["resourceType", "status"],
    "Observation": ["resourceType", "status", "code"],
    "Condition": ["resourceType", "code"],
    "MedicationRequest": ["resourceType", "status", "intent", "medicationCodeableConcept"],
}


def validate_bundle(bundle: dict) -> dict:
    """Validate a FHIR R4 Bundle and return errors/warnings."""
    errors = []
    warnings = []
    resource_count = {}

    # Check Bundle structure
    if bundle.get("resourceType") != "Bundle":
        errors.append("Root resourceType must be 'Bundle'")

    bundle_type = bundle.get("type")
    if bundle_type not in ("collection", "transaction", "document", "message", "searchset"):
        warnings.append(f"Unexpected bundle type: '{bundle_type}'. Expected 'collection' or 'transaction'.")

    entries = bundle.get("entry", [])
    if not entries:
        warnings.append("Bundle has no entries")

    for i, entry in enumerate(entries):
        resource = entry.get("resource", {})
        res_type = resource.get("resourceType", "Unknown")

        # Count resources
        resource_count[res_type] = resource_count.get(res_type, 0) + 1

        # Check fullUrl
        if "fullUrl" not in entry:
            warnings.append(f"Entry[{i}] ({res_type}): missing 'fullUrl'")

        # Check resourceType validity
        if res_type not in VALID_RESOURCE_TYPES and res_type != "Unknown":
            warnings.append(f"Entry[{i}]: resourceType '{res_type}' is uncommon for clinical use")

        # Check required fields
        if res_type in REQUIRED_FIELDS:
            for field in REQUIRED_FIELDS[res_type]:
                if field not in resource:
                    errors.append(f"Entry[{i}] ({res_type}): missing required field '{field}'")

        # Check coding systems
        if res_type == "Condition":
            code = resource.get("code", {})
            codings = code.get("coding", [])
            has_standard = any(
                c.get("system") in (
                    "http://snomed.info/sct",
                    "http://hl7.org/fhir/sid/icd-10",
                    "http://hl7.org/fhir/sid/icd-10-cm",
                )
                for c in codings
            )
            if not has_standard and codings:
                warnings.append(f"Entry[{i}] (Condition): no SNOMED-CT or ICD-10 coding system found")

        if res_type == "Observation":
            code = resource.get("code", {})
            codings = code.get("coding", [])
            has_loinc = any(c.get("system") == "http://loinc.org" for c in codings)
            if not has_loinc and codings:
                warnings.append(f"Entry[{i}] (Observation): no LOINC coding system found")

        # Check references
        if res_type in ("Observation", "Condition", "MedicationRequest"):
            subject = resource.get("subject", {})
            if not subject.get("reference"):
                warnings.append(f"Entry[{i}] ({res_type}): missing subject reference to Patient")

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "resource_summary": resource_count,
        "total_entries": len(entries),
    }


@router.post("/validate")
async def validate_fhir_bundle(input_data: FHIRBundleInput, token: dict = Depends(verify_token)):
    """Validate a FHIR R4 Bundle for structural correctness and coding standards."""
    try:
        result = validate_bundle(input_data.bundle)
        logger.info(
            f"Validation: valid={result['is_valid']}, "
            f"errors={len(result['errors'])}, warnings={len(result['warnings'])}"
        )
        return result
    except Exception as e:
        logger.error(f"Validation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")
