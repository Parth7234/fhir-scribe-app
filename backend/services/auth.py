import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()

# Initialize Firebase Admin SDK
# Uses GOOGLE_APPLICATION_CREDENTIALS env var or a local service account JSON
_firebase_initialized = False


def _init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        logger.info(f"Firebase Admin initialized with service account: {cred_path}")
    else:
        # Try default credentials (works on GCP)
        firebase_admin.initialize_app()
        logger.info("Firebase Admin initialized with default credentials")

    _firebase_initialized = True


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Verifies a Firebase ID token from the Authorization header."""
    _init_firebase()

    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        return {
            "uid": decoded["uid"],
            "email": decoded.get("email"),
            "name": decoded.get("name"),
            "email_verified": decoded.get("email_verified", False),
        }
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    except firebase_auth.InvalidIdTokenError as e:
        logger.error(f"Invalid Firebase token: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
