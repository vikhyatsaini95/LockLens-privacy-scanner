from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import (
    APP_NAME,
    APP_VERSION,
    PRIVACY_MODE,
    RISK_LEVELS
)


app = FastAPI(
    title="LockLens API",
    description=(
        "Privacy-first supporting API for the LockLens browser extension. "
        "The prototype does not receive or store raw personal data."
    ),
    version=APP_VERSION
)


# CORS configuration for development.
# In a production extension, restrict origins appropriately.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "LockLens API is running",
        "version": APP_VERSION
    }


@app.get("/health")
def health_check():
    """
    Simple health endpoint.

    No user information is accepted or stored.
    """
    return {
        "status": "healthy",
        "service": APP_NAME
    }


@app.get("/privacy")
def privacy_status():
    """
    Explains the prototype's privacy model.
    """
    return {
        "local_processing": PRIVACY_MODE["local_processing"],
        "raw_data_storage": PRIVACY_MODE["raw_data_storage"],
        "database_used": PRIVACY_MODE["database_used"],
        "message": (
            "LockLens performs core privacy analysis locally in the user's browser. "
            "This prototype does not store raw personal information."
        )
    }


@app.get("/config")
def get_public_config():
    """
    Returns only public configuration.
    No personal information is involved.
    """
    return {
        "app_name": APP_NAME,
        "version": APP_VERSION,
        "risk_levels": RISK_LEVELS
    }