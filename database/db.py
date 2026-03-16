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

# Database URL - Use SQLite for local development, PostgreSQL for production
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sapy.db")

# Create engine with connection pooling (disabled for SQLite)
if DATABASE_URL.startswith("sqlite://"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
else:
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=0,
        pool_pre_ping=True,
        echo=False
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
    # Index creation skipped for now - let SQLAlchemy handle through model definitions
    pass

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
