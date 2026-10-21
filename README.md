# DapurPlan

DapurPlan helps a restaurant forecast servings, calculate ingredient needs, and review preparation plans.

- **Frontend and app backend:** Next.js in `web/` (login, SQLite database, recipes, sales, inventory and approvals).
- **ML backend:** FastAPI in `src/dapurplan/api.py` (loads the saved Random Forest pipeline and predicts servings).

## Run locally on Windows (PowerShell)

Use **two separate terminals** and keep both running. Start each terminal in the
main `DapurPlan` folder, where `pyproject.toml` and the `web` folder are located.

### First-time setup

Install Node.js 22, Python 3.12 and uv. The local setup was tested with Node.js
22.12.0 and Python 3.12.8. Verify these model files are inside `model/`:

- `sales_forecast_pipeline.joblib`
- `requirements.txt`
- `training_report.json`
- `example_input.json`

Install frontend dependencies:

```powershell
cd web
npm install
cd ..
```

Create the Python environment **only if it does not already exist**, then install
backend dependencies from the project root:

```powershell
if (!(Test-Path "venv/Scripts/python.exe")) {
    uv venv --python 3.12 venv
}
uv pip install --python venv/Scripts/python.exe -r requirements-dev.txt
```

You only need to install dependencies again when they change.

### Terminal 1: frontend

From the main `DapurPlan` folder:

```powershell
cd web
npm run dev
```

Open **http://127.0.0.1:4000**.

Demo accounts:

- Owner: username `owner`, password `123`.
- Staff: username `staff`, password `123`.

These are fixed prototype accounts, not production account management.

### Terminal 2: ML backend

Open another terminal in the main `DapurPlan` folder:

```powershell
$env:PYTHONPATH = "src"
.\venv\Scripts\python.exe -m uvicorn dapurplan.api:app --host 127.0.0.1 --port 8000
```

Wait for `Application startup complete` before generating a forecast.
You do not need to activate the environment because the command calls its Python directly.

- API documentation: **http://127.0.0.1:8000/docs**.
- Service health: **http://127.0.0.1:8000/health**.

The frontend calls FastAPI from the Next.js server. Its default address is
`http://127.0.0.1:8000`. To change it, set `FORECAST_API_URL` in `web/.env.local`
and restart the frontend. This address must not use a `NEXT_PUBLIC_` variable.

### Using and stopping the app

1. Sign in at http://127.0.0.1:4000.
2. Save complete sales for seven consecutive days for all five menu items.
3. Open **Tomorrow’s plan**, generate a forecast, review preparation and shopping,
   then save a draft or approve as owner.

Recipes, sales, stock and plans persist in `web/data/dapurplan.sqlite`.
There is no automatic stock deduction when a plan is approved.
Stop each server with **Ctrl+C** in its terminal. Saved database records remain.

If `npm run dev` reports a missing `package.json`, run it inside `web/`.
If forecasting reports that the model service is unavailable, check Terminal 2.
If a port is already in use, check whether that server is already running before
starting another copy.

### Test the model API directly (optional)

With the backend running, open another terminal in the project root:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/predict -Method Post -ContentType 'application/json' -Body (Get-Content model/example_input.json -Raw)
```

Or open `/docs`, expand POST `/predict`, choose **Try it out**, paste
`model/example_input.json`, then **Execute**. The body accepts one to five distinct menu items.

## Prediction contract

Exact input columns: `item`, `day_of_week`, `sales_yesterday`, `sales_last_week`,
`average_previous_7_days`. Monday=0 through Sunday=6, verified against the team's
training notebook (`date.dt.dayofweek`). Inputs are relative to the target date:
for tomorrow, yesterday is today's completed sales, last week is target date minus
7 days, and the average uses the 7 completed calendar days before the target date.
Historical missing data must not silently become zero. The service accepts prepared
features only; Next.js builds them from saved database records. Sold-out flags are not
features of this saved model.

Output `predicted_servings` is a non-negative decimal, matching notebook clipping.
The app rounds preparation defaults up to whole servings and lets the owner adjust them before approval.
`model_id` is the artifact's SHA-256; `synthetic_model` is true. The exported test
MAE is 3.088 on synthetic regular-demand data, not verified restaurant performance.

The full fitted preprocessing pipeline is used. Model libraries match the export's
`model/requirements.txt`; incompatible scikit-learn versions fail at startup.
The export recorded Python 3.13.16; this local service is tested with Python 3.12.8.
Only load the trusted team artifact: joblib files can execute Python during loading.

This service is bound to loopback and has no deployed authentication/CORS integration.
Add service authentication before external hosting. Never expose it publicly as-is.
Frontend login and owner approval remain in the Next.js app.

## Tests

```powershell
$env:PYTHONPATH = "src"
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

Tests compare HTTP responses against direct pipeline predictions, validate five-item
batches, reject invalid inputs, check clipping/non-finite outputs and missing-model startup.
No sales records, stock or trained parameters are changed by these tests.

