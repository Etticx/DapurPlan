# DapurPlan

Next.js web app in `web/`; Python forecasting service in `src/dapurplan/api.py`.
The service loads the existing team-exported Random Forest pipeline once at startup.
No database connection, retraining, inventory changes or Runpod deployment is included yet.

## How to run locally 
'''powershell
cd web 
npm install
npm run dev
'''

## Run the prediction service (PowerShell, project root)

Using the existing `venv`:

```powershell
uv pip install --python venv/Scripts/python.exe -r requirements-dev.txt
$env:PYTHONPATH = "src"
.\venv\Scripts\python.exe -m uvicorn dapurplan.api:app --host 127.0.0.1 --port 8000
```

Keep it running in a separate terminal from Next.js (`cd web; npm run dev`).
Prediction API: http://127.0.0.1:8000/docs. Health: http://127.0.0.1:8000/health.
In `/docs`, expand POST `/predict`, choose Try it out, paste `model/example_input.json`,
then Execute. The body is an array of one to five distinct menu items.

From another PowerShell terminal:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/predict -Method Post -ContentType 'application/json' -Body (Get-Content model/example_input.json -Raw)
```

## Prediction contract

Exact input columns: `item`, `day_of_week`, `sales_yesterday`, `sales_last_week`,
`average_previous_7_days`. Monday=0 through Sunday=6, verified against the team's
training notebook (`date.dt.dayofweek`). Inputs are relative to the target date:
for tomorrow, yesterday is today's completed sales, last week is target date minus
7 days, and the average uses the 7 completed calendar days before the target date.
Historical missing data must not silently become zero. The service accepts prepared
features only; building them from the database comes next. Sold-out flags are not
features of this saved model.

Output `predicted_servings` is a non-negative decimal, matching notebook clipping.
Rounding for preparation and owner approval belongs to the future app integration.
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

