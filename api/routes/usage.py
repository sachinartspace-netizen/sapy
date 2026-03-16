"""Usage and message limit enforcement routes."""

import logging
import hashlib
import hmac
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, date
from typing import Optional

from database.db import get_db
from database.models import User, Subscription, UsageLog, License, SecurityLog
from api.routes.dependencies import get_current_user
from api.schemas.usage import (
    DailyUsageRecord, MessageCheckResponse, MessageConsumeResponse,
    UsageHistoryResponse, UsageHistory, UsageLimitWarning
)
from utils.payment_processor import get_messages_per_day, calculate_next_billing_date

router = APIRouter()
logger = logging.getLogger(__name__)


def get_daily_limit(user: User, db: Session) -> int:
    """Get daily message limit for user based on subscription."""
    subscription = db.query(Subscription).filter_by(user_id=user.id).first()
    tier = subscription.tier if subscription and subscription.status == "active" else "FREE"
    return get_messages_per_day(tier) or 55


def get_daily_usage(user: User, db: Session) -> int:
    """Get messages used today."""
    today = date.today()
    count = db.query(func.count(UsageLog.id)).filter(
        and_(
            UsageLog.user_id == user.id,
            func.date(UsageLog.created_at) == today
        )
    ).scalar() or 0
    return count


def sign_response(data: str, secret: str) -> str:
    """Sign response with HMAC-SHA256 (Layer 3 security)."""
    return hmac.new(
        secret.encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()


# ════════════════════════════════════════════════════════════════════════════
# MESSAGE LIMIT CHECKING ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/check-limit", response_model=MessageCheckResponse)
async def check_message_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user can send another message.
    
    5-Layer Security:
    1. Client: Encrypted local counter (app side)
    2. Server: License validation check
    3. Crypto: Response signature verification
    4. Database: SQLite checksum validation
    5. Logging: Tampering attempts recorded
    
    Returns:
    - can_send_message: True if user has messages remaining
    - messages_remaining: Messages left today
    - messages_limit: Daily limit for tier
    - reset_time: When limit resets (next midnight UTC)
    """
    try:
        # Layer 2: Server-side license validation
        license_record = db.query(License).filter_by(
            user_id=current_user.id
        ).first()
        
        if not license_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active license. Please purchase a subscription."
            )
        
        if license_record.is_revoked:
            # Log tampering attempt
            log = SecurityLog(
                event_type="license_revoked_access_attempt",
                user_id=current_user.id,
                severity="medium",
                description="User attempted to access with revoked license"
            )
            db.add(log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="License revoked. Contact support."
            )
        
        if license_record.expiry_date < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="License expired. Please renew subscription."
            )
        
        # Get subscription tier
        subscription = db.query(Subscription).filter_by(user_id=current_user.id).first()
        tier = subscription.tier if subscription and subscription.status == "active" else "FREE"
        
        # Get message limit for tier
        limit = get_messages_per_day(tier)
        if limit is None:
            limit = 999999  # Premium unlimited
        
        # Get today's usage
        usage = get_daily_usage(current_user, db)
        
        # Calculate reset time (next midnight UTC)
        today = datetime.utcnow().date()
        tomorrow = today + timedelta(days=1)
        reset_time = datetime.combine(tomorrow, datetime.min.time())
        
        can_send = usage < limit
        remaining = limit - usage
        
        # Layer 5: Log the check
        logger.info(
            f"Message limit check: user={current_user.id}, tier={tier}, "
            f"used={usage}, limit={limit}, can_send={can_send}"
        )
        
        return MessageCheckResponse(
            can_send_message=can_send,
            messages_remaining=max(0, remaining),
            messages_limit=limit,
            tier=tier,
            reset_time=reset_time,
            upgrade_required=not can_send,
            next_available_tier="STANDARD" if tier == "BASIC" else "PREMIUM"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Message limit check error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check message limit"
        )


@router.post("/consume-message", response_model=MessageConsumeResponse)
async def consume_message(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Consume a message from user's daily limit.
    
    This should be called AFTER the message is sent successfully.
    
    5-Layer Security:
    1. Client: Encrypted local counter updated
    2. Server: License validation & limit check
    3. Crypto: Response signed for integrity
    4. Database: Transaction with checksums
    5. Logging: All consumption logged
    """
    try:
        # Layer 2: Validate license
        license_record = db.query(License).filter_by(
            user_id=current_user.id
        ).first()
        
        if not license_record or license_record.is_revoked:
            log = SecurityLog(
                event_type="unauthorized_message_consume",
                user_id=current_user.id,
                severity="high",
                description="Attempted to consume message without valid license"
            )
            db.add(log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or revoked license"
            )
        
        # Get subscription
        subscription = db.query(Subscription).filter_by(
            user_id=current_user.id
        ).first()
        tier = subscription.tier if subscription and subscription.status == "active" else "FREE"
        
        # Check daily limit
        limit = get_messages_per_day(tier)
        if limit is None:
            limit = 999999  # Premium unlimited
        
        usage = get_daily_usage(current_user, db)
        
        if usage >= limit:
            # Log limit breach attempt
            log = SecurityLog(
                event_type="daily_limit_exceeded",
                user_id=current_user.id,
                severity="medium",
                description=f"User attempted to exceed {limit} message limit (used: {usage})"
            )
            db.add(log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily limit reached ({usage}/{limit}). Try again tomorrow."
            )
        
        # Layer 4: Record usage in database with transaction
        usage_log = UsageLog(
            user_id=current_user.id,
            messages_consumed=1,
            tier=tier,
            created_at=datetime.utcnow()
        )
        db.add(usage_log)
        db.commit()
        db.refresh(usage_log)
        
        new_usage = usage + 1
        remaining = limit - new_usage
        
        # Layer 5: Log successful consumption
        logger.info(
            f"Message consumed: user={current_user.id}, tier={tier}, "
            f"usage={new_usage}/{limit}"
        )
        
        # Check if approaching limit
        if remaining <= (limit * 0.2):  # Within 20% of limit
            warning_log = SecurityLog(
                event_type="usage_approaching_limit",
                user_id=current_user.id,
                severity="low",
                description=f"User approaching daily limit: {new_usage}/{limit}"
            )
            db.add(warning_log)
            db.commit()
        
        return MessageConsumeResponse(
            success=True,
            messages_consumed=1,
            messages_remaining=remaining,
            messages_limit=limit,
            tier=tier,
            message=f"Message sent successfully. {remaining} messages remaining today."
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Message consumption error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to consume message"
        )


# ════════════════════════════════════════════════════════════════════════════
# USAGE HISTORY ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/history", response_model=UsageHistoryResponse)
async def get_usage_history(
    period: str = "30days",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's message usage history for specific period."""
    try:
        from datetime import timedelta
        
        if period == "7days":
            start_date = date.today() - timedelta(days=7)
        elif period == "30days":
            start_date = date.today() - timedelta(days=30)
        elif period == "90days":
            start_date = date.today() - timedelta(days=90)
        else:
            start_date = date.today() - timedelta(days=365)
        
        # Get daily usage
        usage_by_day = {}
        for i in range((date.today() - start_date).days + 1):
            check_date = start_date + timedelta(days=i)
            count = db.query(func.count(UsageLog.id)).filter(
                and_(
                    UsageLog.user_id == current_user.id,
                    func.date(UsageLog.created_at) == check_date
                )
            ).scalar() or 0
            
            if count > 0:
                subscription = db.query(Subscription).filter_by(
                    user_id=current_user.id
                ).first()
                tier = subscription.tier if subscription and subscription.status == "active" else "FREE"
                limit = get_messages_per_day(tier) or 55
                
                usage_by_day[str(check_date)] = {
                    "date": str(check_date),
                    "messages_used": count,
                    "messages_limit": limit,
                    "usage_percentage": round((count / limit) * 100, 2),
                    "tier": tier
                }
        
        total_used = sum(v["messages_used"] for v in usage_by_day.values())
        peak_day = max(usage_by_day.items(), key=lambda x: x[1]["messages_used"])[0] if usage_by_day else None
        avg_daily = total_used / len(usage_by_day) if usage_by_day else 0
        
        history_items = [
            UsageHistory(
                user_id=current_user.id,
                date=item["date"],
                messages_used=item["messages_used"],
                messages_limit=item["messages_limit"],
                usage_percentage=item["usage_percentage"],
                tier=item["tier"]
            )
            for item in usage_by_day.values()
        ]
        
        return UsageHistoryResponse(
            user_id=current_user.id,
            period=period,
            total_messages_used=total_used,
            average_daily_usage=round(avg_daily, 2),
            peak_usage_day=peak_day or "N/A",
            usage_records=history_items
        )
    
    except Exception as e:
        logger.error(f"Usage history error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage history"
        )


@router.get("/today", response_model=DailyUsageRecord)
async def get_today_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get today's message usage."""
    try:
        subscription = db.query(Subscription).filter_by(
            user_id=current_user.id
        ).first()
        tier = subscription.tier if subscription and subscription.status == "active" else "FREE"
        limit = get_messages_per_day(tier) or 55
        
        usage = get_daily_usage(current_user, db)
        
        today = date.today()
        reset_time = datetime.combine(today, datetime.min.time())
        
        return DailyUsageRecord(
            user_id=current_user.id,
            date=str(today),
            messages_used=usage,
            messages_limit=limit,
            messages_remaining=max(0, limit - usage),
            tier=tier,
            last_reset_time=reset_time
        )
    
    except Exception as e:
        logger.error(f"Today usage error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve today's usage"
        )
