"""
Authentication routes - Google OAuth + Phone OTP
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import User, UserProfile
from api.schemas.auth import (
    GoogleAuthRequest, PhoneOTPRequestRequest, PhoneOTPVerifyRequest,
    RefreshTokenRequest, UpdateProfileRequest,
    LoginResponse, PhoneOTPResponse, UserProfileResponse, SuccessResponse
)
from utils.auth_helpers import (
    create_access_token, verify_token, generate_otp,
    is_valid_email, is_valid_phone
)
from api.routes.dependencies import get_current_user_id

load_dotenv()

router = APIRouter()

# In-memory OTP storage (production: use Redis)
# Format: {phone: {"otp": "123456", "created_at": datetime, "attempts": 0}}
otp_storage = {}
OTP_EXPIRE_MINUTES = 5
OTP_MAX_ATTEMPTS = 3

# ============================================================================
# GOOGLE OAUTH ENDPOINT
# ============================================================================

@router.post("/google", response_model=LoginResponse, tags=["Authentication"])
async def google_oauth(
    request: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """
    Google OAuth login endpoint
    
    Receives Google user info and creates/updates user in database.
    Returns JWT access token and refresh token.
    
    Args:
        request: Google OAuth data (google_id, email, name, picture_url)
        db: Database session
        
    Returns:
        LoginResponse with tokens and user info
    """
    
    # Validate email format
    if not is_valid_email(request.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    try:
        # Check if user exists with this Google ID
        user = db.query(User).filter(User.google_id == request.google_id).first()
        
        if user:
            # Existing user - update email if changed
            user.email = request.email
            user.last_login = datetime.utcnow()
        else:
            # New user - create account
            user = User(
                email=request.email,
                google_id=request.google_id,
                email_verified=True,  # Google emails are verified
                is_active=True,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow()
            )
            db.add(user)
            db.flush()  # Get user.id without committing
            
            # Create user profile with Google info
            profile = UserProfile(
                user_id=user.id,
                name=request.name,
                profile_image_url=request.picture_url,
                timezone="UTC",
                language="en",
                created_at=datetime.utcnow()
            )
            db.add(profile)
        
        db.commit()
        
        # Calculate token expiry
        expires_delta = timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", 1440)))
        expire_time = datetime.utcnow() + expires_delta
        
        # Create tokens
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_access_token(
            data={"sub": str(user.id), "type": "refresh"},
            expires_delta=timedelta(days=7)
        )
        
        return LoginResponse(
            user_id=user.id,
            email=user.email,
            name=user.email.split('@')[0] if not user.email else user.email,  # Fallback name
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=int(expires_delta.total_seconds())
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google OAuth failed: {str(e)}"
        )

# ============================================================================
# PHONE OTP ENDPOINTS
# ============================================================================

@router.post("/phone/request", response_model=PhoneOTPResponse, tags=["Authentication"])
async def request_phone_otp(
    request: PhoneOTPRequestRequest,
    db: Session = Depends(get_db)
):
    """
    Request OTP for phone login
    
    Generates a 6-digit OTP and sends via SMS (using Twilio/Firebase).
    In development, OTP is logged to console.
    
    Args:
        request: Phone number in E.164 format
        db: Database session
        
    Returns:
        PhoneOTPResponse with OTP expiry
    """
    
    # Validate phone format
    if not is_valid_phone(request.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format. Use E.164 format: +1234567890"
        )
    
    try:
        # Generate OTP
        otp = generate_otp(length=6)
        
        # Store OTP in memory (development)
        # In production: use Redis with expiry
        otp_storage[request.phone] = {
            "otp": otp,
            "created_at": datetime.utcnow(),
            "attempts": 0
        }
        
        # TODO: Send OTP via SMS (Twilio/Firebase)
        # For now, just log it
        print(f"📱 OTP for {request.phone}: {otp}")
        
        return PhoneOTPResponse(
            phone=request.phone,
            otp_sent=True,
            expires_in=OTP_EXPIRE_MINUTES * 60  # Convert to seconds
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send OTP: {str(e)}"
        )

@router.post("/phone/verify", response_model=LoginResponse, tags=["Authentication"])
async def verify_phone_otp(
    request: PhoneOTPVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify OTP and login via phone
    
    Validates OTP, creates/updates user, and returns JWT tokens.
    
    Args:
        request: Phone number and OTP
        db: Database session
        
    Returns:
        LoginResponse with tokens and user info
    """
    
    # Validate phone format
    if not is_valid_phone(request.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format"
        )
    
    # Check if OTP exists
    if request.phone not in otp_storage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found. Request a new OTP first."
        )
    
    otp_data = otp_storage[request.phone]
    
    # Check OTP expiry
    if datetime.utcnow() > otp_data["created_at"] + timedelta(minutes=OTP_EXPIRE_MINUTES):
        del otp_storage[request.phone]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Request a new one."
        )
    
    # Check attempts
    if otp_data["attempts"] >= OTP_MAX_ATTEMPTS:
        del otp_storage[request.phone]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Request new OTP."
        )
    
    # Verify OTP
    if otp_data["otp"] != request.otp:
        otp_data["attempts"] += 1
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OTP. {OTP_MAX_ATTEMPTS - otp_data['attempts']} attempts remaining."
        )
    
    # OTP correct - delete it
    del otp_storage[request.phone]
    
    try:
        # Find or create user
        user = db.query(User).filter(User.phone == request.phone).first()
        
        if user:
            # Existing user
            user.phone_verified = True
            user.last_login = datetime.utcnow()
        else:
            # New user
            user = User(
                phone=request.phone,
                phone_verified=True,
                is_active=True,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow()
            )
            db.add(user)
            db.flush()
            
            # Create profile
            profile = UserProfile(
                user_id=user.id,
                name=None,  # Phone-only users have no name initially
                timezone="UTC",
                language="en",
                created_at=datetime.utcnow()
            )
            db.add(profile)
        
        db.commit()
        
        # Create tokens
        expires_delta = timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", 1440)))
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_access_token(
            data={"sub": str(user.id), "type": "refresh"},
            expires_delta=timedelta(days=7)
        )
        
        return LoginResponse(
            user_id=user.id,
            phone=user.phone,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=int(expires_delta.total_seconds())
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

# ============================================================================
# TOKEN MANAGEMENT
# ============================================================================

@router.post("/refresh", response_model=LoginResponse, tags=["Authentication"])
async def refresh_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    
    Args:
        request: Refresh token
        db: Database session
        
    Returns:
        LoginResponse with new access token
    """
    
    # Verify refresh token
    payload = verify_token(request.refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = int(payload.get("sub"))
    
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    expires_delta = timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", 1440)))
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return LoginResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        access_token=access_token,
        refresh_token=request.refresh_token,  # Keep same refresh token
        expires_in=int(expires_delta.total_seconds())
    )

@router.post("/logout", response_model=SuccessResponse, tags=["Authentication"])
async def logout():
    """
    Logout endpoint (stateless - just invalidates token on client)
    
    In stateless JWT systems, logout is handled client-side by deleting the token.
    This endpoint exists for consistency.
    """
    return SuccessResponse(
        success=True,
        message="Logged out successfully. Please delete your tokens on the client."
    )

# ============================================================================
# USER PROFILE
# ============================================================================

@router.get("/profile", response_model=UserProfileResponse, tags=["Authentication"])
async def get_profile(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get current user profile
    
    Requires valid access token (JWT).
    
    Args:
        current_user_id: From JWT token (injected by dependency)
        db: Database session
        
    Returns:
        UserProfileResponse with all profile info
    """
    
    user = db.query(User).filter(User.id == current_user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user_id).first()
    
    return UserProfileResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        name=profile.name if profile else None,
        country=profile.country if profile else None,
        timezone=profile.timezone if profile else "UTC",
        language=profile.language if profile else "en",
        profile_image_url=profile.profile_image_url if profile else None,
        created_at=user.created_at,
        last_login=user.last_login
    )

@router.put("/profile", response_model=SuccessResponse, tags=["Authentication"])
async def update_profile(
    request: UpdateProfileRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update user profile
    
    Args:
        request: Updated profile data
        current_user_id: From JWT token
        db: Database session
        
    Returns:
        Success message
    """
    
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user_id).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Update only provided fields
    if request.name is not None:
        profile.name = request.name
    if request.country is not None:
        profile.country = request.country
    if request.timezone is not None:
        profile.timezone = request.timezone
    if request.language is not None:
        profile.language = request.language
    if request.preferences is not None:
        profile.preferences = request.preferences
    
    profile.updated_at = datetime.utcnow()
    
    db.commit()
    
    return SuccessResponse(
        success=True,
        message="Profile updated successfully"
    )
