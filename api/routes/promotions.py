"""
Promotional Offer API Routes
Endpoints for managing new user special offers
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from database.db import get_db
from database.models import User, PromotionalOffer, Subscription
from api.routes.dependencies import get_current_user
from utils.promotional_service import PromotionalOfferService

router = APIRouter(prefix="/api/promotions", tags=["Promotions"])


# ============================================================================
# SCHEMAS
# ============================================================================

class OfferResponse(BaseModel):
    """Promotional offer details"""
    id: int
    offer_type: str
    original_price: float
    discounted_price: float
    discount_percentage: int
    tier: str
    duration_days: int
    is_claimed: bool
    is_expired: bool
    offer_shown_at: Optional[datetime]
    offer_used_at: Optional[datetime]
    offer_expires_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class OfferPriceResponse(BaseModel):
    """Price with promotional offer applied"""
    price: float
    original_price: float
    discount_percentage: int
    is_promotional: bool
    offer_expires_at: Optional[datetime]
    currency: str = "INR"
    message: Optional[str] = None


class ClaimOfferResponse(BaseModel):
    """Response when claiming promotional offer"""
    success: bool
    message: str
    price: float
    discount: int
    duration_days: int


class SubscriptionStatusResponse(BaseModel):
    """Current subscription status with offer info"""
    status: str
    tier: str
    expiry_date: Optional[datetime]
    is_promotional_period: bool
    promotional_expires_at: Optional[datetime]
    will_renew_at_price: Optional[float]
    message: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/offer", response_model=OfferResponse)
async def get_user_offer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's active promotional offer (if available)"""
    
    offer = PromotionalOfferService.get_offer(current_user.id, db)
    
    if not offer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active promotional offer available"
        )
    
    # Mark as shown when user views it
    PromotionalOfferService.mark_offer_shown(current_user.id, db)
    
    return offer


@router.get("/offer/price/{tier}", response_model=OfferPriceResponse)
async def get_promotional_price(
    tier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get price for a tier (with promotional discount if applicable)"""
    
    tier = tier.upper()
    if tier not in ["BASIC", "STANDARD", "PREMIUM"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tier. Must be BASIC, STANDARD, or PREMIUM"
        )
    
    price_info = PromotionalOfferService.get_price_for_user(current_user.id, tier, db)
    
    message = "🎉 Special offer: 80% off! Limited time only!" if price_info["is_promotional"] else None
    
    return OfferPriceResponse(
        price=price_info["price"],
        original_price=price_info["original_price"],
        discount_percentage=price_info["discount_percentage"],
        is_promotional=price_info["is_promotional"],
        offer_expires_at=price_info["offer_expires_at"],
        message=message
    )


@router.post("/offer/claim", response_model=ClaimOfferResponse)
async def claim_promotional_offer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Claim promotional offer when making purchase"""
    
    try:
        offer = PromotionalOfferService.claim_offer(current_user.id, db)
        
        return ClaimOfferResponse(
            success=True,
            message=f"🎉 Promotional offer claimed! Pay just ₹{offer.discounted_price} for {offer.duration_days} days!",
            price=offer.discounted_price,
            discount=offer.discount_percentage,
            duration_days=offer.duration_days
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/subscription/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current subscription status with promotional offer details"""
    
    details = PromotionalOfferService.get_subscription_details(current_user.id, db)
    
    if details["status"] == "NO_SUBSCRIPTION":
        return SubscriptionStatusResponse(
            status="FREE",
            tier="FREE",
            expiry_date=None,
            is_promotional_period=False,
            promotional_expires_at=None,
            will_renew_at_price=None,
            message="You're on the FREE plan (55 messages/day). Upgrade for more!"
        )
    
    message = ""
    if details["is_promotional_period"]:
        message = f"🎉 You're on promotional pricing! Normal price (₹{details['will_renew_at_price']}) starts on {details['promotional_expires_at']}"
    else:
        message = f"Your {details['tier']} subscription expires on {details['expiry_date']}"
    
    return SubscriptionStatusResponse(
        status="ACTIVE",
        tier=details["tier"],
        expiry_date=details["expiry_date"],
        is_promotional_period=details["is_promotional_period"],
        promotional_expires_at=details["promotional_expires_at"],
        will_renew_at_price=details["will_renew_at_price"],
        message=message
    )


@router.get("/offers/admin/statistics")
async def get_offer_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get admin statistics on promotional offers (admin only)"""
    
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    total_offers = db.query(PromotionalOffer).count()
    claimed_offers = db.query(PromotionalOffer).filter(
        PromotionalOffer.is_claimed == True
    ).count()
    expired_offers = db.query(PromotionalOffer).filter(
        PromotionalOffer.is_expired == True
    ).count()
    active_offers = db.query(PromotionalOffer).filter(
        PromotionalOffer.is_claimed == False,
        PromotionalOffer.is_expired == False
    ).count()
    
    # Calculate revenue impact
    claimed_subscriptions = db.query(PromotionalOffer).filter(
        PromotionalOffer.is_claimed == True
    ).all()
    
    promotional_revenue = sum([offer.discounted_price for offer in claimed_subscriptions])
    regular_revenue = sum([offer.original_price for offer in claimed_subscriptions])
    revenue_given_up = regular_revenue - promotional_revenue
    
    return {
        "total_offers_created": total_offers,
        "offers_claimed": claimed_offers,
        "offers_expired": expired_offers,
        "offers_active": active_offers,
        "claim_rate_percentage": (claimed_offers / total_offers * 100) if total_offers > 0 else 0,
        "revenue_from_offers": promotional_revenue,
        "regular_revenue_if_no_offer": regular_revenue,
        "revenue_given_as_discount": revenue_given_up,
        "average_discount_per_user": (revenue_given_up / claimed_offers) if claimed_offers > 0 else 0
    }
