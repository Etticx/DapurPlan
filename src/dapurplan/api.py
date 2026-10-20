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

MODEL_DIR = Path(__file__).resolve().parents[2] / "model"
FEATURES = ["item", "day_of_week", "sales_yesterday", "sales_last_week", "average_previous_7_days"]
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
    synthetic_model: bool = True
    model_id: str

def create_app(model_dir: Path = MODEL_DIR):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        report = json.loads((model_dir / "training_report.json").read_text(encoding="utf-8"))
        if report["features"] != FEATURES or report["selected_model"] != "Random Forest":
            raise RuntimeError("The model report does not match this service's input contract.")
        model_path = model_dir / "sales_forecast_pipeline.joblib"
        # Load only the trusted, team-exported pipeline. Never accept model uploads.
        with warnings.catch_warnings():
            warnings.simplefilter("error", InconsistentVersionWarning)
            pipeline = joblib.load(model_path)
        if list(pipeline.feature_names_in_) != FEATURES:
            raise RuntimeError("Pipeline columns do not match the model report.")
        app.state.pipeline = pipeline
        app.state.model_id = hashlib.sha256(model_path.read_bytes()).hexdigest()
        yield
        del app.state.pipeline

    app = FastAPI(title="DapurPlan Forecast API", version="0.1.0", lifespan=lifespan,
                  description="Local one-day-ahead prediction from the team's synthetic-data model. Monday=0, Sunday=6. No database access.")

    @app.get("/health")
    def health(request: Request):
        return {"status": "ready", "model": "Random Forest", "model_id": request.app.state.model_id,
                "features": FEATURES, "weekday_numbering": "Monday=0, Sunday=6", "synthetic_model": True}

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
        return ForecastResponse(model_id=request.app.state.model_id, predictions=[
            Prediction(item=row.item, predicted_servings=float(value))
            for row, value in zip(payload.root, output, strict=True)
        ])

    return app

app = create_app()
