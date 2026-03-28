from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Depends
from .auth import verify_token
from google import genai
from google.genai import types
import os
import time
import logging
from dotenv import load_dotenv
from typing import Optional

load_dotenv(override=True)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

logger = logging.getLogger(__name__)
router = APIRouter()

# Supported audio MIME types
SUPPORTED_MIME_TYPES = {
    "audio/webm": "audio/webm",
    "audio/ogg": "audio/ogg",
    "audio/wav": "audio/wav",
    "audio/x-wav": "audio/wav",
    "audio/mpeg": "audio/mp3",
    "audio/mp3": "audio/mp3",
    "audio/mp4": "audio/mp4",
    "audio/m4a": "audio/mp4",
}

LANGUAGE_PROMPTS = {
    "hi-en": "Listen to this doctor-patient conversation audio carefully. It is in Hinglish (a mix of Hindi and English). Provide a highly accurate, word-for-word text transcription. IMPORTANT: You MUST include speaker tags (diarization) for every line of dialogue and give them on new line each time . Use context and voice changes to differentiate between speakers. Format your output strictly like this: 'Doctor: <what the doctor said> then new line for Patient' and 'Patient: <what the patient said>'. Do not translate or output anything other than the transcribed text.",
    "hi": "Listen to this doctor-patient conversation audio carefully. It is in Hindi. Provide a highly accurate, word-for-word text transcription in Devanagari script. IMPORTANT: You MUST include speaker tags (diarization) for every line of dialogue. Use context and voice changes to differentiate between speakers. Format your output strictly like this: 'Doctor: <what the doctor said>' and 'Patient: <what the patient said>'. Do not translate or output anything other than the transcribed text.",
    "en": "Listen to this doctor-patient conversation audio carefully. It is in English. Provide a highly accurate, word-for-word text transcription. IMPORTANT: You MUST include speaker tags (diarization) for every line of dialogue. Use context and voice changes to differentiate between speakers. Format your output strictly like this: 'Doctor: <what the doctor said>' and 'Patient: <what the patient said>'. Do not output anything other than the transcribed text.",
}


@router.post("/")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Query("hi-en", description="Language hint: 'hi' (Hindi), 'en' (English), 'hi-en' (Hinglish)"),
    token: dict = Depends(verify_token)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Detect and validate MIME type
    content_type = file.content_type or "audio/webm"
    mime_type = SUPPORTED_MIME_TYPES.get(content_type, "audio/webm")
    logger.info(f"Received audio file: {file.filename}, content_type={content_type}, resolved_mime={mime_type}")

    # Validate language parameter
    if language not in LANGUAGE_PROMPTS:
        language = "hi-en"
    prompt = LANGUAGE_PROMPTS[language]

    temp_file_path = f"temp_{file.filename}"
    try:
        content = await file.read()
        file_size_kb = len(content) / 1024
        logger.info(f"Audio file size: {file_size_kb:.1f} KB")

        with open(temp_file_path, 'wb') as out_file:
            out_file.write(content)

        audio_part = types.Part.from_bytes(data=content, mime_type=mime_type)

        # Generate transcript using Gemini
        start_time = time.time()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, audio_part],
        )
        transcription_time_ms = int((time.time() - start_time) * 1000)

        logger.info(f"Transcription completed in {transcription_time_ms}ms")

        return {
            "transcript": response.text,
            "transcription_time_ms": transcription_time_ms,
            "language": language,
            "audio_size_kb": round(file_size_kb, 1),
        }

    except Exception as e:
        logger.error(f"Transcription failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

