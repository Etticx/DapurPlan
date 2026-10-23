from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

import joblib
import pandas as pd

from scripts.train_forecast import (
    FEATURES,
    MENU_NAMES,
    build_training_rows,
    load_complete_days,
    make_random_forest,
    train_forecast_model,
)


def create_sales_database(path: Path, day_count: int) -> None:
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE sales_days(date TEXT PRIMARY KEY, version INTEGER NOT NULL);
        CREATE TABLE sales_lines(
            date TEXT NOT NULL,
            menu_id TEXT NOT NULL,
            quantity INTEGER,
            sold_out INTEGER NOT NULL
        );
        CREATE TABLE sales_provenance(date TEXT PRIMARY KEY);
        """
    )
    start = date(2026, 1, 1)
    for day_index in range(day_count):
        current = start + timedelta(days=day_index)
        current_text = current.isoformat()
        connection.execute("INSERT INTO sales_days VALUES (?, 1)", (current_text,))
        for menu_index, menu_id in enumerate(MENU_NAMES):
            quantity = 20 + 5 * menu_index + 2 * current.weekday()
            connection.execute(
                "INSERT INTO sales_lines VALUES (?, ?, ?, 0)",
                (current_text, menu_id, quantity),
            )
    connection.commit()
    connection.close()


class ForecastTrainingTests(unittest.TestCase):
    def test_training_examples_use_calendar_lags_and_skip_sold_out_targets(self):
        start = date(2026, 1, 1)
        days = {}
        for index in range(10):
            current = start + timedelta(days=index)
            days[current] = {
                menu_id: {"quantity": 10 + index, "sold_out": index == 8 and menu_id == "chicken-rice"}
                for menu_id in MENU_NAMES
            }

        rows = build_training_rows(days)
        chicken_rows = [row for row in rows if row["item"] == "Chicken rice"]
        self.assertNotIn((start + timedelta(days=8)).isoformat(), {row["target_date"] for row in chicken_rows})
        self.assertNotIn((start + timedelta(days=9)).isoformat(), {row["target_date"] for row in chicken_rows})
        first = next(row for row in chicken_rows if row["target_date"] == (start + timedelta(days=7)).isoformat())
        self.assertEqual(first["sales_last_week"], 10)
        self.assertEqual(first["sales_yesterday"], 16)
        self.assertEqual(first["average_previous_7_days"], 13)

    def test_loader_excludes_demo_provenance_and_incomplete_days(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / "sales.sqlite"
            create_sales_database(database, 4)
            connection = sqlite3.connect(database)
            connection.execute("INSERT INTO sales_provenance VALUES (?)", ("2026-01-01",))
            connection.execute(
                "UPDATE sales_lines SET quantity = NULL WHERE date = ? AND menu_id = ?",
                ("2026-01-02", "chicken-rice"),
            )
            connection.commit()
            connection.close()

            days = load_complete_days(database)

            self.assertEqual(set(days), {date(2026, 1, 3), date(2026, 1, 4)})

    def test_insufficient_real_history_does_not_replace_existing_model_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            database = root / "sales.sqlite"
            model_dir = root / "model"
            model_dir.mkdir()
            model_path = model_dir / "sales_forecast_pipeline.joblib"
            report_path = model_dir / "training_report.json"
            model_path.write_bytes(b"existing-model")
            report_path.write_text('{"existing": true}', encoding="utf-8")
            create_sales_database(database, 4)

            with self.assertRaisesRegex(ValueError, "at least 84 complete"):
                train_forecast_model(database, model_dir)

            self.assertEqual(model_path.read_bytes(), b"existing-model")
            self.assertEqual(report_path.read_text(encoding="utf-8"), '{"existing": true}')

    def test_training_uses_time_order_and_saves_hash_checked_real_model(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            database = root / "sales.sqlite"
            model_dir = root / "model"
            create_sales_database(database, 100)

            report = train_forecast_model(database, model_dir)

            self.assertFalse(report["synthetic_only"])
            self.assertEqual(report["selection_metric"], "chronological holdout MAE")
            self.assertEqual(report["selected_model"], "Last-week baseline")
            self.assertLess(report["training_dates"][1], report["validation_dates"][0])
            model_path = model_dir / "sales_forecast_pipeline.joblib"
            saved_report = json.loads((model_dir / "training_report.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_report["model_sha256"], hashlib.sha256(model_path.read_bytes()).hexdigest())
            estimator = joblib.load(model_path)
            prediction = estimator.predict(
                pd.DataFrame(
                    [
                        {
                            "item": "Chicken rice",
                            "day_of_week": 0,
                            "sales_yesterday": 25,
                            "sales_last_week": 20,
                            "average_previous_7_days": 22,
                        }
                    ],
                    columns=saved_report["features"],
                )
            )
            self.assertEqual(float(prediction[0]), 20)

    def test_random_forest_pipeline_accepts_the_forecast_contract(self):
        rows = [
            {
                "item": menu,
                "day_of_week": index % 7,
                "sales_yesterday": 20 + index,
                "sales_last_week": 18 + index,
                "average_previous_7_days": 19 + index,
            }
            for index in range(40)
            for menu in MENU_NAMES.values()
        ]
        frame = pd.DataFrame(rows, columns=FEATURES)
        model = make_random_forest().fit(frame, pd.Series([30 + index % 9 for index in range(len(frame))]))

        predictions = model.predict(frame.iloc[:5])

        self.assertEqual(predictions.shape, (5,))
        self.assertTrue(pd.Series(predictions).map(lambda value: value >= 0).all())


if __name__ == "__main__":
    unittest.main()
