import jwt
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verifies the Clerk JWT token from the Authorization header."""
    token = credentials.credentials
    try:
        # Get the unverified payload to find the issuer
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        issuer = unverified_payload.get("iss")
        if not issuer:
            raise HTTPException(status_code=401, detail="Missing issuer in token")
            
        # Fetch the public key from the issuer's JWKS endpoint
        jwks_url = f"{issuer}/.well-known/jwks.json"
        jwks_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Verify the token signature and issuer
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer
        )
        return payload
        
    except jwt.PyJWKClientError as e:
        print("Failed to fetch JWKS:", e)
        raise HTTPException(status_code=401, detail="Could not retrieve public keys")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        print("Invalid token:", e)
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except Exception as e:
        print("Auth error:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
