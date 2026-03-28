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

# CORS: read allowed origins from env, fallback to allow-all for local dev
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if not _raw_origins or _raw_origins.strip() == "*":
    # Allow all origins (no credentials restriction)
    allowed_origins = ["*"]
    _allow_creds = False
else:
    allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_creds = True

logger.info(f"CORS allowed_origins={allowed_origins}, credentials={_allow_creds}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=_allow_creds,
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

