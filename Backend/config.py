APP_NAME = "LockLens"
APP_VERSION = "1.0.0-prototype"

PRIVACY_MODE = {
    "local_processing": True,
    "raw_data_storage": False,
    "database_used": False
}

RISK_LEVELS = {
    "low": {"min": 0, "max": 25},
    "medium": {"min": 26, "max": 50},
    "high": {"min": 51, "max": 75},
    "critical": {"min": 76, "max": 100}
}