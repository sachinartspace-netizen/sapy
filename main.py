"""
Sapy AI - Phase 2A Backend Server
Main FastAPI application with offline-first architecture
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routes
from api.routes import auth, licenses, payments, admin, usage

# Database initialization
from database.db import init_db

# Startup & Shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Sapy AI Backend Starting...")
    init_db()  # Initialize database on startup
    print("✅ Database initialized")
    yield
    # Shutdown
    print("🛑 Sapy AI Backend Shutting Down...")

# Create FastAPI app
app = FastAPI(
    title="Sapy AI - Backend",
    description="Offline-first AI chatbot with monetization",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "['*']")
if isinstance(CORS_ORIGINS, str):
    CORS_ORIGINS = eval(CORS_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/health")
async def health_check():
    """Check if backend is running"""
    return {
        "status": "ok",
        "service": "Sapy AI Backend",
        "version": "2.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """Welcome message"""
    return {
        "message": "Welcome to Sapy AI Backend",
        "version": "2.0.0",
        "offline_first": True,
        "api_docs": "/docs",
        "api_schema": "/openapi.json"
    }

# Include API routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(licenses.router, prefix="/api/licenses", tags=["Licenses"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(usage.router, prefix="/api/usage", tags=["Usage"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
