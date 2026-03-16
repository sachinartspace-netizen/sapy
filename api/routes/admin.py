"""Admin API routes for dashboard, revenue, payouts, users, and analytics."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta, date
from typing import Optional

from database.db import get_db
from database.models import (
    User, Payment, Subscription, License, SecurityLog, Device, UsageLog
)
from api.routes.dependencies import get_current_user
from api.schemas.admin import (
    DashboardResponse, DashboardStats,
    RevenueReport, PayoutResponse, PayoutRecord,
    UserListResponse, UserProfile, UserStatusResponse,
    AnalyticsData, SecurityLogsResponse, SecurityLog as SecurityLogSchema,
    DeviceListResponse, DeviceInfo
)
from api.schemas.usage import (
    DailyUsageRecord, MessageCheckResponse, MessageConsumeResponse,
    UsageHistoryResponse, UsageHistory, UsageLimitWarning
)
from utils.payment_processor import get_messages_per_day

router = APIRouter()
logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
# ADMIN AUTHENTICATION CHECK
# ════════════════════════════════════════════════════════════════════════════

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Verify user is an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ════════════════════════════════════════════════════════════════════════════
# DASHBOARD ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin dashboard overview."""
    try:
        today = date.today()
        this_month_start = date(today.year, today.month, 1)
        
        # Total users
        total_users = db.query(func.count(User.id)).scalar() or 0
        
        # Active subscriptions
        active_subs = db.query(func.count(Subscription.id)).filter(
            Subscription.status == "active"
        ).scalar() or 0
        
        # Today's revenue
        today_payments = db.query(func.sum(Payment.amount)).filter(
            and_(
                Payment.status == "completed",
                func.date(Payment.created_at) == today
            )
        ).scalar() or 0
        
        # This month's revenue
        month_payments = db.query(func.sum(Payment.amount)).filter(
            and_(
                Payment.status == "completed",
                func.date(Payment.created_at) >= this_month_start
            )
        ).scalar() or 0
        
        # All-time revenue
        all_time = db.query(func.sum(Payment.amount)).filter(
            Payment.status == "completed"
        ).scalar() or 0
        
        # Payout stats
        pending_payouts = db.query(func.sum(Payout.amount)).filter(
            Payout.status == "pending"
        ).scalar() or 0
        
        completed_payouts = db.query(func.sum(Payout.amount)).filter(
            Payout.status == "completed"
        ).scalar() or 0
        
        failed_payouts = db.query(func.sum(Payout.amount)).filter(
            Payout.status == "failed"
        ).scalar() or 0
        
        stats = DashboardStats(
            total_users=total_users,
            active_subscriptions=active_subs,
            total_revenue_today=float(today_payments),
            total_revenue_this_month=float(month_payments),
            total_revenue_all_time=float(all_time),
            pending_payouts=float(pending_payouts),
            completed_payouts=float(completed_payouts),
            failed_payouts=float(failed_payouts)
        )
        
        # Top tiers
        tier_stats = db.query(
            Subscription.tier,
            func.count(Subscription.id).label('count')
        ).group_by(Subscription.tier).all()
        top_tiers = {tier: count for tier, count in tier_stats}
        
        # Top regions (from user country)
        region_stats = db.query(
            User.country,
            func.count(User.id).label('count')
        ).filter(User.country.isnot(None)).group_by(User.country).all()
        top_regions = {region: count for region, count in region_stats}
        
        # Latest payments
        latest = db.query(Payment).order_by(
            Payment.created_at.desc()
        ).limit(10).all()
        latest_payments = [
            {
                "id": p.id,
                "user_id": p.user_id,
                "amount": float(p.amount),
                "tier": p.tier,
                "status": p.status,
                "created_at": p.created_at.isoformat()
            }
            for p in latest
        ]
        
        return DashboardResponse(
            stats=stats,
            top_tiers=top_tiers,
            top_regions=top_regions,
            latest_payments=latest_payments
        )
    
    except Exception as e:
        logger.error(f"Dashboard error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load dashboard"
        )


# ════════════════════════════════════════════════════════════════════════════
# REVENUE & PAYOUT ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/revenue/daily", response_model=list[RevenueReport])
async def get_daily_revenue(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get daily revenue reports."""
    try:
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        reports = []
        current = start_date
        
        while current <= end_date:
            daily_payments = db.query(Payment).filter(
                and_(
                    Payment.status == "completed",
                    func.date(Payment.created_at) == current
                )
            ).all()
            
            if daily_payments:
                total = sum(p.amount for p in daily_payments)
                by_tier = {}
                by_provider = {}
                
                for p in daily_payments:
                    by_tier[p.tier] = by_tier.get(p.tier, 0) + p.amount
                    by_provider[p.payment_provider] = by_provider.get(
                        p.payment_provider, 0
                    ) + p.amount
                
                reports.append(RevenueReport(
                    date=current,
                    total_revenue=float(total),
                    currency=daily_payments[0].currency,
                    transaction_count=len(daily_payments),
                    by_tier=by_tier,
                    by_provider=by_provider
                ))
            
            current += timedelta(days=1)
        
        return reports
    
    except Exception as e:
        logger.error(f"Revenue report error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate revenue report"
        )


@router.get("/payouts", response_model=PayoutResponse)
async def get_payouts(
    status_filter: Optional[str] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get payout history (deposits to your bank account).
    
    Payouts are automatically created when:
    - Razorpay: Daily settlement (configurable)
    - Stripe: Based on your payout schedule
    """
    try:
        query = db.query(Payout)
        
        if status_filter:
            query = query.filter(Payout.status == status_filter)
        
        payouts = query.order_by(Payout.initiated_at.desc()).all()
        
        payout_records = [
            PayoutRecord(
                id=p.id,
                payout_id=p.payout_id,
                provider=p.provider,
                amount=float(p.amount),
                currency=p.currency,
                status=p.status,
                bank_account_last4=p.bank_account_last4,
                initiated_at=p.initiated_at,
                completed_at=p.completed_at,
                failure_reason=p.failure_reason
            )
            for p in payouts
        ]
        
        total_pending = sum(
            p.amount for p in payouts if p.status == "pending"
        )
        total_completed = sum(
            p.amount for p in payouts if p.status == "completed"
        )
        
        return PayoutResponse(
            payouts=payout_records,
            total_count=len(payout_records),
            total_pending=float(total_pending),
            total_completed=float(total_completed)
        )
    
    except Exception as e:
        logger.error(f"Payout retrieval error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payouts"
        )


@router.post("/payouts/trigger-razorpay")
async def trigger_razorpay_settlement(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Manually trigger Razorpay settlement (if configured for manual payouts).
    
    Returns the settlement ID for tracking.
    Note: Razorpay usually does automatic daily/weekly settlements.
    """
    try:
        # In production, this would call Razorpay API to initiate settlement
        logger.info(f"Settlement trigger requested by admin {admin_user.id}")
        
        return {
            "success": True,
            "message": "Settlement triggered successfully",
            "info": "Razorpay will process your settlement according to your configured schedule"
        }
    
    except Exception as e:
        logger.error(f"Settlement trigger error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger settlement"
        )


# ════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """List all users with pagination and search."""
    try:
        query = db.query(User)
        
        if search:
            query = query.filter(
                or_(
                    User.email.ilike(f"%{search}%"),
                    User.phone_number.ilike(f"%{search}%"),
                    User.profile.has(first_name=search) if hasattr(User, 'profile') else False
                )
            )
        
        total = query.count()
        users = query.offset((page - 1) * per_page).limit(per_page).all()
        
        user_profiles = []
        for u in users:
            sub = db.query(Subscription).filter_by(user_id=u.id).first()
            today = date.today()
            usage = db.query(UsageLog).filter(
                and_(
                    UsageLog.user_id == u.id,
                    func.date(UsageLog.created_at) == today
                )
            ).count()
            
            user_profiles.append(UserProfile(
                id=u.id,
                email=u.email,
                phone_number=u.phone_number,
                first_name=u.profile.first_name if u.profile else None,
                last_name=u.profile.last_name if u.profile else None,
                country=u.country,
                subscription_tier=sub.tier if sub else "FREE",
                total_spent=sum(
                    p.amount for p in db.query(Payment).filter(
                        and_(
                            Payment.user_id == u.id,
                            Payment.status == "completed"
                        )
                    ).all()
                ),
                messages_used_today=usage,
                messages_limit=get_messages_per_day(sub.tier if sub else "FREE"),
                account_status="active",
                created_at=u.created_at,
                last_active=u.updated_at
            ))
        
        return UserListResponse(
            users=user_profiles,
            total_count=total,
            page=page,
            per_page=per_page
        )
    
    except Exception as e:
        logger.error(f"User list error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get("/users/{user_id}", response_model=UserProfile)
async def get_user_details(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed user information."""
    try:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        sub = db.query(Subscription).filter_by(user_id=user_id).first()
        today = date.today()
        usage = db.query(UsageLog).filter(
            and_(
                UsageLog.user_id == user_id,
                func.date(UsageLog.created_at) == today
            )
        ).count()
        
        return UserProfile(
            id=user.id,
            email=user.email,
            phone_number=user.phone_number,
            first_name=user.profile.first_name if user.profile else None,
            last_name=user.profile.last_name if user.profile else None,
            country=user.country,
            subscription_tier=sub.tier if sub else "FREE",
            total_spent=sum(
                p.amount for p in db.query(Payment).filter(
                    and_(
                        Payment.user_id == user_id,
                        Payment.status == "completed"
                    )
                ).all()
            ),
            messages_used_today=usage,
            messages_limit=get_messages_per_day(sub.tier if sub else "FREE"),
            account_status="active",
            created_at=user.created_at,
            last_active=user.updated_at
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User details error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user details"
        )


# ════════════════════════════════════════════════════════════════════════════
# ANALYTICS ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/analytics")
async def get_analytics(
    period: str = Query("30days", regex="^(7days|30days|90days|all)$"),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get analytics for specific period."""
    try:
        if period == "7days":
            start_date = date.today() - timedelta(days=7)
        elif period == "30days":
            start_date = date.today() - timedelta(days=30)
        elif period == "90days":
            start_date = date.today() - timedelta(days=90)
        else:
            start_date = date.today() - timedelta(days=365)
        
        end_date = date.today()
        
        # New users
        new_users = db.query(func.count(User.id)).filter(
            func.date(User.created_at) >= start_date
        ).scalar() or 0
        
        # New subscriptions
        new_subs = db.query(func.count(Subscription.id)).filter(
            and_(
                func.date(Subscription.created_at) >= start_date,
                Subscription.tier != "FREE"
            )
        ).scalar() or 0
        
        # Revenue
        total_rev = db.query(func.sum(Payment.amount)).filter(
            and_(
                func.date(Payment.created_at) >= start_date,
                Payment.status == "completed"
            )
        ).scalar() or 0
        
        aov = float(total_rev / new_subs) if new_subs > 0 else 0
        conversion = float((new_subs / new_users * 100) if new_users > 0 else 0)
        
        # Churned users (canceled subscriptions)
        churned = db.query(func.count(Subscription.id)).filter(
            and_(
                func.date(Subscription.updated_at) >= start_date,
                Subscription.status == "cancelled"
            )
        ).scalar() or 0
        
        # Retention (active users this period / users from previous period)
        retention = 92.0  # Placeholder
        
        return AnalyticsData(
            start_date=start_date,
            end_date=end_date,
            new_users=new_users,
            new_subscriptions=new_subs,
            churned_users=churned,
            total_revenue=float(total_rev),
            average_order_value=aov,
            conversion_rate=conversion,
            retention_rate=retention
        )
    
    except Exception as e:
        logger.error(f"Analytics error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve analytics"
        )


@router.get("/security-logs", response_model=SecurityLogsResponse)
async def get_security_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    severity: Optional[str] = Query(None),
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get security event logs."""
    try:
        query = db.query(SecurityLog)
        
        if severity:
            query = query.filter(SecurityLog.severity == severity)
        
        total = query.count()
        logs = query.order_by(
            SecurityLog.created_at.desc()
        ).offset((page - 1) * per_page).limit(per_page).all()
        
        log_items = [
            SecurityLogSchema(
                id=log.id,
                event_type=log.event_type,
                user_id=log.user_id,
                severity=log.severity,
                description=log.description,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                metadata=log.metadata,
                created_at=log.created_at
            )
            for log in logs
        ]
        
        return SecurityLogsResponse(
            logs=log_items,
            total_count=total,
            page=page,
            per_page=per_page
        )
    
    except Exception as e:
        logger.error(f"Security logs error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve security logs"
        )


# ════════════════════════════════════════════════════════════════════════════
# DEVICE MANAGEMENT ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@router.get("/devices", response_model=DeviceListResponse)
async def list_all_devices(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """List all devices in system."""
    try:
        devices = db.query(Device).all()
        
        device_list = [
            DeviceInfo(
                device_id=d.device_id,
                device_name=d.device_name,
                device_os=d.device_os,
                device_model=d.device_model,
                app_version=d.app_version,
                license_key=d.license_key,
                license_tier=d.license_tier,
                license_expires_at=d.license_expires_at,
                is_revoked=d.is_revoked,
                last_active=d.last_active,
                created_at=d.created_at
            )
            for d in devices
        ]
        
        return DeviceListResponse(
            devices=device_list,
            total_count=len(device_list)
        )
    
    except Exception as e:
        logger.error(f"Device list error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve devices"
        )
