from __future__ import annotations

import argparse
from datetime import date, timedelta
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from dapurplan.forecast_model import FEATURES, LastWeekBaseline  # noqa: E402

MENU_NAMES = {
    "chicken-rice": "Chicken rice",
    "kuey-teow": "Fried kuey teow with egg",
    "nasi-lemak": "Nasi lemak with egg",
    "kopi": "Kopi O ais",
    "tea": "Iced lemon tea",
}
MIN_COMPLETE_DAYS = 84
MIN_TRAIN_DAYS_PER_MENU = 30
MIN_VALIDATION_DAYS_PER_MENU = 14
NUMERIC_FEATURES = [
    "day_of_week",
    "sales_yesterday",
    "sales_last_week",
    "average_previous_7_days",
]


def load_complete_days(database_path: Path) -> dict[date, dict[str, dict[str, int | bool]]]:
    if not database_path.is_file():
        raise ValueError(f"SQLite database not found: {database_path}")

    connection = sqlite3.connect(f"{database_path.resolve().as_uri()}?mode=ro", uri=True)
    try:
        records = connection.execute(
            """
            SELECT d.date, l.menu_id, l.quantity, l.sold_out,
                   CASE WHEN p.date IS NULL THEN 0 ELSE 1 END AS has_provenance
            FROM sales_days AS d
            JOIN sales_lines AS l ON l.date = d.date
            LEFT JOIN sales_provenance AS p ON p.date = d.date
            ORDER BY d.date, l.menu_id
            """
        ).fetchall()
    finally:
        connection.close()

    grouped: dict[date, dict[str, dict[str, int | bool]]] = {}
    demo_dates: set[date] = set()
    for raw_date, menu_id, quantity, sold_out, has_provenance in records:
        parsed_date = date.fromisoformat(raw_date)
        if has_provenance:
            demo_dates.add(parsed_date)
        grouped.setdefault(parsed_date, {})[menu_id] = {
            "quantity": quantity,
            "sold_out": bool(sold_out),
        }

    complete: dict[date, dict[str, dict[str, int | bool]]] = {}
    expected_menus = set(MENU_NAMES)
    for recorded_date, items in grouped.items():
        if recorded_date in demo_dates or set(items) != expected_menus:
            continue
        if any(item["quantity"] is None for item in items.values()):
            continue
        complete[recorded_date] = items
    return complete


def build_training_rows(
    days: dict[date, dict[str, dict[str, int | bool]]],
) -> list[dict[str, str | int | float]]:
    rows: list[dict[str, str | int | float]] = []
    for target_date in sorted(days):
        previous_dates = [target_date - timedelta(days=offset) for offset in range(7, 0, -1)]
        if any(day not in days for day in previous_dates):
            continue

        for menu_id, item_name in MENU_NAMES.items():
            history = [days[day][menu_id] for day in previous_dates]
            target = days[target_date][menu_id]
            if target["sold_out"] or any(record["sold_out"] for record in history):
                continue
            quantities = [int(record["quantity"]) for record in history]
            rows.append(
                {
                    "target_date": target_date.isoformat(),
                    "item": item_name,
                    "day_of_week": target_date.weekday(),
                    "sales_yesterday": quantities[-1],
                    "sales_last_week": quantities[0],
                    "average_previous_7_days": sum(quantities) / len(quantities),
                    "sales": int(target["quantity"]),
                }
            )
    return rows


def make_random_forest() -> Pipeline:
    transform = ColumnTransformer(
        [
            ("menu", OneHotEncoder(handle_unknown="ignore"), ["item"]),
            ("numeric", "passthrough", NUMERIC_FEATURES),
        ]
    )
    return Pipeline(
        [
            ("features", transform),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=300,
                    max_depth=6,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=1,
                ),
            ),
        ]
    )


def _metric_by_menu(actual: pd.Series, predicted: np.ndarray, items: pd.Series) -> dict[str, float]:
    return {
        item: float(mean_absolute_error(actual[items == item], predicted[items == item]))
        for item in sorted(items.unique())
    }


def _write_artifacts(model_dir: Path, estimator, report: dict) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "sales_forecast_pipeline.joblib"
    report_path = model_dir / "training_report.json"
    model_temp: Path | None = None
    report_temp: Path | None = None
    try:
        model_fd, model_name = tempfile.mkstemp(prefix=".forecast-", suffix=".joblib", dir=model_dir)
        os.close(model_fd)
        model_temp = Path(model_name)
        joblib.dump(estimator, model_temp)
        report["model_sha256"] = hashlib.sha256(model_temp.read_bytes()).hexdigest()

        report_fd, report_name = tempfile.mkstemp(prefix=".forecast-", suffix=".json", dir=model_dir)
        report_temp = Path(report_name)
        with os.fdopen(report_fd, "w", encoding="utf-8") as file:
            json.dump(report, file, indent=2, allow_nan=False)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())

        os.replace(model_temp, model_path)
        os.replace(report_temp, report_path)
    finally:
        if model_temp is not None:
            model_temp.unlink(missing_ok=True)
        if report_temp is not None:
            report_temp.unlink(missing_ok=True)


def train_forecast_model(database_path: Path, model_dir: Path) -> dict:
    days = load_complete_days(database_path)
    if len(days) < MIN_COMPLETE_DAYS:
        raise ValueError(
            f"Training needs at least {MIN_COMPLETE_DAYS} complete, non-demo sales days; "
            f"found {len(days)}. Existing model files were not changed."
        )

    frame = pd.DataFrame(build_training_rows(days))
    if frame.empty:
        raise ValueError("No uncensored training examples could be built. Existing model files were not changed.")
    target_dates = sorted(frame["target_date"].unique())
    split_index = int(len(target_dates) * 0.8)
    train_dates = set(target_dates[:split_index])
    validation_dates = set(target_dates[split_index:])
    train = frame[frame["target_date"].isin(train_dates)]
    validation = frame[frame["target_date"].isin(validation_dates)]
    for menu in MENU_NAMES.values():
        train_count = int((train["item"] == menu).sum())
        validation_count = int((validation["item"] == menu).sum())
        if train_count < MIN_TRAIN_DAYS_PER_MENU or validation_count < MIN_VALIDATION_DAYS_PER_MENU:
            raise ValueError(
                f"Not enough uncensored history for {menu} "
                f"({train_count} train days, {validation_count} validation days). "
                "Existing model files were not changed."
            )

    features = validation[FEATURES]
    actual = validation["sales"]
    baseline_predictions = features["sales_last_week"].to_numpy(dtype=float)
    baseline_mae = float(mean_absolute_error(actual, baseline_predictions))
    baseline_by_menu = _metric_by_menu(actual, baseline_predictions, validation["item"])

    candidate = make_random_forest()
    candidate.fit(train[FEATURES], train["sales"])
    candidate_predictions = np.maximum(candidate.predict(features), 0)
    candidate_mae = float(mean_absolute_error(actual, candidate_predictions))
    candidate_by_menu = _metric_by_menu(actual, candidate_predictions, validation["item"])

    use_random_forest = (
        baseline_mae > 0
        and candidate_mae <= baseline_mae * 0.95
        and all(candidate_by_menu[menu] <= baseline_by_menu[menu] * 1.10 for menu in MENU_NAMES.values())
    )
    selected_model = "Random Forest" if use_random_forest else "Last-week baseline"
    selected = candidate if use_random_forest else LastWeekBaseline()
    selected.fit(frame[FEATURES], frame["sales"])

    validation_results = [
        {
            "approach": "Random Forest",
            "MAE": candidate_mae,
            "MAE_by_menu": candidate_by_menu,
        },
        {
            "approach": "Last-week baseline",
            "MAE": baseline_mae,
            "MAE_by_menu": baseline_by_menu,
        },
    ]
    report = {
        "dataset_scenario": "real restaurant sales",
        "synthetic_only": False,
        "data_source": "local SQLite sales; imported demo-provenance dates excluded",
        "complete_sales_days": len(days),
        "usable_training_rows": len(frame),
        "training_dates": [min(train_dates), max(train_dates)],
        "validation_dates": [min(validation_dates), max(validation_dates)],
        "forecast_horizon": "one day ahead",
        "features": FEATURES,
        "label": "sales",
        "selected_model": selected_model,
        "selected_settings": (
            {
                "n_estimators": 300,
                "max_depth": 6,
                "min_samples_leaf": 2,
                "random_state": 42,
            }
            if use_random_forest
            else {"prediction": "previous matching weekday"}
        ),
        "selection_metric": "chronological holdout MAE",
        "selection_rule": "Random Forest must improve MAE by at least 5% and not regress any menu by over 10%.",
        "validation_results": validation_results,
        "limits": [
            "Validation uses historical sales and does not guarantee future accuracy.",
            "Days or menu rows marked sold out are excluded because observed sales may understate demand.",
            "At least 84 complete, non-demo days are required before replacing the current model.",
        ],
    }
    _write_artifacts(model_dir, selected, report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train and chronologically validate a forecast model from DapurPlan SQLite sales."
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path(os.environ.get("DAPURPLAN_DB_PATH", ROOT / "web" / "data" / "dapurplan.sqlite")),
    )
    parser.add_argument("--model-dir", type=Path, default=ROOT / "model")
    args = parser.parse_args()
    try:
        report = train_forecast_model(args.database, args.model_dir)
    except (OSError, sqlite3.Error, ValueError) as error:
        parser.error(str(error))
    print(
        f"Saved {report['selected_model']} using {report['complete_sales_days']} complete days; "
        f"validation MAE: {report['validation_results'][0]['MAE']:.2f} servings."
    )


if __name__ == "__main__":
    main()
