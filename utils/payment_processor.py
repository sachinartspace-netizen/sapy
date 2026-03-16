"""Payment processor utilities for Razorpay and Stripe."""

import os
import hmac
import hashlib
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
# RAZORPAY PAYMENT PROCESSOR
# ════════════════════════════════════════════════════════════════════════════

class RazorpayProcessor:
    """Handles Razorpay UPI and card payments for India."""
    
    def __init__(self, key_id: Optional[str] = None, key_secret: Optional[str] = None):
        """Initialize Razorpay processor.
        
        Args:
            key_id: Razorpay Key ID (from env: RAZORPAY_KEY_ID)
            key_secret: Razorpay Key Secret (from env: RAZORPAY_KEY_SECRET)
        """
        self.key_id = key_id or os.getenv("RAZORPAY_KEY_ID", "")
        self.key_secret = key_secret or os.getenv("RAZORPAY_KEY_SECRET", "")
        
        if not self.key_id or not self.key_secret:
            logger.warning("Razorpay credentials not configured. Payment processing disabled.")
    
    def create_order(
        self,
        user_id: int,
        amount_paise: int,
        tier: str,
        description: str = "Sapy Subscription",
        notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a Razorpay order.
        
        Args:
            user_id: User ID
            amount_paise: Amount in paise (100 paise = 1 rupee)
            tier: Subscription tier (BASIC, STANDARD, PREMIUM)
            description: Order description
            notes: Additional notes (metadata)
            
        Returns:
            Order details with order_id, amount, currency, etc.
        """
        try:
            import razorpay
        except ImportError:
            logger.error("razorpay package not installed. Install with: pip install razorpay")
            return {
                "error": "Razorpay client not available",
                "status": "failed"
            }
        
        try:
            client = razorpay.Client(auth=(self.key_id, self.key_secret))
            
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"sapy-{user_id}-{datetime.utcnow().timestamp()}",
                "description": description,
                "notes": notes or {
                    "user_id": str(user_id),
                    "tier": tier,
                    "app": "sapy"
                }
            }
            
            response = client.order.create(data=order_data)
            
            logger.info(f"Razorpay order created: {response['id']} for user {user_id}")
            
            return {
                "order_id": response["id"],
                "amount": response["amount"],
                "currency": response["currency"],
                "receipt": response["receipt"],
                "status": response["status"],
                "created_at": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "tier": tier
            }
        
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {str(e)}")
            return {
                "error": str(e),
                "status": "failed"
            }
    
    def verify_payment_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: str
    ) -> bool:
        """Verify Razorpay payment signature.
        
        Args:
            order_id: Razorpay order ID
            payment_id: Razorpay payment ID
            signature: Payment signature from webhook
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            data = f"{order_id}|{payment_id}"
            expected_signature = hmac.new(
                self.key_secret.encode(),
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            is_valid = expected_signature == signature
            
            if is_valid:
                logger.info(f"Razorpay payment {payment_id} verified successfully")
            else:
                logger.warning(f"Razorpay signature mismatch for payment {payment_id}")
            
            return is_valid
        
        except Exception as e:
            logger.error(f"Razorpay signature verification failed: {str(e)}")
            return False
    
    def refund_payment(
        self,
        payment_id: str,
        amount_paise: Optional[int] = None,
        reason: str = "Refund requested"
    ) -> Dict[str, Any]:
        """Refund a Razorpay payment.
        
        Args:
            payment_id: Razorpay payment ID
            amount_paise: Refund amount (None for full refund)
            reason: Refund reason
            
        Returns:
            Refund details
        """
        try:
            import razorpay
        except ImportError:
            return {"error": "Razorpay client not available", "status": "failed"}
        
        try:
            client = razorpay.Client(auth=(self.key_id, self.key_secret))
            
            refund_data = {
                "notes": {"reason": reason}
            }
            
            if amount_paise:
                refund_data["amount"] = amount_paise
            
            response = client.payment.refund(payment_id, refund_data)
            
            logger.info(f"Razorpay refund created: {response['id']} for payment {payment_id}")
            
            return {
                "refund_id": response["id"],
                "payment_id": payment_id,
                "amount": response.get("amount"),
                "status": response["status"],
                "created_at": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Razorpay refund failed: {str(e)}")
            return {
                "error": str(e),
                "status": "failed"
            }


# ════════════════════════════════════════════════════════════════════════════
# STRIPE PAYMENT PROCESSOR
# ════════════════════════════════════════════════════════════════════════════

class StripeProcessor:
    """Handles Stripe card and PayPal payments for international users."""
    
    def __init__(self, api_key: Optional[str] = None, webhook_secret: Optional[str] = None):
        """Initialize Stripe processor.
        
        Args:
            api_key: Stripe Secret API Key (from env: STRIPE_API_KEY)
            webhook_secret: Stripe Webhook Secret (from env: STRIPE_WEBHOOK_SECRET)
        """
        self.api_key = api_key or os.getenv("STRIPE_API_KEY", "")
        self.webhook_secret = webhook_secret or os.getenv("STRIPE_WEBHOOK_SECRET", "")
        
        if not self.api_key:
            logger.warning("Stripe API key not configured. Payment processing disabled.")
        
        # Configure Stripe
        try:
            import stripe
            stripe.api_key = self.api_key
        except ImportError:
            logger.warning("stripe package not installed. Install with: pip install stripe")
    
    def create_checkout_session(
        self,
        user_id: int,
        user_email: str,
        amount_cents: int,
        tier: str,
        success_url: str,
        cancel_url: str,
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """Create a Stripe checkout session.
        
        Args:
            user_id: User ID
            user_email: User email
            amount_cents: Amount in cents (100 cents = 1 USD)
            tier: Subscription tier (BASIC, STANDARD, PREMIUM)
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect after cancelled payment
            currency: Currency code (USD, EUR, GBP, etc.)
            
        Returns:
            Session details with session_id and checkout_url
        """
        try:
            import stripe
        except ImportError:
            logger.error("stripe package not installed. Install with: pip install stripe")
            return {
                "error": "Stripe client not available",
                "status": "failed"
            }
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="payment",
                customer_email=user_email,
                line_items=[
                    {
                        "price_data": {
                            "currency": currency.lower(),
                            "product_data": {
                                "name": f"Sapy {tier} Subscription",
                                "description": f"Monthly subscription for {tier} tier"
                            },
                            "unit_amount": amount_cents
                        },
                        "quantity": 1
                    }
                ],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "user_id": str(user_id),
                    "tier": tier,
                    "app": "sapy"
                }
            )
            
            logger.info(f"Stripe session created: {session.id} for user {user_id}")
            
            return {
                "session_id": session.id,
                "checkout_url": session.url,
                "amount": amount_cents,
                "currency": currency,
                "user_id": user_id,
                "tier": tier,
                "created_at": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Stripe session creation failed: {str(e)}")
            return {
                "error": str(e),
                "status": "failed"
            }
    
    def verify_webhook_signature(self, body: str, signature: str) -> bool:
        """Verify Stripe webhook signature.
        
        Args:
            body: Raw webhook body
            signature: Stripe-Signature header value
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            import stripe
            stripe.Webhook.construct_event(body, signature, self.webhook_secret)
            logger.info("Stripe webhook signature verified")
            return True
        except ValueError:
            logger.warning("Invalid Stripe webhook signature")
            return False
        except Exception as e:
            logger.error(f"Stripe webhook verification failed: {str(e)}")
            return False
    
    def refund_charge(
        self,
        charge_id: str,
        amount_cents: Optional[int] = None,
        reason: str = "requested_by_customer"
    ) -> Dict[str, Any]:
        """Refund a Stripe charge.
        
        Args:
            charge_id: Stripe charge ID
            amount_cents: Refund amount in cents (None for full refund)
            reason: Refund reason
            
        Returns:
            Refund details
        """
        try:
            import stripe
        except ImportError:
            return {"error": "Stripe client not available", "status": "failed"}
        
        try:
            refund_data = {
                "charge": charge_id,
                "reason": reason
            }
            
            if amount_cents:
                refund_data["amount"] = amount_cents
            
            refund = stripe.Refund.create(**refund_data)
            
            logger.info(f"Stripe refund created: {refund.id} for charge {charge_id}")
            
            return {
                "refund_id": refund.id,
                "charge_id": charge_id,
                "amount": refund.amount,
                "currency": refund.currency,
                "status": refund.status,
                "created_at": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Stripe refund failed: {str(e)}")
            return {
                "error": str(e),
                "status": "failed"
            }
    
    def get_charge_details(self, charge_id: str) -> Dict[str, Any]:
        """Get details of a Stripe charge.
        
        Args:
            charge_id: Stripe charge ID
            
        Returns:
            Charge details
        """
        try:
            import stripe
        except ImportError:
            return {"error": "Stripe client not available"}
        
        try:
            charge = stripe.Charge.retrieve(charge_id)
            return {
                "charge_id": charge.id,
                "amount": charge.amount,
                "currency": charge.currency,
                "status": charge.status,
                "payment_method": charge.payment_method_details.type if charge.payment_method_details else "unknown",
                "customer_email": charge.billing_details.email if charge.billing_details else None,
                "created_at": datetime.fromtimestamp(charge.created).isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get Stripe charge details: {str(e)}")
            return {"error": str(e)}


# ════════════════════════════════════════════════════════════════════════════
# PRICING CONFIGURATION
# ════════════════════════════════════════════════════════════════════════════

TIER_PRICING = {
    "FREE": {
        "inr": {"monthly": 0},
        "usd": {"monthly": 0},
        "messages_per_day": 55
    },
    "BASIC": {
        "inr": {"monthly": 24900, "annual": 249000},  # ₹249/month, ₹2490/year
        "usd": {"monthly": 290, "annual": 2900},      # $2.90/month, $29/year
        "messages_per_day": 155
    },
    "STANDARD": {
        "inr": {"monthly": 44900, "annual": 449000},  # ₹449/month, ₹4490/year
        "usd": {"monthly": 490, "annual": 4900},      # $4.90/month, $49/year
        "messages_per_day": 555
    },
    "PREMIUM": {
        "inr": {"monthly": 169900, "annual": 1699000}, # ₹1699/month, ₹16990/year
        "usd": {"monthly": 1990, "annual": 19900},     # $19.90/month, $199/year
        "messages_per_day": None  # Unlimited
    }
}


def get_price(tier: str, currency: str = "INR", billing_cycle: str = "monthly") -> Optional[int]:
    """Get price for a tier.
    
    Args:
        tier: BASIC, STANDARD, PREMIUM
        currency: INR or USD
        billing_cycle: monthly or annual
        
    Returns:
        Price in lowest denomination (paise for INR, cents for USD)
    """
    tier = tier.upper()
    currency = currency.upper()
    billing_cycle = billing_cycle.lower()
    
    if tier not in TIER_PRICING:
        return None
    
    if currency == "INR":
        return TIER_PRICING[tier]["inr"].get(billing_cycle)
    elif currency == "USD":
        return TIER_PRICING[tier]["usd"].get(billing_cycle)
    
    return None


def get_messages_per_day(tier: str) -> Optional[int]:
    """Get daily message limit for a tier.
    
    Args:
        tier: BASIC, STANDARD, PREMIUM
        
    Returns:
        Messages per day (None for unlimited)
    """
    tier = tier.upper()
    if tier not in TIER_PRICING:
        return None
    return TIER_PRICING[tier]["messages_per_day"]


def calculate_next_billing_date(billing_cycle: str = "monthly") -> datetime:
    """Calculate next billing date.
    
    Args:
        billing_cycle: monthly or annual
        
    Returns:
        Datetime of next billing date
    """
    if billing_cycle == "annual":
        return datetime.utcnow() + timedelta(days=365)
    else:
        return datetime.utcnow() + timedelta(days=30)
