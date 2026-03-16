"""
Authentication dependencies - helpers for protecting routes
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from starlette.requests import Request
from utils.auth_helpers import verify_token
from database.db import get_db
from database.models import User
from typing import Optional

security = HTTPBearer()

async def get_current_user_id(
    credentials = Depends(security)
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


async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
) -> User:
    """Get current user object from database"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user
