"""
Promotional Offer Service
Manages new user discounts and special offers
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database.models import PromotionalOffer, User, Subscription
import logging

logger = logging.getLogger(__name__)

class PromotionalOfferService:
    """Handles new user promotional offers"""
    
    # New User BASIC Plan Offer
    NEW_USER_OFFER = {
        "offer_type": "NEW_USER_BASIC",
        "tier": "BASIC",
        "original_price": 249,  # ₹249 per month
        "discounted_price": 49,  # ₹49 for first month
        "discount_percentage": 80,  # 80% off
        "duration_days": 30,  # Valid for 30 days
        "currency": "INR"
    }
    
    @staticmethod
    def is_new_user(user: User) -> bool:
        """Check if user is eligible for new user offer (no subscriptions yet)"""
        return len(user.subscriptions) == 0
    
    @staticmethod
    def create_new_user_offer(user_id: int, db: Session) -> PromotionalOffer:
        """Create new user offer on registration"""
        
        # Check if offer already exists
        existing_offer = db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id
        ).first()
        
        if existing_offer:
            logger.warning(f"Offer already exists for user {user_id}")
            return existing_offer
        
        # Create new offer
        offer = PromotionalOffer(
            user_id=user_id,
            offer_type=PromotionalOfferService.NEW_USER_OFFER["offer_type"],
            original_price=PromotionalOfferService.NEW_USER_OFFER["original_price"],
            discounted_price=PromotionalOfferService.NEW_USER_OFFER["discounted_price"],
            discount_percentage=PromotionalOfferService.NEW_USER_OFFER["discount_percentage"],
            tier=PromotionalOfferService.NEW_USER_OFFER["tier"],
            duration_days=PromotionalOfferService.NEW_USER_OFFER["duration_days"],
            auto_renewal_price=PromotionalOfferService.NEW_USER_OFFER["original_price"]
        )
        
        db.add(offer)
        db.commit()
        db.refresh(offer)
        
        logger.info(f"Created promotional offer for user {user_id}")
        return offer
    
    @staticmethod
    def get_offer(user_id: int, db: Session) -> PromotionalOffer:
        """Get user's promotional offer (if available)"""
        return db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id,
            PromotionalOffer.is_claimed == False,
            PromotionalOffer.is_expired == False
        ).first()
    
    @staticmethod
    def mark_offer_shown(user_id: int, db: Session) -> bool:
        """Mark offer as shown in notification"""
        offer = db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id
        ).first()
        
        if not offer:
            return False
        
        offer.offer_shown_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Marked offer as shown for user {user_id}")
        return True
    
    @staticmethod
    def claim_offer(user_id: int, db: Session) -> PromotionalOffer:
        """Mark offer as claimed when user makes purchase"""
        offer = db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id
        ).first()
        
        if not offer:
            raise ValueError(f"No offer found for user {user_id}")
        
        if offer.is_claimed:
            raise ValueError(f"Offer already claimed for user {user_id}")
        
        if offer.is_expired:
            raise ValueError(f"Offer expired for user {user_id}")
        
        # Mark as claimed
        offer.is_claimed = True
        offer.offer_used_at = datetime.utcnow()
        offer.offer_expires_at = datetime.utcnow() + timedelta(days=offer.duration_days)
        offer.auto_renewal_date = offer.offer_expires_at
        
        db.commit()
        db.refresh(offer)
        
        logger.info(f"Claimed promotional offer for user {user_id}")
        logger.info(f"Offer expires on: {offer.offer_expires_at}")
        return offer
    
    @staticmethod
    def check_offer_expired(user_id: int, db: Session) -> bool:
        """Check if offer period has expired"""
        offer = db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id
        ).first()
        
        if not offer or not offer.offer_expires_at:
            return False
        
        if datetime.utcnow() > offer.offer_expires_at and not offer.is_expired:
            offer.is_expired = True
            db.commit()
            logger.info(f"Marked offer as expired for user {user_id}")
            return True
        
        return offer.is_expired
    
    @staticmethod
    def get_price_for_user(user_id: int, tier: str, db: Session) -> dict:
        """Get price for user based on offer eligibility"""
        offer = db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id
        ).first()
        
        # Price lookup by tier
        prices = {
            "BASIC": {
                "INR": 249,
                "USD": 2.99
            },
            "STANDARD": {
                "INR": 449,
                "USD": 4.99
            },
            "PREMIUM": {
                "INR": 1699,
                "USD": 19.99
            }
        }
        
        base_price = prices.get(tier, {}).get("INR", 249)
        
        # Apply promotional pricing if offer exists and not used
        if offer and not offer.is_claimed and not offer.is_expired and offer.tier == tier:
            return {
                "price": offer.discounted_price,
                "original_price": offer.original_price,
                "discount_percentage": offer.discount_percentage,
                "is_promotional": True,
                "offer_expires_at": None  # Offer is still available
            }
        
        # Check if offer period expired - show normal price
        return {
            "price": base_price,
            "original_price": base_price,
            "discount_percentage": 0,
            "is_promotional": False,
            "offer_expires_at": offer.offer_expires_at if offer else None
        }
    
    @staticmethod
    def get_subscription_details(user_id: int, db: Session) -> dict:
        """Get user's subscription with price info"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        
        subscription = db.query(Subscription).filter(
            Subscription.user_id == user_id
        ).first()
        
        if not subscription:
            return {
                "status": "NO_SUBSCRIPTION",
                "tier": "FREE",
                "message": "No active subscription"
            }
        
        offer = db.query(PromotionalOffer).filter(
            PromotionalOffer.user_id == user_id
        ).first()
        
        return {
            "status": "ACTIVE",
            "tier": subscription.tier,
            "expiry_date": subscription.expiry_date,
            "is_promotional_period": offer and offer.is_claimed and not offer.is_expired,
            "promotional_expires_at": offer.offer_expires_at if offer else None,
            "will_renew_at_price": offer.auto_renewal_price if offer else None
        }
