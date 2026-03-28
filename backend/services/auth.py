from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt
from jwt.algorithms import ECAlgorithm
import httpx
import json
import os
import logging
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)
security = HTTPBearer()

# Supabase project URL for JWKS endpoint
_supabase_url = os.getenv("SUPABASE_URL", "")
_jwks_url = f"{_supabase_url}/auth/v1/.well-known/jwks.json"

# Fallback: HS256 JWT secret (for older Supabase projects using symmetric signing)
_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")

# Cache for ES256 public keys fetched from JWKS
_cached_keys: dict[str, any] = {}


def _fetch_jwks_keys() -> dict:
    """Fetch JWKS keys from Supabase and cache them.
    Uses httpx which handles SSL properly on macOS."""
    global _cached_keys
    if _cached_keys:
        return _cached_keys

    try:
        resp = httpx.get(_jwks_url, timeout=10)
        resp.raise_for_status()
        jwks = resp.json()
        for key_data in jwks.get("keys", []):
            kid = key_data.get("kid")
            if kid:
                # Convert JWK to PEM public key
                public_key = ECAlgorithm.from_jwk(json.dumps(key_data))
                _cached_keys[kid] = public_key
                logger.info(f"[AUTH] Cached JWKS key: kid={kid}")
        return _cached_keys
    except Exception as e:
        logger.error(f"[AUTH] Failed to fetch JWKS: {e}")
        return {}


# Pre-fetch keys at module load time
if _supabase_url:
    _fetch_jwks_keys()


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Verifies a Supabase JWT access token from the Authorization header.
    
    Supports both ES256 (asymmetric, newer Supabase projects) and 
    HS256 (symmetric, older projects) JWT algorithms.
    """
    token = credentials.credentials

    # Peek at the token header to determine the algorithm
    try:
        unverified_header = pyjwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")
        kid = unverified_header.get("kid")
        logger.info(f"[AUTH] Token algorithm: {alg}, kid: {kid}")
    except Exception as e:
        logger.error(f"[AUTH] Failed to read token header: {e}")
        raise HTTPException(status_code=401, detail="Invalid token format")

    try:
        if alg == "ES256":
            # Get the public key for this kid
            keys = _fetch_jwks_keys()
            if kid and kid in keys:
                public_key = keys[kid]
            elif keys:
                # Use the first available key
                public_key = next(iter(keys.values()))
            else:
                raise Exception("No JWKS keys available for ES256 verification")

            decoded = pyjwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            # Symmetric verification using JWT secret (HS256)
            decoded = pyjwt.decode(
                token,
                _jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )

        logger.info(f"[AUTH] Token verified for user: {decoded.get('sub')}")
        return {
            "uid": decoded.get("sub"),
            "email": decoded.get("email"),
            "role": decoded.get("role", "authenticated"),
            "user_metadata": decoded.get("user_metadata", {}),
        }
    except pyjwt.ExpiredSignatureError:
        logger.error("[AUTH] Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except pyjwt.InvalidTokenError as e:
        logger.error(f"[AUTH] JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        logger.error(f"[AUTH] Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
