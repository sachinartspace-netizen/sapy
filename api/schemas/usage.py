"""Usage and message limit tracking schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DailyUsageRecord(BaseModel):
    """Daily usage record for a user."""
    
    user_id: int
    date: str = Field(..., description="YYYY-MM-DD format")
    messages_used: int
    messages_limit: int
    messages_remaining: int
    tier: str
    last_reset_time: datetime
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": 1,
                "date": "2026-03-15",
                "messages_used": 45,
                "messages_limit": 155,
                "messages_remaining": 110,
                "tier": "BASIC",
                "last_reset_time": "2026-03-15T00:00:00"
            }
        }


class MessageCheckRequest(BaseModel):
    """Request to check if user can send a message."""
    
    device_id: Optional[str] = Field(None, description="Device fingerprint")
    
    class Config:
        schema_extra = {
            "example": {
                "device_id": "abc123..."
            }
        }


class MessageCheckResponse(BaseModel):
    """Response for message availability check."""
    
    can_send_message: bool
    messages_remaining: int
    messages_limit: int
    tier: str
    reset_time: datetime
    upgrade_required: bool = Field(False, description="True if user hit limit")
    next_available_tier: Optional[str] = Field(None, description="Suggested tier to upgrade")
    
    class Config:
        schema_extra = {
            "example": {
                "can_send_message": True,
                "messages_remaining": 110,
                "messages_limit": 155,
                "tier": "BASIC",
                "reset_time": "2026-03-16T00:00:00",
                "upgrade_required": False,
                "next_available_tier": None
            }
        }


class MessageConsumeRequest(BaseModel):
    """Request to consume a message from daily limit."""
    
    messages_to_consume: int = Field(default=1, description="Number of messages to use")
    device_id: Optional[str] = Field(None, description="Device fingerprint")
    
    class Config:
        schema_extra = {
            "example": {
                "messages_to_consume": 1,
                "device_id": "abc123..."
            }
        }


class MessageConsumeResponse(BaseModel):
    """Response after consuming messages."""
    
    success: bool
    messages_consumed: int
    messages_remaining: int
    messages_limit: int
    tier: str
    message: str
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "messages_consumed": 1,
                "messages_remaining": 109,
                "messages_limit": 155,
                "tier": "BASIC",
                "message": "1 message(s) consumed successfully"
            }
        }


class SecurityValidationResult(BaseModel):
    """Result of 5-layer security validation."""
    
    is_valid: bool
    layer_1_client_check: bool = Field(..., description="Client-side encrypted counter check")
    layer_2_server_check: bool = Field(..., description="Server-side license validation check")
    layer_3_signature_check: bool = Field(..., description="Response signature verification")
    layer_4_database_check: bool = Field(..., description="SQLite checksum verification")
    layer_5_logging_check: bool = Field(..., description="Tampering attempt logged")
    failure_reason: Optional[str]
    
    class Config:
        schema_extra = {
            "example": {
                "is_valid": True,
                "layer_1_client_check": True,
                "layer_2_server_check": True,
                "layer_3_signature_check": True,
                "layer_4_database_check": True,
                "layer_5_logging_check": True,
                "failure_reason": None
            }
        }


class UsageHistory(BaseModel):
    """Historical usage record."""
    
    user_id: int
    date: str
    messages_used: int
    messages_limit: int
    usage_percentage: float
    tier: str
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": 1,
                "date": "2026-03-15",
                "messages_used": 45,
                "messages_limit": 155,
                "usage_percentage": 29.03,
                "tier": "BASIC"
            }
        }


class UsageHistoryResponse(BaseModel):
    """Response with usage history."""
    
    user_id: int
    period: str = Field(..., description="7days, 30days, 90days, all")
    total_messages_used: int
    average_daily_usage: float
    peak_usage_day: str
    usage_records: list[UsageHistory]
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": 1,
                "period": "7days",
                "total_messages_used": 250,
                "average_daily_usage": 35.7,
                "peak_usage_day": "2026-03-15",
                "usage_records": []
            }
        }


class UsageLimitWarning(BaseModel):
    """Warning when user approaches message limit."""
    
    warning_level: str = Field(..., description="low (80%), medium (90%), high (95%)")
    messages_remaining: int
    messages_limit: int
    estimated_reset_time: datetime
    upgrade_suggestion: Optional[str]
    
    class Config:
        schema_extra = {
            "example": {
                "warning_level": "medium",
                "messages_remaining": 15,
                "messages_limit": 155,
                "estimated_reset_time": "2026-03-16T00:00:00",
                "upgrade_suggestion": "Upgrade to STANDARD tier for 555 messages/day"
            }
        }
