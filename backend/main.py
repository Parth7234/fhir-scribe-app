from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.transcription import router as transcription_router
from services.fhir_mapper import router as fhir_router
from services.fhir_validator import router as fhir_validator_router
import os
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ambient AI Scribe Backend",
    description="Mobile-first AI scribe that converts doctor-patient conversations into structured, FHIR-compliant clinical data.",
    version="1.0.0",
)

# CORS: Allow all origins since we use Bearer token auth (not cookies).
# Mobile apps (Capacitor) send origin "https://localhost" which isn't predictable,
# and Bearer tokens already validate the user regardless of origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    auth_header = request.headers.get("authorization", "")
    has_auth = "YES" if auth_header else "NO"
    if auth_header:
        logger.info(f"[MIDDLEWARE] {request.method} {request.url.path} — Auth header present (Bearer {auth_header[7:37]}...)")
    else:
        logger.warning(f"[MIDDLEWARE] {request.method} {request.url.path} — NO Authorization header!")
    response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration_ms}ms)")
    return response


app.include_router(transcription_router, prefix="/api/transcribe", tags=["Transcription"])
app.include_router(fhir_router, prefix="/api/fhir", tags=["FHIR"])
app.include_router(fhir_validator_router, prefix="/api/fhir", tags=["FHIR Validation"])


@app.get("/")
async def root():
    return {
        "message": "Ambient AI Scribe Backend is running.",
        "version": "1.0.0",
        "endpoints": {
            "transcribe": "/api/transcribe/",
            "fhir": "/api/fhir/",
            "fhir_validate": "/api/fhir/validate",
        }
    }


@app.get("/health")
async def health():
    return {"status": "ok"}

