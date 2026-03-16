"""Payment request/response schemas for Razorpay and Stripe."""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


# ════════════════════════════════════════════════════════════════════════════
# REQUEST SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class RazorpayCreateOrderRequest(BaseModel):
    """Request to create a Razorpay payment order."""
    
    tier: str = Field(..., description="Subscription tier: BASIC, STANDARD, PREMIUM")
    amount_paise: int = Field(..., description="Amount in paise (100 paise = 1 rupee)")
    currency: str = Field(default="INR", description="Currency code")
    billing_cycle: str = Field(default="monthly", description="Billing cycle: monthly or annual")
    
    class Config:
        schema_extra = {
            "example": {
                "tier": "BASIC",
                "amount_paise": 24900,
                "currency": "INR",
                "billing_cycle": "monthly"
            }
        }


class StripeCreateSessionRequest(BaseModel):
    """Request to create a Stripe checkout session."""
    
    tier: str = Field(..., description="Subscription tier: BASIC, STANDARD, PREMIUM")
    amount_cents: int = Field(..., description="Amount in cents (100 cents = 1 USD)")
    currency: str = Field(default="USD", description="Currency code")
    billing_cycle: str = Field(default="monthly", description="Billing cycle: monthly or annual")
    
    class Config:
        schema_extra = {
            "example": {
                "tier": "BASIC",
                "amount_cents": 290,
                "currency": "USD",
                "billing_cycle": "monthly"
            }
        }


class PaymentWebhookRequest(BaseModel):
    """Generic payment webhook payload."""
    
    event: str
    payload: Dict[str, Any]


class RazorpayWebhookRequest(BaseModel):
    """Razorpay webhook payload."""
    
    event: str = Field(..., description="Event type: payment.authorized, payment.failed, etc")
    payload: Dict[str, Any] = Field(..., description="Raw webhook payload from Razorpay")
    
    class Config:
        schema_extra = {
            "example": {
                "event": "payment.authorized",
                "payload": {
                    "payment": {
                        "entity": "payment",
                        "id": "pay_123456789",
                        "amount": 24900,
                        "currency": "INR",
                        "status": "authorized",
                        "method": "upi"
                    }
                }
            }
        }


class StripeWebhookRequest(BaseModel):
    """Stripe webhook payload."""
    
    id: str = Field(..., description="Event ID")
    type: str = Field(..., description="Event type: charge.succeeded, invoice.paid, etc")
    data: Dict[str, Any] = Field(..., description="Event data")
    
    class Config:
        schema_extra = {
            "example": {
                "id": "evt_123456789",
                "type": "charge.succeeded",
                "data": {
                    "object": {
                        "id": "ch_123456789",
                        "amount": 290,
                        "currency": "usd",
                        "status": "succeeded"
                    }
                }
            }
        }


# ════════════════════════════════════════════════════════════════════════════
# RESPONSE SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class RazorpayOrderResponse(BaseModel):
    """Response from Razorpay order creation."""
    
    order_id: str = Field(..., description="Razorpay order ID")
    amount: int = Field(..., description="Amount in paise")
    currency: str = Field(..., description="Currency")
    user_id: int = Field(..., description="User ID")
    tier: str = Field(..., description="Subscription tier")
    created_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "order_id": "order_123456789",
                "amount": 24900,
                "currency": "INR",
                "user_id": 1,
                "tier": "BASIC",
                "created_at": "2026-03-15T13:34:00"
            }
        }


class StripeSessionResponse(BaseModel):
    """Response from Stripe session creation."""
    
    session_id: str = Field(..., description="Stripe session ID")
    checkout_url: str = Field(..., description="Stripe checkout URL")
    amount: int = Field(..., description="Amount in cents")
    currency: str = Field(..., description="Currency")
    user_id: int = Field(..., description="User ID")
    tier: str = Field(..., description="Subscription tier")
    created_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "session_id": "cs_test_123456789",
                "checkout_url": "https://checkout.stripe.com/pay/cs_test_123456789",
                "amount": 290,
                "currency": "USD",
                "user_id": 1,
                "tier": "BASIC",
                "created_at": "2026-03-15T13:34:00"
            }
        }


class PaymentHistoryItem(BaseModel):
    """Single payment transaction."""
    
    id: int
    user_id: int
    payment_provider: str = Field(..., description="razorpay or stripe")
    order_id: str = Field(..., description="Provider's order ID")
    amount: float
    currency: str
    tier: str
    status: str = Field(..., description="pending, completed, failed, refunded")
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "user_id": 1,
                "payment_provider": "razorpay",
                "order_id": "order_123456789",
                "amount": 249.00,
                "currency": "INR",
                "tier": "BASIC",
                "status": "completed",
                "created_at": "2026-03-15T13:34:00",
                "updated_at": "2026-03-15T13:35:00"
            }
        }


class PaymentHistoryResponse(BaseModel):
    """Response with payment history."""
    
    payments: list[PaymentHistoryItem]
    total_count: int
    user_id: int
    
    class Config:
        schema_extra = {
            "example": {
                "payments": [
                    {
                        "id": 1,
                        "user_id": 1,
                        "payment_provider": "razorpay",
                        "order_id": "order_123456789",
                        "amount": 249.00,
                        "currency": "INR",
                        "tier": "BASIC",
                        "status": "completed",
                        "created_at": "2026-03-15T13:34:00",
                        "updated_at": "2026-03-15T13:35:00"
                    }
                ],
                "total_count": 1,
                "user_id": 1
            }
        }


class WebhookResponse(BaseModel):
    """Generic webhook response."""
    
    success: bool
    message: str
    event_id: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Webhook processed successfully",
                "event_id": "evt_123456789"
            }
        }


class RefundRequest(BaseModel):
    """Request to refund a payment."""
    
    order_id: str = Field(..., description="Provider's order ID")
    reason: Optional[str] = Field(None, description="Refund reason")
    
    class Config:
        schema_extra = {
            "example": {
                "order_id": "order_123456789",
                "reason": "User requested refund"
            }
        }


class RefundResponse(BaseModel):
    """Response from refund operation."""
    
    refund_id: str
    order_id: str
    amount: float
    currency: str
    status: str = Field(..., description="pending, completed, failed")
    created_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "refund_id": "rfnd_123456789",
                "order_id": "order_123456789",
                "amount": 249.00,
                "currency": "INR",
                "status": "completed",
                "created_at": "2026-03-15T13:34:00"
            }
        }


class SubscriptionResponse(BaseModel):
    """Response with subscription details."""
    
    user_id: int
    current_tier: str
    next_billing_date: datetime
    auto_renew: bool
    payment_method: str = Field(..., description="razorpay, stripe, or none")
    status: str = Field(..., description="active, inactive, cancelled, expired")
    created_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": 1,
                "current_tier": "BASIC",
                "next_billing_date": "2026-04-15T13:34:00",
                "auto_renew": True,
                "payment_method": "razorpay",
                "status": "active",
                "created_at": "2026-03-15T13:34:00"
            }
        }
