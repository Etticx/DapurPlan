"""Protected entry point for the Runpod CPU Pod."""
import os
import secrets
from fastapi.responses import JSONResponse
from dapurplan.api import create_app as create_forecast_app


def create_app():
    key = os.environ.get("FORECAST_API_KEY", "")
    if len(key) < 32:
        raise RuntimeError("Set FORECAST_API_KEY to a random secret of at least 32 characters.")
    app = create_forecast_app()

    @app.middleware("http")
    async def require_key(request, call_next):
        supplied = request.headers.get("Authorization", "").encode("utf-8")
        expected = ("Bearer " + key).encode("utf-8")
        if not secrets.compare_digest(supplied, expected):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401,
                                headers={"WWW-Authenticate": "Bearer"})
        return await call_next(request)

    return app
