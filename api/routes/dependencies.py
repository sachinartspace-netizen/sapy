"""
Authentication dependencies - helpers for protecting routes
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from utils.auth_helpers import verify_token
from typing import Optional

security = HTTPBearer()

async def get_current_user_id(
    credentials: HTTPAuthCredentials = Depends(security)
) -> int:
    """
    Extract and verify JWT token from request header
    
    Used as dependency in protected routes.
    
    Args:
        credentials: HTTP Bearer token from Authorization header
        
    Returns:
        User ID if token is valid
        
    Raises:
        HTTPException if token is invalid or expired
    """
    
    token = credentials.credentials
    
    # Verify token
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        return int(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )
