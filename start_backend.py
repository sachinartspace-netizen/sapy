#!/usr/bin/env python3
"""
Sapy Backend Startup Script
Installs dependencies and starts FastAPI server
"""

import subprocess
import sys
import os

os.chdir('/Users/sachingupta/sapy_phase2a')

print("🚀 Installing dependencies...")
subprocess.run([sys.executable, '-m', 'pip', 'install', '--user', 'fastapi', 'uvicorn', 'python-dotenv', '-q'], check=False)

print("✅ Dependencies installed!")
print("\n🚀 Starting Sapy Backend...")
print("📍 Server: http://127.0.0.1:8000")
print("📍 Razorpay Key ID: rzp_test_SRXk3kZ1jUKd4A")
print("\n" + "="*80)

subprocess.run([sys.executable, '-m', 'uvicorn', 'main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'], cwd='/Users/sachingupta/sapy_phase2a')
