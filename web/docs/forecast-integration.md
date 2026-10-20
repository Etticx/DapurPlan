# Local forecast integration

Run FastAPI on 127.0.0.1:8000 (root README), and Next.js on port 4000.
Server-only FORECAST_API_URL can override the Python service address.
Open /plan and generate tomorrow's forecast. Only authenticated owners can generate.
No client-provided sales features or dates are accepted: the server derives tomorrow
from Malaysia time and reads all five menus for the prior seven calendar dates.
Missing values block generation; explicit zeros are valid. Target weekday is Monday=0.
Calls time out after 15 seconds. Errors do not replace an existing saved forecast.

Schema migration 5 adds append-only forecasts with model SHA-256, raw predictions,
exact feature inputs, sales version/quantity snapshots, provenance, creator and UTC time.
Sales changes during the request reject the save. Later sales edits mark the old forecast
stale. The dashboard only totals current predictions, preserving decimals; no rounding
policy for preparation is applied yet. Display rounds to one decimal only.
The model is synthetic-trained and sold-out flags do not affect its outputs.
Forecasting never changes sales, recipes or inventory. Ingredient calculations and
owner approval are deliberately not implemented in this serving-forecast step.
Run npm run test:forecast for feature, error and persistence checks.
