# ============================================================
# LockLens - FastAPI Supporting Backend
# File: main.py
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import (
    APP_NAME,
    APP_VERSION,
    PRIVACY_MODE,
    RISK_LEVELS,
)


# ============================================================
# Application
# ============================================================

app = FastAPI(
    title=f"{APP_NAME} API",
    description=(
        "Supporting API for LockLens. "
        "Core privacy analysis is performed locally in the browser."
    ),
    version=APP_VERSION,
)


# ============================================================
# CORS
# ============================================================
# Development configuration.
#
# For production deployment, replace "*" with the exact
# frontend/extension origins that are allowed to communicate
# with this API.
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ============================================================
# Root
# ============================================================

@app.get("/")
def root():
    return {
        "application": APP_NAME,
        "version": APP_VERSION,
        "status": "running",
        "architecture": "privacy-first",
        "message": (
            "LockLens API is running. "
            "Sensitive-data analysis is performed locally."
        ),
    }


# ============================================================
# Health Check
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": APP_NAME,
        "version": APP_VERSION,
    }


# ============================================================
# Version Information
# ============================================================

@app.get("/version")
def version():
    return {
        "application": APP_NAME,
        "version": APP_VERSION,
        "api_version": "1.0",
        "status": "prototype",
    }


# ============================================================
# Privacy Information
# ============================================================

@app.get("/privacy")
def privacy():
    return {
        "privacy_mode": "local_processing",

        "local_processing": PRIVACY_MODE.get(
            "local_processing",
            True
        ),

        "raw_data_storage": PRIVACY_MODE.get(
            "raw_data_storage",
            False
        ),

        "database_used": PRIVACY_MODE.get(
            "database_used",
            False
        ),

        "typed_values_collected": False,

        "passwords_collected": False,

        "keystrokes_collected": False,

        "website_history_stored": False,

        "message": (
            "LockLens performs sensitive-data exposure analysis "
            "locally in the browser. The supporting API does not "
            "require raw personal information."
        ),
    }


# ============================================================
# Capabilities
# ============================================================

@app.get("/capabilities")
def capabilities():
    return {
        "application": APP_NAME,

        "local_browser_scanning": True,

        "form_metadata_analysis": True,

        "privacy_guard": True,

        "risk_assessment": True,

        "exposure_timeline": True,

        "privacy_recommendations": True,

        "dashboard": True,

        "raw_personal_data_storage": False,

        "typed_value_collection": False,

        "password_collection": False,

        "keystroke_collection": False,

        "website_history_storage": False,

        "database": False,

        "backend_role": (
            "Supporting API and configuration layer"
        ),
    }


# ============================================================
# Risk Model
# ============================================================

@app.get("/risk-model")
def risk_model():
    return {
        "model_type": "rule_based",

        "description": (
            "LockLens uses weighted privacy-exposure signals "
            "to calculate a risk score locally."
        ),

        "weights": {
            "name": 5,
            "email": 10,
            "phone": 15,
            "address": 20,
            "date": 10,
            "password": 10,
            "payment": 20,
            "government_id": 25,
            "location": 15,
            "username": 5,
        },

        "levels": {
            "low": {
                "min": 0,
                "max": 20,
            },

            "medium": {
                "min": 21,
                "max": 50,
            },

            "high": {
                "min": 51,
                "max": 75,
            },

            "critical": {
                "min": 76,
                "max": 100,
            },
        },

        "processing_location": "browser",

        "raw_personal_data_sent_to_api": False,
    }


# ============================================================
# Configuration
# ============================================================

@app.get("/config")
def configuration():
    return {
        "application": APP_NAME,
        "version": APP_VERSION,

        "privacy": PRIVACY_MODE,

        "risk_levels": RISK_LEVELS,

        "analysis_location": "client-side",

        "api_data_requirement": "metadata/configuration only",
    }


# ============================================================
# Privacy Architecture
# ============================================================

@app.get("/architecture")
def architecture():
    return {
        "pipeline": [
            "Detect",
            "Warn",
            "Assess",
            "Track",
        ],

        "detect": (
            "Browser extension detects privacy-related "
            "signals using page and form metadata."
        ),

        "warn": (
            "Privacy Guard informs the user when a form "
            "appears to request sensitive information."
        ),

        "assess": (
            "Risk Engine calculates the exposure level "
            "locally in the browser."
        ),

        "track": (
            "Anonymous exposure metadata can be stored "
            "locally for timeline and dashboard insights."
        ),

        "backend": (
            "FastAPI provides supporting configuration, "
            "health and capability endpoints."
        ),

        "raw_sensitive_data_storage": False,
    }


# ============================================================
# Run with:
#
# uvicorn main:app --reload
#
# API:
# http://127.0.0.1:8000
# ============================================================