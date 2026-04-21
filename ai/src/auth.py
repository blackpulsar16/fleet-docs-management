import os
import requests
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

OIDC_DISCOVERY_URL = os.getenv("OIDC_DISCOVERY_URL", "")
security = HTTPBearer()

_jwks_client = None

def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    
    if not OIDC_DISCOVERY_URL:
        return None

    try:
        discovery_url = OIDC_DISCOVERY_URL.rstrip('/') + "/.well-known/openid-configuration"
        resp = requests.get(discovery_url, timeout=10)
        resp.raise_for_status()
        jwks_uri = resp.json().get("jwks_uri")
        _jwks_client = PyJWKClient(jwks_uri)
        return _jwks_client
    except Exception as e:
        print(f"Error initializing JWKS client: {e}")
        return None

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency that enforces a valid Bearer Token from Authentik.
    """
    if not OIDC_DISCOVERY_URL:
        return {"sub": "dev-user", "name": "Dev User"}
        
    client = get_jwks_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OIDC provider is misconfigured or unreachable"
        )
        
    token = credentials.credentials
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False} 
        )
        return payload
    except jwt.exceptions.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
