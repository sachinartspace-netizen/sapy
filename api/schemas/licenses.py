"""
Pydantic request/response models for license management
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# REQUEST MODELS

class DeviceInfo(BaseModel):
    """Device information for generating device ID"""
    os: str = Field(..., description="Operating system (iOS/Android/macOS/Windows)")
    device_model: str = Field(..., description="Device model (e.g., iPhone 12, Samsung Galaxy)")
    device_id: str = Field(..., description="Hardware device ID")
    app_version: str = Field(..., description="App version (e.g., 1.0.0)")

class GenerateLicenseRequest(BaseModel):
    """Request to generate a license key"""
    device_info: DeviceInfo = Field(..., description="Device information")
    
    class Config:
        example = {
            "device_info": {
                "os": "iOS",
                "device_model": "iPhone 12",
                "device_id": "ABC123DEF456",
                "app_version": "1.0.0"
            }
        }

class ValidateLicenseRequest(BaseModel):
    """Request to validate a license key"""
    license_key: str = Field(..., description="License key (SAPY-XXXX-XXXX-XXXX-XXXX)")
    license_data: dict = Field(..., description="License data (from server)")
    signature: str = Field(..., description="Cryptographic signature (hex)")
    device_info: DeviceInfo = Field(..., description="Current device info")

class RevokeDeviceRequest(BaseModel):
    """Request to revoke a device's license"""
    device_id: str = Field(..., description="Device to revoke")
    reason: Optional[str] = Field(None, description="Reason for revocation")

# RESPONSE MODELS

class GenerateLicenseResponse(BaseModel):
    """License generation response"""
    license_key: str = Field(description="License key (SAPY-XXXX-XXXX-XXXX-XXXX)")
    device_id: str = Field(description="Device ID (SHA256 hash)")
    license_data: dict = Field(description="License data (JSON)")
    signature: str = Field(description="Cryptographic signature (hex)")
    public_key: str = Field(description="Public key for offline validation (PEM)")
    expires_at: datetime = Field(description="License expiry date")
    tier: str = Field(description="Subscription tier")
    message: str = "License generated successfully"

class ValidateLicenseResponse(BaseModel):
    """License validation response"""
    is_valid: bool = Field(description="Whether license is valid")
    reason: str = Field(description="Validation result message")
    device_id: str = Field(description="Device ID")
    tier: Optional[str] = Field(None, description="License tier if valid")
    expires_at: Optional[datetime] = Field(None, description="Expiry if valid")

class DeviceRegistration(BaseModel):
    """Registered device information"""
    device_id: str
    device_name: str
    device_os: str
    license_key: str
    expires_at: datetime
    created_at: datetime
    last_used: Optional[datetime]

class ListDevicesResponse(BaseModel):
    """List user's registered devices"""
    devices: list[DeviceRegistration]
    count: int

class RevokeDeviceResponse(BaseModel):
    """Device revocation response"""
    success: bool
    device_id: str
    message: str

class LicenseErrorResponse(BaseModel):
    """Error response"""
    error: str
    message: str
    status_code: int
