"""Payment API routes for Razorpay and Stripe integration."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from database.db import get_db
from database.models import User, Payment, Subscription, License
from api.routes.dependencies import get_current_user
from api.schemas.payments import (
    RazorpayCreateOrderRequest,
    StripeCreateSessionRequest,
    RazorpayOrderResponse,
    StripeSessionResponse,
    PaymentHistoryResponse,
    PaymentHistoryItem,
    WebhookResponse,
    RazorpayWebhookRequest,
    StripeWebhookRequest,
    RefundRequest,
    RefundResponse,
    SubscriptionResponse,
)
from utils.payment_processor import (
    RazorpayProcessor,
    StripeProcessor,
    get_price,
    get_messages_per_day,
    calculate_next_billing_date,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize processors
razorpay = RazorpayProcessor()
stripe = StripeProcessor()


# ════════════════════════════════════════════════════════════════════════════
# RAZORPAY ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/razorpay/create", response_model=RazorpayOrderResponse)
async def create_razorpay_order(
    request: RazorpayCreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Razorpay payment order (UPI/Card for India).
    
    Args:
        tier: BASIC, STANDARD, or PREMIUM
        amount_paise: Amount in paise (100 = ₹1)
        currency: INR (default)
        billing_cycle: monthly or annual
        
    Returns:
        Order details with order_id and Razorpay response
    """
    try:
        # Validate tier
        if request.tier.upper() not in ["BASIC", "STANDARD", "PREMIUM"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tier. Must be BASIC, STANDARD, or PREMIUM"
            )
        
        # Create Razorpay order
        order_response = razorpay.create_order(
            user_id=current_user.id,
            amount_paise=request.amount_paise,
            tier=request.tier.upper(),
            notes={
                "user_email": current_user.email,
                "billing_cycle": request.billing_cycle
            }
        )
        
        if "error" in order_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=order_response["error"]
            )
        
        # Store in database
        payment = Payment(
            user_id=current_user.id,
            payment_provider="razorpay",
            order_id=order_response["order_id"],
            amount=request.amount_paise / 100,  # Convert to rupees
            currency=request.currency,
            tier=request.tier.upper(),
            billing_cycle=request.billing_cycle,
            status="pending"
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        
        logger.info(f"Razorpay order created for user {current_user.id}: {order_response['order_id']}")
        
        return RazorpayOrderResponse(
            order_id=order_response["order_id"],
            amount=request.amount_paise,
            currency=request.currency,
            user_id=current_user.id,
            tier=request.tier.upper(),
            created_at=datetime.utcnow()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Razorpay order creation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create order"
        )


@router.post("/webhook/razorpay", response_model=WebhookResponse)
async def razorpay_webhook(
    webhook: RazorpayWebhookRequest,
    x_razorpay_signature: str = Header(...),
    db: Session = Depends(get_db),
):
    """Handle Razorpay webhook events.
    
    Razorpay sends webhooks for:
    - payment.authorized
    - payment.failed
    - payment.captured
    - subscription.halted
    """
    try:
        event = webhook.event
        payload = webhook.payload
        
        logger.info(f"Razorpay webhook received: {event}")
        
        if event == "payment.authorized" or event == "payment.captured":
            # Payment successful
            payment_obj = payload.get("payment", {})
            order_id = payment_obj.get("id")
            amount = payment_obj.get("amount")
            
            # Update payment in database
            payment = db.query(Payment).filter_by(order_id=order_id).first()
            if payment:
                payment.status = "completed"
                payment.updated_at = datetime.utcnow()
                
                # Update subscription
                subscription = db.query(Subscription).filter_by(
                    user_id=payment.user_id
                ).first()
                
                if not subscription:
                    subscription = Subscription(
                        user_id=payment.user_id,
                        tier=payment.tier,
                        billing_cycle=payment.billing_cycle,
                        status="active",
                        auto_renew=True,
                        next_billing_date=calculate_next_billing_date(payment.billing_cycle)
                    )
                    db.add(subscription)
                else:
                    subscription.tier = payment.tier
                    subscription.status = "active"
                    subscription.next_billing_date = calculate_next_billing_date(payment.billing_cycle)
                
                db.commit()
                logger.info(f"Payment {order_id} marked as completed for user {payment.user_id}")
        
        elif event == "payment.failed":
            # Payment failed
            payment_obj = payload.get("payment", {})
            order_id = payment_obj.get("id")
            
            payment = db.query(Payment).filter_by(order_id=order_id).first()
            if payment:
                payment.status = "failed"
                payment.updated_at = datetime.utcnow()
                db.commit()
                logger.warning(f"Payment {order_id} marked as failed")
        
        return WebhookResponse(
            success=True,
            message="Webhook processed successfully",
            event_id=event
        )
    
    except Exception as e:
        logger.error(f"Razorpay webhook processing error: {str(e)}")
        return WebhookResponse(
            success=False,
            message=f"Webhook processing failed: {str(e)}"
        )


# ════════════════════════════════════════════════════════════════════════════
# STRIPE ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/stripe/create", response_model=StripeSessionResponse)
async def create_stripe_session(
    request: StripeCreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe checkout session (Cards for international).
    
    Args:
        tier: BASIC, STANDARD, or PREMIUM
        amount_cents: Amount in cents (100 = $1)
        currency: USD (default), EUR, GBP, etc.
        billing_cycle: monthly or annual
        
    Returns:
        Session details with session_id and checkout_url
    """
    try:
        # Validate tier
        if request.tier.upper() not in ["BASIC", "STANDARD", "PREMIUM"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tier. Must be BASIC, STANDARD, or PREMIUM"
            )
        
        # Create Stripe session
        session_response = stripe.create_checkout_session(
            user_id=current_user.id,
            user_email=current_user.email,
            amount_cents=request.amount_cents,
            tier=request.tier.upper(),
            success_url="https://sapy.app/payment/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://sapy.app/payment/cancel",
            currency=request.currency
        )
        
        if "error" in session_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=session_response["error"]
            )
        
        # Store in database
        payment = Payment(
            user_id=current_user.id,
            payment_provider="stripe",
            order_id=session_response["session_id"],
            amount=request.amount_cents / 100,  # Convert to dollars
            currency=request.currency,
            tier=request.tier.upper(),
            billing_cycle=request.billing_cycle,
            status="pending"
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        
        logger.info(f"Stripe session created for user {current_user.id}: {session_response['session_id']}")
        
        return StripeSessionResponse(
            session_id=session_response["session_id"],
            checkout_url=session_response["checkout_url"],
            amount=request.amount_cents,
            currency=request.currency,
            user_id=current_user.id,
            tier=request.tier.upper(),
            created_at=datetime.utcnow()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stripe session creation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create checkout session"
        )


@router.post("/webhook/stripe", response_model=WebhookResponse)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(...),
    db: Session = Depends(get_db),
):
    """Handle Stripe webhook events.
    
    Stripe sends webhooks for:
    - charge.succeeded
    - charge.failed
    - invoice.paid
    - customer.subscription.updated
    - invoice.payment_action_required
    """
    try:
        body = await request.body()
        
        # Verify webhook signature
        if not stripe.verify_webhook_signature(body.decode(), stripe_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )
        
        import stripe as stripe_module
        event = stripe_module.Webhook.construct_event(
            body.decode(),
            stripe_signature,
            stripe.webhook_secret
        )
        
        logger.info(f"Stripe webhook received: {event['type']}")
        
        if event['type'] == "charge.succeeded":
            # Payment successful
            charge = event['data']['object']
            session_id = charge.get('metadata', {}).get('session_id')
            
            # Update payment in database
            payment = db.query(Payment).filter_by(order_id=session_id).first()
            if payment:
                payment.status = "completed"
                payment.updated_at = datetime.utcnow()
                
                # Update subscription
                subscription = db.query(Subscription).filter_by(
                    user_id=payment.user_id
                ).first()
                
                if not subscription:
                    subscription = Subscription(
                        user_id=payment.user_id,
                        tier=payment.tier,
                        billing_cycle=payment.billing_cycle,
                        status="active",
                        auto_renew=True,
                        next_billing_date=calculate_next_billing_date(payment.billing_cycle)
                    )
                    db.add(subscription)
                else:
                    subscription.tier = payment.tier
                    subscription.status = "active"
                    subscription.next_billing_date = calculate_next_billing_date(payment.billing_cycle)
                
                db.commit()
                logger.info(f"Stripe payment {charge['id']} marked as completed")
        
        elif event['type'] == "charge.failed":
            # Payment failed
            charge = event['data']['object']
            session_id = charge.get('metadata', {}).get('session_id')
            
            payment = db.query(Payment).filter_by(order_id=session_id).first()
            if payment:
                payment.status = "failed"
                payment.updated_at = datetime.utcnow()
                db.commit()
                logger.warning(f"Stripe payment {charge['id']} marked as failed")
        
        return WebhookResponse(
            success=True,
            message="Webhook processed successfully",
            event_id=event['id']
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stripe webhook processing error: {str(e)}")
        return WebhookResponse(
            success=False,
            message=f"Webhook processing failed: {str(e)}"
        )


# ════════════════════════════════════════════════════════════════════════════
# GENERIC PAYMENT ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/history", response_model=PaymentHistoryResponse)
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get payment history for current user.
    
    Returns:
        List of all payments (successful, failed, pending)
    """
    try:
        payments = db.query(Payment).filter_by(
            user_id=current_user.id
        ).order_by(Payment.created_at.desc()).all()
        
        payment_items = [
            PaymentHistoryItem(
                id=p.id,
                user_id=p.user_id,
                payment_provider=p.payment_provider,
                order_id=p.order_id,
                amount=float(p.amount),
                currency=p.currency,
                tier=p.tier,
                status=p.status,
                created_at=p.created_at,
                updated_at=p.updated_at
            )
            for p in payments
        ]
        
        return PaymentHistoryResponse(
            payments=payment_items,
            total_count=len(payment_items),
            user_id=current_user.id
        )
    
    except Exception as e:
        logger.error(f"Payment history retrieval error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment history"
        )


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current subscription details.
    
    Returns:
        Current tier, next billing date, auto-renewal status, etc.
    """
    try:
        subscription = db.query(Subscription).filter_by(
            user_id=current_user.id
        ).first()
        
        if not subscription:
            return SubscriptionResponse(
                user_id=current_user.id,
                current_tier="FREE",
                next_billing_date=None,
                auto_renew=False,
                payment_method="none",
                status="inactive",
                created_at=datetime.utcnow()
            )
        
        return SubscriptionResponse(
            user_id=current_user.id,
            current_tier=subscription.tier,
            next_billing_date=subscription.next_billing_date,
            auto_renew=subscription.auto_renew,
            payment_method=subscription.payment_method or "none",
            status=subscription.status,
            created_at=subscription.created_at
        )
    
    except Exception as e:
        logger.error(f"Subscription retrieval error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription"
        )


@router.post("/refund", response_model=RefundResponse)
async def refund_payment(
    request: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Request refund for a payment.
    
    Args:
        order_id: Payment order ID
        reason: Refund reason
        
    Returns:
        Refund details
    """
    try:
        # Find payment
        payment = db.query(Payment).filter(
            Payment.user_id == current_user.id,
            Payment.order_id == request.order_id
        ).first()
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        if payment.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only completed payments can be refunded"
            )
        
        # Process refund based on provider
        if payment.payment_provider == "razorpay":
            refund_response = razorpay.refund_payment(
                payment_id=payment.order_id,
                reason=request.reason or "Refund requested"
            )
        elif payment.payment_provider == "stripe":
            refund_response = stripe.refund_charge(
                charge_id=payment.order_id,
                reason=request.reason or "requested_by_customer"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown payment provider"
            )
        
        if "error" in refund_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=refund_response["error"]
            )
        
        # Update payment status
        payment.status = "refunded"
        payment.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Refund processed for payment {payment.order_id}")
        
        return RefundResponse(
            refund_id=refund_response.get("refund_id", ""),
            order_id=payment.order_id,
            amount=float(payment.amount),
            currency=payment.currency,
            status=refund_response.get("status", "completed"),
            created_at=datetime.utcnow()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Refund processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process refund"
        )


@router.post("/cancel-subscription")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel user's subscription.
    
    Returns to FREE tier
    """
    try:
        subscription = db.query(Subscription).filter_by(
            user_id=current_user.id
        ).first()
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active subscription"
            )
        
        subscription.status = "cancelled"
        subscription.tier = "FREE"
        subscription.auto_renew = False
        subscription.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Subscription cancelled for user {current_user.id}")
        
        return {
            "success": True,
            "message": "Subscription cancelled successfully",
            "new_tier": "FREE"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription cancellation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )
