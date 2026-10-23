"""Local prediction service. No database or inventory writes."""
from contextlib import asynccontextmanager
import hashlib
import json
from pathlib import Path
from typing import Annotated, Literal
import warnings

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator
from sklearn.exceptions import InconsistentVersionWarning
from dapurplan.forecast_model import FEATURES

MODEL_DIR = Path(__file__).resolve().parents[2] / "model"
SUPPORTED_MODELS = {"Random Forest", "Last-week baseline"}
Menu = Literal["Chicken rice", "Fried kuey teow with egg", "Nasi lemak with egg", "Kopi O ais", "Iced lemon tea"]
SalesNumber = Annotated[float, Field(ge=0, le=1_000_000)]

class ForecastInput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    item: Menu
    day_of_week: Annotated[int, Field(ge=0, le=6)]
    sales_yesterday: SalesNumber
    sales_last_week: SalesNumber
    average_previous_7_days: SalesNumber

class ForecastRequest(RootModel[list[ForecastInput]]):
    root: Annotated[list[ForecastInput], Field(min_length=1, max_length=5)]

    @model_validator(mode="after")
    def check_rows(self):
        if len({row.item for row in self.root}) != len(self.root):
            raise ValueError("Each menu item may appear only once.")
        if len({row.day_of_week for row in self.root}) != 1:
            raise ValueError("All rows must predict the same weekday.")
        return self

class Prediction(BaseModel):
    item: str
    predicted_servings: float

class ForecastResponse(BaseModel):
    predictions: list[Prediction]
    synthetic_model: bool
    model_id: str

def create_app(model_dir: Path = MODEL_DIR):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        report = json.loads((model_dir / "training_report.json").read_text(encoding="utf-8"))
        if report.get("features") != FEATURES or report.get("selected_model") not in SUPPORTED_MODELS:
            raise RuntimeError("The model report does not match this service's input contract.")
        if not isinstance(report.get("synthetic_only"), bool):
            raise RuntimeError("The model report must identify whether training data was synthetic.")
        model_path = model_dir / "sales_forecast_pipeline.joblib"
        # Load only the trusted, team-exported pipeline. Never accept model uploads.
        with warnings.catch_warnings():
            warnings.simplefilter("error", InconsistentVersionWarning)
            pipeline = joblib.load(model_path)
        if list(pipeline.feature_names_in_) != FEATURES:
            raise RuntimeError("Pipeline columns do not match the model report.")
        expected_hash = report.get("model_sha256")
        actual_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
        if expected_hash is not None and expected_hash != actual_hash:
            raise RuntimeError("The model artifact does not match the training report.")
        app.state.pipeline = pipeline
        app.state.model_id = actual_hash
        app.state.synthetic_model = report["synthetic_only"]
        app.state.model_name = report["selected_model"]
        yield
        del app.state.pipeline

    app = FastAPI(title="DapurPlan Forecast API", version="0.1.0", lifespan=lifespan,
                  description="Local one-day-ahead predictions. Monday=0, Sunday=6. No database access.")

    @app.get("/health")
    def health(request: Request):
        return {"status": "ready", "model": request.app.state.model_name, "model_id": request.app.state.model_id,
                "features": FEATURES, "weekday_numbering": "Monday=0, Sunday=6",
                "synthetic_model": request.app.state.synthetic_model}

    @app.post("/predict", response_model=ForecastResponse)
    def predict(payload: ForecastRequest, request: Request):
        frame = pd.DataFrame([row.model_dump() for row in payload.root], columns=FEATURES)
        try:
            output = np.asarray(request.app.state.pipeline.predict(frame), dtype=float)
            if output.shape != (len(frame),) or not np.isfinite(output).all():
                raise ValueError("Invalid model output")
        except Exception as error:
            raise HTTPException(status_code=503, detail="Prediction unavailable. Please try again.") from error
        # Match the notebook: clip negatives and retain decimals. Preparation rounding comes later.
        output = np.maximum(output, 0)
        return ForecastResponse(model_id=request.app.state.model_id,
            synthetic_model=request.app.state.synthetic_model, predictions=[
            Prediction(item=row.item, predicted_servings=float(value))
            for row, value in zip(payload.root, output, strict=True)
        ])

    return app

app = create_app()
