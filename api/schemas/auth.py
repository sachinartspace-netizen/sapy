"""
Pydantic request/response models for authentication
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# REQUEST MODELS (from client)

class GoogleAuthRequest(BaseModel):
    """Google OAuth callback request"""
    google_id: str = Field(..., description="Google user ID")
    email: str = Field(..., description="User email from Google")
    name: Optional[str] = Field(None, description="User name from Google")
    picture_url: Optional[str] = Field(None, description="Google profile picture")

class PhoneOTPRequestRequest(BaseModel):
    """Request OTP for phone login"""
    phone: str = Field(..., description="Phone number in E.164 format: +1234567890")

class PhoneOTPVerifyRequest(BaseModel):
    """Verify OTP and login"""
    phone: str = Field(..., description="Phone number in E.164 format")
    otp: str = Field(..., description="6-digit OTP sent via SMS")

class RefreshTokenRequest(BaseModel):
    """Refresh access token"""
    refresh_token: str = Field(..., description="Refresh token from login response")

class UpdateProfileRequest(BaseModel):
    """Update user profile"""
    name: Optional[str] = Field(None, description="Full name")
    country: Optional[str] = Field(None, description="ISO 2-letter country code (e.g., 'US', 'IN')")
    timezone: Optional[str] = Field(None, description="Timezone (e.g., 'America/New_York')")
    language: Optional[str] = Field(None, description="Language code (e.g., 'en', 'hi')")
    preferences: Optional[dict] = Field(None, description="Custom preferences JSON")

# RESPONSE MODELS (to client)

class LoginResponse(BaseModel):
    """Successful login response"""
    user_id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Seconds until token expires")
    message: str = "Login successful"

class PhoneOTPResponse(BaseModel):
    """OTP request response"""
    phone: str
    otp_sent: bool = True
    expires_in: int = Field(description="Seconds until OTP expires")
    message: str = "OTP sent to your phone"

class UserProfileResponse(BaseModel):
    """User profile response"""
    user_id: int
    email: Optional[str]
    phone: Optional[str]
    name: Optional[str]
    country: Optional[str]
    timezone: str
    language: str
    profile_image_url: Optional[str]
    created_at: datetime
    last_login: Optional[datetime]

class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    message: str
    status_code: int

class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool
    message: str
    data: Optional[dict] = None
