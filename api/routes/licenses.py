"""
License management routes - RSA-2048 encrypted device licensing
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import License, User, Subscription
from api.schemas.licenses import (
    GenerateLicenseRequest, GenerateLicenseResponse,
    ValidateLicenseRequest, ValidateLicenseResponse,
    RevokeDeviceRequest, RevokeDeviceResponse,
    ListDevicesResponse, DeviceRegistration
)
from api.routes.dependencies import get_current_user_id
from utils.license_generator import get_license_generator, LicenseGenerator
from datetime import datetime
import json
from typing import Optional

router = APIRouter()
license_gen = get_license_generator()

# ============================================================================
# LICENSE GENERATION
# ============================================================================

@router.post("/generate", response_model=GenerateLicenseResponse, tags=["Licenses"])
async def generate_license(
    request: GenerateLicenseRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Generate a license key for a device
    
    This creates a cryptographically signed license that:
    - Is tied to a specific device ID (can't transfer to other devices)
    - Includes subscription tier and expiry
    - Can be validated offline using the public key
    - Automatically expires based on subscription
    
    Args:
        request: Device information
        current_user_id: User ID from JWT token
        db: Database session
        
    Returns:
        GenerateLicenseResponse with license key, signature, and public key
    """
    
    try:
        # Get user
        user = db.query(User).filter(User.id == current_user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get user's current subscription
        subscription = db.query(Subscription).filter(
            Subscription.user_id == current_user_id,
            Subscription.status == "active"
        ).first()
        
        if not subscription:
            # Use FREE tier by default
            tier = "free"
            expiry_days = 365  # Free tier lasts 1 year
        else:
            tier = subscription.plan_tier
            
            # Calculate expiry based on subscription end date
            if subscription.end_date:
                days_remaining = (subscription.end_date - datetime.utcnow()).days
                expiry_days = max(days_remaining, 1)
            else:
                expiry_days = 365  # Default 1 year if no end date
        
        # Generate device ID from device info
        device_id = LicenseGenerator.hash_device_fingerprint(request.device_info.dict())
        
        # Generate license key
        license_key, signature, expiry_date = license_gen.generate_license(
            user_id=current_user_id,
            device_id=device_id,
            tier=tier,
            expiry_days=expiry_days
        )
        
        # Create license data (what will be returned to client)
        license_data = {
            "user_id": current_user_id,
            "device_id": device_id,
            "tier": tier,
            "issued_at": datetime.utcnow().isoformat(),
            "expires_at": expiry_date.isoformat(),
            "version": "1.0"
        }
        
        # Save license to database
        license_record = License(
            user_id=current_user_id,
            device_id=device_id,
            license_key=license_key,
            tier_id=tier,
            expiry_date=expiry_date,
            device_name=f"{request.device_info.device_os} - {request.device_info.device_model}",
            device_os=request.device_info.os,
            created_at=datetime.utcnow(),
            last_validated=None,
            is_revoked=False
        )
        
        db.add(license_record)
        db.commit()
        
        return GenerateLicenseResponse(
            license_key=license_key,
            device_id=device_id,
            license_data=license_data,
            signature=signature,
            public_key=license_gen.get_public_key_pem(),
            expires_at=expiry_date,
            tier=tier
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate license: {str(e)}"
        )

# ============================================================================
# LICENSE VALIDATION
# ============================================================================

@router.post("/validate", response_model=ValidateLicenseResponse, tags=["Licenses"])
async def validate_license(
    request: ValidateLicenseRequest,
    db: Session = Depends(get_db)
):
    """
    Validate a license key (offline capable)
    
    This endpoint can be called offline to verify a license.
    The cryptographic signature proves the license came from the server.
    
    Args:
        request: License validation data
        db: Database session (optional for offline mode)
        
    Returns:
        ValidateLicenseResponse with validation result
    """
    
    try:
        # Generate device ID from current device info
        current_device_id = LicenseGenerator.hash_device_fingerprint(
            request.device_info.dict()
        )
        
        # Validate license offline (using signature)
        is_valid, reason = license_gen.validate_license(
            request.license_data,
            request.signature,
            current_device_id
        )
        
        if is_valid:
            # Log validation attempt in database (if online)
            try:
                from database.models import LicenseValidationLog
                
                log_entry = LicenseValidationLog(
                    license_key=request.license_key,
                    device_id=current_device_id,
                    validation_result="valid",
                    attempted_at=datetime.utcnow()
                )
                
                db.add(log_entry)
                db.commit()
            except:
                pass  # Offline mode - validation log fails gracefully
        
        return ValidateLicenseResponse(
            is_valid=is_valid,
            reason=reason,
            device_id=current_device_id,
            tier=request.license_data.get("tier") if is_valid else None,
            expires_at=request.license_data.get("expires_at") if is_valid else None
        )
        
    except Exception as e:
        return ValidateLicenseResponse(
            is_valid=False,
            reason=f"Validation error: {str(e)}",
            device_id=current_device_id if 'current_device_id' in locals() else "unknown"
        )

# ============================================================================
# DEVICE MANAGEMENT
# ============================================================================

@router.get("/devices", response_model=ListDevicesResponse, tags=["Licenses"])
async def list_user_devices(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    List all devices registered for current user
    
    Returns all devices that have been issued licenses.
    Users can revoke devices from this list.
    
    Args:
        current_user_id: User ID from JWT token
        db: Database session
        
    Returns:
        ListDevicesResponse with list of devices
    """
    
    try:
        licenses = db.query(License).filter(
            License.user_id == current_user_id,
            License.is_revoked == False
        ).all()
        
        devices = []
        for lic in licenses:
            devices.append(DeviceRegistration(
                device_id=lic.device_id,
                device_name=lic.device_name or "Unknown Device",
                device_os=lic.device_os or "Unknown OS",
                license_key=lic.license_key,
                expires_at=lic.expiry_date,
                created_at=lic.created_at,
                last_used=lic.last_validated
            ))
        
        return ListDevicesResponse(
            devices=devices,
            count=len(devices)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list devices: {str(e)}"
        )

@router.delete("/devices/{device_id}", response_model=RevokeDeviceResponse, tags=["Licenses"])
async def revoke_device(
    device_id: str,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Revoke a device's license
    
    Removes access from a specific device. The device can still request
    a new license, but any existing license is invalidated.
    
    Args:
        device_id: Device to revoke
        current_user_id: User ID from JWT token
        db: Database session
        
    Returns:
        RevokeDeviceResponse with revocation status
    """
    
    try:
        # Find license for this device
        license_record = db.query(License).filter(
            License.user_id == current_user_id,
            License.device_id == device_id,
            License.is_revoked == False
        ).first()
        
        if not license_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found or already revoked"
            )
        
        # Revoke the license
        license_record.is_revoked = True
        db.commit()
        
        return RevokeDeviceResponse(
            success=True,
            device_id=device_id,
            message=f"Device '{license_record.device_name}' has been revoked"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke device: {str(e)}"
        )

# ============================================================================
# LICENSE INFO
# ============================================================================

@router.get("/info/{license_key}", response_model=dict, tags=["Licenses"])
async def get_license_info(
    license_key: str,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get information about a specific license
    
    Args:
        license_key: License key to look up
        current_user_id: User ID from JWT token
        db: Database session
        
    Returns:
        Dictionary with license information
    """
    
    try:
        license_record = db.query(License).filter(
            License.license_key == license_key,
            License.user_id == current_user_id
        ).first()
        
        if not license_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="License not found"
            )
        
        return {
            "license_key": license_record.license_key,
            "device_id": license_record.device_id,
            "device_name": license_record.device_name,
            "device_os": license_record.device_os,
            "tier": license_record.tier_id,
            "created_at": license_record.created_at,
            "expires_at": license_record.expiry_date,
            "last_validated": license_record.last_validated,
            "is_revoked": license_record.is_revoked
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get license info: {str(e)}"
        )
