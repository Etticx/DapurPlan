# DapurPlan

DapurPlan helps small food businesses forecast daily servings, estimate ingredient requirements, and review stock-aware preparation plans.

---

## Team Information

| Field | Details |
| --- | --- |
| **Team Name** | S.E.E.S |
| **Team Domain** | Domain 2 |
| **SDG Track (1–17)** | SDG 12 |
| **Team Leader** | Muhammad Amal Irfan Bin Shaharuddin|
| **University** | Universiti Malaysia Terengganu (UMT), Universiti Teknologi MARA (UITM) |
| **Number of Members** | 3 Members |

## Links

| Resource | Link |
| --- | --- |
| GitHub Repository | [Etticx/DapurPlan](https://github.com/Etticx/DapurPlan) |
| Live Demo | [DapurPlan on Replit](https://dapurplan.replit.app) |
| RunPod Endpoint | [Protected forecast service](https://jempwl1632kkc7-8000.proxy.runpod.net); requires a private bearer key. See the [CPU Pod guide](runpod/README.md). |
| Slide Deck | [DapurPlan SDC Hackathon 2026 Detailed Pitch](submission/DapurPlan_SDC2026_Pitch_Detailed.pptx) |
| Demo Video | https://youtu.be/7wzRdJ89PwA |

---

## Overview

### Problem

Small food businesses must decide how much to prepare and what ingredients to buy with limited time and incomplete records. Guessing demand can contribute to shortages, unnecessary purchases, and food waste. Recipes, sales, and stock information are often tracked separately, making preparation decisions harder to review.

### Solution

DapurPlan brings recipe, sales, ingredient-price, and inventory records into one workspace. Its one-day-ahead machine-learning forecast uses recent sales patterns to estimate servings; the app translates a reviewed forecast into ingredient needs and stock shortages. Forecasts are decision support, not guarantees: the checked-in model was trained and evaluated on synthetic data, and its accuracy has not been established for a real restaurant.

### Key Features

- **Demand forecasting** — Predicts servings for up to five menu items from recent sales features.
- **Preparation planning** — Calculates recipe-based ingredient needs, compares them with usable stock, and supports draft and owner-approved plans.
- **Recipes and costing** — Maintains menu recipes, selling prices, ingredient pack costs, and saved financial snapshots.
- **Sales and expenses** — Records daily servings, sold-out status, operating expenses, and estimated sales and profit summaries.
- **Inventory management** — Tracks ingredient batches, count and expiry dates, purchase packs, and change history.
- **Spreadsheet data** — Exports and imports CSV files for supported records, with row-level validation and change history. Planning CSVs are export-only.

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend and app backend | Next.js 16.4.2 App Router, React, TypeScript, Tailwind CSS; pages and API routes hosted on Replit |
| Forecast API | Python 3.12, FastAPI, Pydantic; authenticated server-to-server requests to RunPod |
| Database | PostgreSQL for durable storage in the Replit deployment; temporary SQLite compatibility workspaces retain existing validation/store logic. This local checkout uses SQLite via `better-sqlite3`. |
| AI / Compute | Saved scikit-learn Random Forest pipeline on a RunPod CPU Pod (Ubuntu 24.04, 2 vCPU, 4 GB RAM); no GPU or Serverless inference |
| Hosting / Development | Replit Autoscale hosts the web app in Asia; RunPod hosts the forecast API. Local Next.js + SQLite + FastAPI development remains supported. |

---

## Project Structure

```text
.
├── dapurplan-synthetic-test-data/  # Spreadsheet CSV fixtures and import notes
├── model/                          # Forecast pipeline, report, and example input
├── runpod/                         # Protected CPU Pod service and deployment guide
├── scripts/
│   └── train_forecast.py           # Optional local retraining from saved sales
├── src/dapurplan/
│   ├── api.py                      # FastAPI prediction service
│   └── forecast_model.py           # Shared model feature definitions
├── tests/                          # Python API, training, and deployment tests
├── web/                            # Local Next.js application in this checkout
│   ├── src/app/                    # Next.js pages and API routes
│   ├── src/components/             # Workspace and data-entry UI
│   ├── src/lib/                    # Local SQLite stores, validation, forecasting
│   ├── tests/                      # Web application tests
│   └── docs/                       # Feature and integration notes
├── requirements-api.txt            # Python API dependencies
├── requirements-dev.txt            # Python API and test dependencies
├── pyproject.toml                  # Python project configuration
└── README.md
```

### Architecture

```text
Browser
  └──► Next.js workspace on Replit ──► PostgreSQL business database
          │                            (temporary SQLite compatibility layer)
          └──► protected FastAPI on RunPod ──► saved scikit-learn pipeline
               (HTTPS requests with a server-side bearer key)
```

The forecast service receives prepared features and does not read or modify the business database. Next.js assembles those features from saved sales. Approved plans do not automatically deduct inventory.

The deployed Replit version retains Next.js and uses PostgreSQL as its durable store. It currently runs existing store operations in disposable SQLite compatibility workspaces and synchronizes successful changes to PostgreSQL. Those Replit deployment and database changes have not yet been brought back into this local checkout; the project structure and local commands here describe the repository version.

---

## How to Run

### Requirements

- Node.js 22 (the web application was tested with Node.js 22.12.0)
- Python 3.12
- `uv` for Python environment and dependency setup

### Run locally

From the repository root, install the dependencies:

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-dev.txt
npm --prefix web install
```

On Windows PowerShell, use the Windows virtual-environment path:

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv\Scripts\python.exe -r requirements-dev.txt
cd web
npm install
cd ..
```

Start the web app and forecast API in separate terminals from the repository root.

**Terminal 1 — web app**

```bash
cd web
npm run dev
```

Open <http://127.0.0.1:4000>.

**Terminal 2 — forecast API**

```bash
PYTHONPATH=src .venv/bin/python -m uvicorn dapurplan.api:app --host 127.0.0.1 --port 8000
```

On Windows PowerShell:

```powershell
$env:PYTHONPATH = "src"
.\.venv\Scripts\python.exe -m uvicorn dapurplan.api:app --host 127.0.0.1 --port 8000
```

Wait for the API startup to complete before generating a forecast. The API documentation is at <http://127.0.0.1:8000/docs>; health information is at <http://127.0.0.1:8000/health>.

### Demo accounts

- Owner: username `owner`, password `123`
- Staff: username `staff`, password `123`

These fixed credentials describe the local prototype in this checkout. The deployed Replit version reads owner/staff passwords from Secrets and removes credential hints from the public login screen. Both versions are hackathon demonstrations, not full production account management; use fictional data and provide judge access separately.

### First use

1. Sign in to the web app.
2. Record complete sales for at least seven consecutive days for all five menu items.
3. Configure recipe prices and ingredient prices; record inventory counts.
4. Open **Tomorrow’s plan**, generate a forecast, review preparation quantities and ingredient needs, then save a draft or approve the plan as owner.

To try the spreadsheet page, use the fixtures in [`dapurplan-synthetic-test-data/`](dapurplan-synthetic-test-data/). Import recipes, ingredient prices, inventory, sales, and expenses in that order. Imports apply CSV values over current values for matching records; use a test database if you do not want to overwrite workspace data. Planning CSVs are export-only.

Local application data is stored in `web/data/dapurplan.sqlite` by default. Set `DAPURPLAN_DB_PATH` to use a different SQLite file. The local app creates the database schema on first use. The deployed Replit app uses PostgreSQL for persistence; development records and local SQLite files do not automatically become production data.

### Configuration

See [`web/.env.example`](web/.env.example) for this local checkout. For local development, the forecast API defaults to `http://127.0.0.1:8000`. To use the deployed model service, set `FORECAST_API_URL=https://jempwl1632kkc7-8000.proxy.runpod.net` and the matching private `FORECAST_API_KEY` in `web/.env.local`, then restart the web app. Keep both settings server-side and never use a `NEXT_PUBLIC_` variable for secrets.

In Replit, configure the PostgreSQL connection through its database integration and keep `FORECAST_API_KEY`, `DEMO_SESSION_SECRET`, `DEMO_OWNER_PASSWORD`, and `DEMO_STAFF_PASSWORD` in Replit Secrets. `DEMO_SESSION_SECRET` must contain at least 32 characters. The deployment-specific database adapter and password settings are implemented in the Replit version, not yet in this checkout. Production schema and demo data must be initialized separately from development; do not rely on an Autoscale filesystem to retain a SQLite database.

---

## Run Tests

From the repository root:

```bash
PYTHONPATH=src .venv/bin/python -m unittest discover -s tests -v
```

For the web application:

```bash
cd web
npm run test:production-readiness
```

The web production-readiness script runs the sales, sales UI, and spreadsheet tests, then TypeScript typechecking. Other focused web test commands are listed in [`web/package.json`](web/package.json).

---

## How We Use Replit

Replit hosts the live Next.js interface and application API routes at [dapurplan.replit.app](https://dapurplan.replit.app). The restored Next.js app is deployed with Autoscale in Asia; the temporary Vite/Express conversion is not the application being used. PostgreSQL provides durable business-data storage, with a temporary SQLite compatibility layer for the existing store operations. The web server sends forecast features to RunPod over HTTPS using a private bearer key.

The team used sponsor-provided Replit Core access and USD 20 credit for deployment preparation and hosting. Database credentials, the forecast key, session secret, and demo passwords are managed through Replit rather than committed to source. Deployment configuration, PostgreSQL migration, and login changes currently live in Replit and still need to be synchronized back to GitHub.

📄 Proof of use: [Replit proof of use](submission/SDC2026_S.E.E.S_Replit_POU.pdf).

## How We Use RunPod

RunPod runs the existing FastAPI forecast service and saved Random Forest pipeline on a **protected CPU Pod** using Ubuntu 24.04, 2 vCPU and 4 GB RAM. The team uses USD 25 of sponsor-provided credit. This deployment does not use a GPU or Serverless endpoint.

The service is available at [the protected RunPod endpoint](https://jempwl1632kkc7-8000.proxy.runpod.net). Both `/health` and `/predict` require `Authorization: Bearer <FORECAST_API_KEY>`; opening the service in a browser without the key returns `401 Unauthorized`. Local and public authenticated checks returned predictions for all five menus, and the Replit server also completed a live forecast request. The model remains synthetic-trained; successful deployment does not establish real restaurant accuracy.

The API currently runs in the background through `nohup`. Closing the terminal does not stop it, but a Pod restart or process failure requires recovery; automatic restart is not configured. A running Pod consumes credit even when idle. See [`runpod/README.md`](runpod/README.md) for setup and connection details.

📄 Proof of use: [RunPod proof of use](submission/SDC2026_S.E.E.S_Runpod_POU.pdf).

---

## Challenges & Learnings

- Keeping recipe, sales, and inventory data consistent requires validation and auditable change history.
- Forecasting requires complete, correctly dated sales history; missing data should not silently be treated as zero.
- A model evaluated only on synthetic data is not evidence of real-world restaurant accuracy. Real-world validation is still needed.

## Future Improvements

- [ ] Evaluate forecasts using verified, consented restaurant sales data and monitor performance over time.
- [ ] Replace shared demo accounts with individual user and workspace management.
- [ ] Bring Replit deployment changes back into GitHub and replace the temporary SQLite compatibility layer with native PostgreSQL stores.
- [ ] Add a workflow for importing or exporting preparation plans if supported by product requirements.

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| Muhammad Amal Irfan bin Shaharuddin | Software Development, Quality Assurance | (https://github.com/aishzy) |
| Muhammad Alif Asyraf bin Mohd Azlan | Machine Learning, Software Development  | (https://github.com/Etticx) |
| Muhammad Faiz Aiman bin Muhamad |  Software Development                       | (----) |

---

## Submission Checklist

- [x] Team name, domain, SDG track, leader, university, and member count confirmed
- [x] Slide deck and demo video links added
- [x] Replit use and proof documented, if applicable
- [x] RunPod use and proof documented, if applicable
- [x] Official preliminary submission and technology declaration completed
- [x] Required submission documents added and renamed for the team
- [x] Local web app and forecast API run instructions documented
- [x] Replit public demo and authenticated RunPod forecast connection documented
- [x] No API keys or service secrets are included in this README

## License

This project is licensed under the [Apache License 2.0](LICENSE).
