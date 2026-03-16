"""
Database setup and initialization for PostgreSQL
Handles connection pooling, migrations, and schema creation
"""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sapy:sapy_password@localhost:5432/sapy_db")

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True,  # Verify connections before using
    echo=False  # Set to True for SQL debugging
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
Base = declarative_base()

# Dependency for getting DB session
def get_db():
    """Get database session for API routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initialize database:
    1. Create all tables from models
    2. Create indexes
    3. Initialize default data
    """
    # Import models here to avoid circular imports
    from database.models import (
        User, UserProfile, Subscription, License,
        Payment, PaymentWebhook, Refund,
        DailyUsage, UsageLog, LimitOverrideHistory,
        RevenueDaily, UserAnalytics, ChargebackLog,
        AdminSettings, FeatureFlag, LicenseValidationLog
    )
    
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
        
        # Create indexes
        create_indexes()
        print("✅ Database indexes created")
        
        # Initialize default settings
        initialize_default_settings()
        print("✅ Default settings initialized")
        
    except Exception as e:
        print(f"❌ Database initialization error: {e}")
        raise

def create_indexes():
    """Create important indexes for performance"""
    with engine.connect() as conn:
        # User lookups
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
        
        # License validation
        conn.execute("CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_licenses_device_id ON licenses(device_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key)")
        
        # Payment tracking
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)")
        
        # Usage tracking
        conn.execute("CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id)")
        
        # Subscriptions
        conn.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)")
        
        conn.commit()

def initialize_default_settings():
    """Create default admin settings and feature flags"""
    from database.models import AdminSettings, FeatureFlag
    from datetime import datetime
    
    db = SessionLocal()
    try:
        # Check if already initialized
        existing = db.query(AdminSettings).first()
        if existing:
            return
        
        # Default settings
        settings = [
            AdminSettings(key="app_name", value="Sapy AI"),
            AdminSettings(key="version", value="2.0.0"),
            AdminSettings(key="payment_processing_enabled", value="true"),
            AdminSettings(key="google_oauth_enabled", value="true"),
            AdminSettings(key="phone_oauth_enabled", value="true"),
            AdminSettings(key="offline_mode_enabled", value="true"),
            AdminSettings(key="message_limit_enforcement", value="true"),
        ]
        
        # Feature flags
        flags = [
            FeatureFlag(name="google_oauth", enabled=True, rollout_percentage=100),
            FeatureFlag(name="phone_oauth", enabled=True, rollout_percentage=100),
            FeatureFlag(name="razorpay_payments", enabled=True, rollout_percentage=100),
            FeatureFlag(name="stripe_payments", enabled=True, rollout_percentage=100),
            FeatureFlag(name="offline_license_validation", enabled=True, rollout_percentage=100),
        ]
        
        db.add_all(settings)
        db.add_all(flags)
        db.commit()
        
    except Exception as e:
        db.rollback()
        print(f"⚠️  Could not initialize default settings: {e}")
    finally:
        db.close()

def reset_database():
    """
    DANGER: Drop all tables and recreate
    Only use in development!
    """
    if os.getenv("ENVIRONMENT") != "development":
        raise Exception("Database reset only allowed in development mode")
    
    Base.metadata.drop_all(bind=engine)
    init_db()
    print("🔄 Database reset complete")
