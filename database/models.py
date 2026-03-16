"""
SQLAlchemy ORM models for Sapy AI Backend
Complete schema for users, subscriptions, payments, usage, and analytics
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from database.db import Base
from datetime import datetime
import enum

# ============================================================================
# USERS & AUTHENTICATION
# ============================================================================

class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)  # For future phone+password auth
    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    country = Column(String(2), nullable=True)  # ISO country code
    is_admin = Column(Boolean, default=False)  # Admin flag for access control
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    subscriptions = relationship("Subscription", back_populates="user")
    licenses = relationship("License", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    daily_usage = relationship("DailyUsage", back_populates="user")
    usage_logs = relationship("UsageLog", back_populates="user")

class UserProfile(Base):
    """Extended user profile information"""
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    preferences = Column(JSON, default={})  # Flexible preferences object
    profile_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="profile")

# ============================================================================
# SUBSCRIPTIONS & LICENSES
# ============================================================================

class PlanTier(str, enum.Enum):
    """Subscription plan tiers"""
    FREE = "free"
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"

class SubscriptionStatus(str, enum.Enum):
    """Subscription status"""
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    SUSPENDED = "suspended"  # For abuse

class Subscription(Base):
    """User subscription (active plan)"""
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    tier = Column(String(20), default="FREE", index=True)  # FREE, BASIC, STANDARD, PREMIUM
    status = Column(String(20), default="active", index=True)  # active, inactive, cancelled, expired
    billing_cycle = Column(String(20), default="monthly")  # monthly or annual
    auto_renew = Column(Boolean, default=True)
    payment_method = Column(String(20), nullable=True)  # razorpay, stripe
    next_billing_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="subscriptions")

class License(Base):
    """Device license key (for offline validation)"""
    __tablename__ = "licenses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    device_id = Column(String(255), index=True)  # SHA256 hash of device fingerprint
    license_key = Column(String(500), unique=True, index=True)  # Format: SAPY-XXXX-XXXX-XXXX
    tier = Column(String(20))  # FREE, BASIC, STANDARD, PREMIUM
    expiry_date = Column(DateTime, index=True)
    device_name = Column(String(255), nullable=True)  # iPhone, Samsung Galaxy, MacBook
    device_os = Column(String(100), nullable=True)  # iOS, Android, macOS, Windows
    created_at = Column(DateTime, default=datetime.utcnow)
    last_validated = Column(DateTime, nullable=True)
    is_revoked = Column(Boolean, default=False)
    
    # Relationships
    user = relationship("User", back_populates="licenses")

class LicenseValidationLog(Base):
    """Log all license validation attempts (for security)"""
    __tablename__ = "license_validation_log"
    
    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(String(500), index=True)
    device_id = Column(String(255), index=True)
    validation_result = Column(String(50))  # "valid", "invalid", "expired", "revoked", "tampered"
    reason = Column(String(500), nullable=True)
    attempted_at = Column(DateTime, default=datetime.utcnow, index=True)
    request_ip = Column(String(50), nullable=True)

# ============================================================================
# PAYMENTS & REFUNDS
# ============================================================================

class PaymentGateway(str, enum.Enum):
    """Payment processor"""
    RAZORPAY = "razorpay"
    STRIPE = "stripe"

class PaymentStatus(str, enum.Enum):
    """Payment status"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    REFUNDED = "refunded"

class Payment(Base):
    """Payment transaction"""
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    # Payment provider & order
    payment_provider = Column(String(20), index=True)  # razorpay or stripe
    order_id = Column(String(255), index=True)  # Provider's order ID
    
    # Amount
    amount = Column(Float)  # In local currency
    currency = Column(String(3))  # "USD", "INR"
    
    # Status
    status = Column(String(20), default="pending", index=True)  # pending, completed, failed, refunded
    tier = Column(String(20))  # BASIC, STANDARD, PREMIUM
    billing_cycle = Column(String(20), nullable=True)  # monthly, annual
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="payments")

class PaymentWebhook(Base):
    """Raw webhook data from payment processors"""
    __tablename__ = "payment_webhooks"
    
    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)
    gateway = Column(String(20), index=True)
    event_type = Column(String(100), index=True)  # "payment.authorized", "charge.refunded"
    raw_data = Column(JSON)  # Full webhook payload
    processed = Column(Boolean, default=False)
    error = Column(String(500), nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    processed_at = Column(DateTime, nullable=True)

class Refund(Base):
    """Refund transactions"""
    __tablename__ = "refunds"
    
    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), index=True)
    amount_usd = Column(Float)
    amount_local = Column(Float)
    currency = Column(String(3))
    reason = Column(String(500))  # "User requested", "Chargeback"
    status = Column(String(20))  # "pending", "approved", "rejected", "completed"
    gateway_refund_id = Column(String(255), nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

# ============================================================================
# USAGE & MESSAGE LIMITS
# ============================================================================

class DailyUsage(Base):
    """Daily message count per user"""
    __tablename__ = "daily_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    date = Column(String(10), index=True)  # "2026-03-15" (UTC)
    messages_used = Column(Integer, default=0)  # Number of messages today
    messages_limit = Column(Integer)  # Based on current subscription
    reset_at = Column(DateTime)  # When limit resets (midnight UTC)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="daily_usage")

class UsageLog(Base):
    """Individual message log (for analytics)"""
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    message_id = Column(String(255), unique=True, index=True)  # UUID from app
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    tokens_used = Column(Integer)  # Actual tokens in response
    device_id = Column(String(255), nullable=True)  # Device that sent message
    request_ip = Column(String(50), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="usage_logs")

class LimitOverrideHistory(Base):
    """Admin overrides of message limits (for support/abuse)"""
    __tablename__ = "limit_override_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    old_limit = Column(Integer)
    new_limit = Column(Integer)
    reason = Column(String(500))  # "Support request", "Abuse suspension"
    changed_by = Column(String(255))  # Admin email
    changed_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)  # Temporary overrides

# ============================================================================
# ANALYTICS & REVENUE
# ============================================================================

class RevenueDaily(Base):
    """Daily revenue summary"""
    __tablename__ = "revenue_daily"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), unique=True, index=True)  # "2026-03-15"
    total_payments = Column(Integer, default=0)  # Count of successful payments
    total_amount_usd = Column(Float, default=0.0)
    total_amount_inr = Column(Float, default=0.0)
    gateway_fees_usd = Column(Float, default=0.0)  # Razorpay + Stripe fees
    net_amount_usd = Column(Float, default=0.0)  # After fees
    refunds_count = Column(Integer, default=0)
    refunds_amount_usd = Column(Float, default=0.0)
    active_users = Column(Integer, default=0)
    new_users = Column(Integer, default=0)
    chargeback_count = Column(Integer, default=0)
    chargeback_amount_usd = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserAnalytics(Base):
    """User engagement analytics"""
    __tablename__ = "user_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    last_message_date = Column(DateTime, nullable=True)
    lifetime_messages = Column(Integer, default=0)
    days_since_signup = Column(Integer, default=0)
    churn_risk = Column(String(20))  # "low", "medium", "high"
    lifetime_spent_usd = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChargebackLog(Base):
    """Chargeback and dispute tracking"""
    __tablename__ = "chargeback_log"
    
    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    amount_usd = Column(Float)
    gateway = Column(String(20))
    case_id = Column(String(255), unique=True)
    status = Column(String(50))  # "under_review", "won", "lost"
    reason = Column(String(500))
    reported_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

# ============================================================================
# ADMIN & SETTINGS
# ============================================================================

class AdminSettings(Base):
    """Global app settings (key-value store)"""
    __tablename__ = "admin_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, index=True)
    value = Column(Text)
    last_updated_by = Column(String(255), nullable=True)  # Admin email
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    description = Column(String(500), nullable=True)

class FeatureFlag(Base):
    """Feature flags for A/B testing and gradual rollout"""
    __tablename__ = "feature_flags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)
    enabled = Column(Boolean, default=False)
    rollout_percentage = Column(Integer, default=0)  # 0-100
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# PROMOTIONAL OFFERS & DISCOUNTS
# ============================================================================

class PromotionalOffer(Base):
    """New user promotional offer tracking"""
    __tablename__ = "promotional_offers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    offer_type = Column(String(50), default="NEW_USER_BASIC")  # Type of offer
    original_price = Column(Float)  # Original price (₹249)
    discounted_price = Column(Float)  # Discounted price (₹49)
    discount_percentage = Column(Integer)  # 80% off
    tier = Column(String(20))  # "BASIC", "STANDARD", "PREMIUM"
    duration_days = Column(Integer, default=30)  # 30 days for ₹49
    
    # Status tracking
    offer_shown_at = Column(DateTime, nullable=True)  # When user first saw notification
    offer_used_at = Column(DateTime, nullable=True)  # When user claimed offer
    offer_expires_at = Column(DateTime, nullable=True)  # When offer expires (30 days after first purchase)
    is_claimed = Column(Boolean, default=False, index=True)  # Whether user used offer
    is_expired = Column(Boolean, default=False, index=True)  # Whether offer expired
    
    # After offer period
    auto_renewal_price = Column(Float)  # Price after offer ends (normal ₹249)
    auto_renewal_date = Column(DateTime, nullable=True)  # When auto-renewal to normal price happens
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# PAYOUTS & SETTLEMENTS
# ============================================================================

class Payout(Base):
    """Bank account payouts (money deposited to your account)"""
    __tablename__ = "payouts"
    
    id = Column(Integer, primary_key=True, index=True)
    payout_id = Column(String(255), unique=True, index=True)  # Provider's payout ID
    provider = Column(String(20), index=True)  # "razorpay" or "stripe"
    amount = Column(Float, index=True)  # Amount in rupees/dollars
    currency = Column(String(3), default="INR")
    bank_account_last4 = Column(String(4))  # Last 4 digits of account
    status = Column(String(20), index=True)  # "pending", "processing", "completed", "failed", "cancelled"
    initiated_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    failure_reason = Column(String(500), nullable=True)  # Why payout failed
    metadata = Column(JSON, nullable=True)  # Additional provider data


# ============================================================================
# SECURITY & AUDIT LOGS
# ============================================================================

class SecurityLog(Base):
    """Security event logging (tampering, fraud, failed auth, etc)"""
    __tablename__ = "security_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), index=True)  # "license_tamper", "payment_fraud", "failed_auth"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    severity = Column(String(20), index=True)  # "low", "medium", "high", "critical"
    description = Column(String(500))
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    metadata = Column(JSON, nullable=True)  # Additional context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ============================================================================
# DEVICE TRACKING
# ============================================================================

class Device(Base):
    """Track devices and their licenses"""
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    device_id = Column(String(255), index=True)  # SHA256 hash of fingerprint
    device_name = Column(String(255))  # "iPhone 12 Pro", "Samsung Galaxy S21"
    device_os = Column(String(50))  # "iOS", "Android", "macOS", "Windows"
    device_model = Column(String(100))  # "iPhone12,1", "SM-G991B"
    app_version = Column(String(20))  # "1.0.0", "1.2.3"
    license_key = Column(String(500), nullable=True)
    license_tier = Column(String(20), nullable=True)  # Current tier on device
    license_expires_at = Column(DateTime, nullable=True)
    is_revoked = Column(Boolean, default=False, index=True)
    last_active = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
