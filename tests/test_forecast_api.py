import json
from pathlib import Path
import tempfile
import hashlib
import unittest
from unittest.mock import patch

import joblib
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from dapurplan.api import create_app, MODEL_DIR, FEATURES
from dapurplan.forecast_model import LastWeekBaseline

class ForecastTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads((MODEL_DIR / "example_input.json").read_text())
        cls.context = TestClient(create_app())
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)

    def test_health_and_saved_pipeline_prediction_match(self):
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["synthetic_model"])
        result = self.client.post("/predict", json=self.payload)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["synthetic_model"])
        expected = np.maximum(joblib.load(MODEL_DIR / "sales_forecast_pipeline.joblib").predict(pd.DataFrame(self.payload, columns=FEATURES)), 0)
        self.assertAlmostEqual(result.json()["predictions"][0]["predicted_servings"], float(expected[0]), places=12)
        print("Example prediction:", result.json()["predictions"])

    def test_real_sales_baseline_is_reported_and_served(self):
        with tempfile.TemporaryDirectory() as folder:
            model_dir = Path(folder)
            baseline = LastWeekBaseline().fit(
                pd.DataFrame([self.payload[0]], columns=FEATURES),
                np.array([39.0]),
            )
            model_path = model_dir / "sales_forecast_pipeline.joblib"
            joblib.dump(baseline, model_path)
            report = json.loads((MODEL_DIR / "training_report.json").read_text(encoding="utf-8"))
            report.update(
                selected_model="Last-week baseline",
                synthetic_only=False,
                model_sha256=hashlib.sha256(model_path.read_bytes()).hexdigest(),
            )
            (model_dir / "training_report.json").write_text(json.dumps(report), encoding="utf-8")

            with TestClient(create_app(model_dir)) as client:
                self.assertFalse(client.get("/health").json()["synthetic_model"])
                result = client.post("/predict", json=self.payload)
                self.assertEqual(result.status_code, 200)
                self.assertFalse(result.json()["synthetic_model"])
                self.assertEqual(result.json()["predictions"][0]["predicted_servings"], 39.0)

    def test_all_five_items(self):
        menus = ["Chicken rice", "Fried kuey teow with egg", "Nasi lemak with egg", "Kopi O ais", "Iced lemon tea"]
        rows = [dict(self.payload[0], item=item) for item in menus]
        response = self.client.post("/predict", json=rows)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p["item"] for p in response.json()["predictions"]], menus)

    def test_invalid_inputs(self):
        for patch_values in [{"item":"Pizza"},{"day_of_week":7},{"day_of_week":True},{"sales_yesterday":-1},{"sales_last_week":"40"},{"average_previous_7_days":None},{"promotion":1}]:
            with self.subTest(patch=patch_values):
                self.assertEqual(self.client.post("/predict", json=[dict(self.payload[0], **patch_values)]).status_code, 422)
        for rows in [[], self.payload*2, [{"item":"Chicken rice"}], [self.payload[0], dict(self.payload[0],item="Kopi O ais",day_of_week=2)]]:
            self.assertEqual(self.client.post("/predict", json=rows).status_code, 422)

    def test_negative_outputs_clip_and_bad_outputs_fail(self):
        pipeline = self.client.app.state.pipeline
        with patch.object(pipeline, "predict", return_value=np.array([-2.0])):
            self.assertEqual(self.client.post("/predict", json=self.payload).json()["predictions"][0]["predicted_servings"], 0)
        with patch.object(pipeline, "predict", return_value=np.array([np.nan])):
            self.assertEqual(self.client.post("/predict", json=self.payload).status_code, 503)

    def test_missing_model_fails_startup(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(FileNotFoundError):
                with TestClient(create_app(Path(folder))):
                    pass

if __name__ == "__main__":
    unittest.main()
