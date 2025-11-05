#!/bin/bash

# Navigate to backend directory
cd "$(dirname "$0")"

# Activate virtual environment
source .venv/bin/activate

# Load environment variables (excluding comments)
export $(cat .env | grep -v '^#' | xargs)

# Start the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

