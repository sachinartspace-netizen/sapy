"""Admin API request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# ════════════════════════════════════════════════════════════════════════════
# DASHBOARD SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class DashboardStats(BaseModel):
    """Dashboard overview statistics."""
    
    total_users: int
    active_subscriptions: int
    total_revenue_today: float
    total_revenue_this_month: float
    total_revenue_all_time: float
    pending_payouts: float
    completed_payouts: float
    failed_payouts: float
    
    class Config:
        schema_extra = {
            "example": {
                "total_users": 1250,
                "active_subscriptions": 450,
                "total_revenue_today": 5420.50,
                "total_revenue_this_month": 145320.75,
                "total_revenue_all_time": 450000.00,
                "pending_payouts": 25000.00,
                "completed_payouts": 425000.00,
                "failed_payouts": 0.00
            }
        }


class DashboardResponse(BaseModel):
    """Admin dashboard response."""
    
    stats: DashboardStats
    top_tiers: dict
    top_regions: dict
    latest_payments: List[dict]
    
    class Config:
        schema_extra = {
            "example": {
                "stats": {
                    "total_users": 1250,
                    "active_subscriptions": 450,
                    "total_revenue_today": 5420.50,
                    "total_revenue_this_month": 145320.75,
                    "total_revenue_all_time": 450000.00,
                    "pending_payouts": 25000.00,
                    "completed_payouts": 425000.00,
                    "failed_payouts": 0.00
                },
                "top_tiers": {"BASIC": 200, "STANDARD": 150, "PREMIUM": 100},
                "top_regions": {"IN": 250, "US": 150, "GB": 50},
                "latest_payments": []
            }
        }


# ════════════════════════════════════════════════════════════════════════════
# REVENUE & PAYOUT SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class RevenueReport(BaseModel):
    """Daily/monthly revenue report."""
    
    date: date
    total_revenue: float
    currency: str
    transaction_count: int
    by_tier: dict = Field(..., description="Revenue breakdown by tier")
    by_provider: dict = Field(..., description="Revenue breakdown by provider (razorpay/stripe)")
    
    class Config:
        schema_extra = {
            "example": {
                "date": "2026-03-15",
                "total_revenue": 145320.75,
                "currency": "INR",
                "transaction_count": 156,
                "by_tier": {"BASIC": 50000, "STANDARD": 60000, "PREMIUM": 35320.75},
                "by_provider": {"razorpay": 100000, "stripe": 45320.75}
            }
        }


class PayoutRecord(BaseModel):
    """Bank account payout record."""
    
    id: int
    payout_id: str = Field(..., description="Provider payout ID")
    provider: str = Field(..., description="razorpay or stripe")
    amount: float
    currency: str
    status: str = Field(..., description="pending, processing, completed, failed, cancelled")
    bank_account_last4: str
    initiated_at: datetime
    completed_at: Optional[datetime]
    failure_reason: Optional[str]
    
    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "payout_id": "pout_123456789",
                "provider": "razorpay",
                "amount": 50000.00,
                "currency": "INR",
                "status": "completed",
                "bank_account_last4": "1234",
                "initiated_at": "2026-03-15T10:00:00",
                "completed_at": "2026-03-16T10:30:00",
                "failure_reason": None
            }
        }


class PayoutResponse(BaseModel):
    """Response with payout details."""
    
    payouts: List[PayoutRecord]
    total_count: int
    total_pending: float
    total_completed: float
    
    class Config:
        schema_extra = {
            "example": {
                "payouts": [],
                "total_count": 0,
                "total_pending": 0.00,
                "total_completed": 0.00
            }
        }


# ════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class UserProfile(BaseModel):
    """User profile information."""
    
    id: int
    email: str
    phone_number: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    country: Optional[str]
    subscription_tier: str
    total_spent: float
    messages_used_today: int
    messages_limit: Optional[int]
    account_status: str = Field(..., description="active, suspended, deleted")
    created_at: datetime
    last_active: Optional[datetime]
    
    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "email": "user@example.com",
                "phone_number": "+919876543210",
                "first_name": "John",
                "last_name": "Doe",
                "country": "IN",
                "subscription_tier": "BASIC",
                "total_spent": 249.00,
                "messages_used_today": 45,
                "messages_limit": 155,
                "account_status": "active",
                "created_at": "2026-03-15T13:34:00",
                "last_active": "2026-03-15T13:34:00"
            }
        }


class UserListResponse(BaseModel):
    """Response with user list."""
    
    users: List[UserProfile]
    total_count: int
    page: int
    per_page: int
    
    class Config:
        schema_extra = {
            "example": {
                "users": [],
                "total_count": 0,
                "page": 1,
                "per_page": 50
            }
        }


class UserSuspendRequest(BaseModel):
    """Request to suspend a user account."""
    
    reason: str
    duration_days: Optional[int] = Field(None, description="None for permanent")


class UserStatusResponse(BaseModel):
    """Response for user status change."""
    
    user_id: int
    previous_status: str
    new_status: str
    reason: Optional[str]
    changed_at: datetime


# ════════════════════════════════════════════════════════════════════════════
# ANALYTICS SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class AnalyticsData(BaseModel):
    """Analytics data for specific period."""
    
    start_date: date
    end_date: date
    new_users: int
    new_subscriptions: int
    churned_users: int
    total_revenue: float
    average_order_value: float
    conversion_rate: float
    retention_rate: float
    
    class Config:
        schema_extra = {
            "example": {
                "start_date": "2026-03-01",
                "end_date": "2026-03-15",
                "new_users": 145,
                "new_subscriptions": 89,
                "churned_users": 12,
                "total_revenue": 145320.75,
                "average_order_value": 1634.50,
                "conversion_rate": 61.4,
                "retention_rate": 92.0
            }
        }


class SecurityLog(BaseModel):
    """Security event log."""
    
    id: int
    event_type: str = Field(..., description="license_tamper, payment_fraud, failed_auth, etc")
    user_id: Optional[int]
    severity: str = Field(..., description="low, medium, high, critical")
    description: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    metadata: Optional[dict]
    created_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "event_type": "failed_auth",
                "user_id": 1,
                "severity": "low",
                "description": "Failed login attempt from unknown IP",
                "ip_address": "192.168.1.1",
                "user_agent": "Mozilla/5.0...",
                "metadata": {"attempts": 3},
                "created_at": "2026-03-15T13:34:00"
            }
        }


class SecurityLogsResponse(BaseModel):
    """Response with security logs."""
    
    logs: List[SecurityLog]
    total_count: int
    page: int
    per_page: int
    
    class Config:
        schema_extra = {
            "example": {
                "logs": [],
                "total_count": 0,
                "page": 1,
                "per_page": 50
            }
        }


# ════════════════════════════════════════════════════════════════════════════
# DEVICE MANAGEMENT SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

class DeviceInfo(BaseModel):
    """Device information."""
    
    device_id: str
    device_name: str
    device_os: str
    device_model: str
    app_version: str
    license_key: str
    license_tier: str
    license_expires_at: datetime
    is_revoked: bool
    last_active: Optional[datetime]
    created_at: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "device_id": "abc123...",
                "device_name": "iPhone 12 Pro",
                "device_os": "iOS",
                "device_model": "iPhone12,1",
                "app_version": "1.0.0",
                "license_key": "SAPY-ABC1-DEF2-GHI3-JKL4",
                "license_tier": "BASIC",
                "license_expires_at": "2027-03-15T13:34:00",
                "is_revoked": False,
                "last_active": "2026-03-15T13:34:00",
                "created_at": "2026-03-15T13:34:00"
            }
        }


class DeviceListResponse(BaseModel):
    """Response with device list."""
    
    devices: List[DeviceInfo]
    total_count: int
    
    class Config:
        schema_extra = {
            "example": {
                "devices": [],
                "total_count": 0
            }
        }
