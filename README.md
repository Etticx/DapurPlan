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
| Live Demo | Not deployed |
| RunPod Endpoint | Not deployed; see the [CPU Pod guide](runpod/README.md) |
| Slide Deck | [DapurPlan SDC Hackathon 2026 Detailed Pitch](submission/DapurPlan_SDC2026_Pitch_Detailed.pptx) |
| Demo Video | To be provided |

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
| Frontend and app backend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Forecast API | Python, FastAPI, Pydantic |
| Database | SQLite via `better-sqlite3` |
| AI / Compute | Scikit-learn Random Forest model; CPU inference locally or on an optionally configured RunPod CPU Pod |
| Hosting / Development | Local development is supported. Replit and RunPod deployment links are not configured yet. |

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
├── web/
│   ├── src/app/                    # Next.js pages and API routes
│   ├── src/components/             # Workspace and data-entry UI
│   ├── src/lib/                    # SQLite stores, validation, forecasting
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
  └──► Next.js workspace ──► SQLite business database
          │
          └──► FastAPI forecast service ──► saved scikit-learn pipeline
               (localhost by default; protected RunPod CPU Pod is optional)
```

The forecast service receives prepared features and does not read or modify the business database. Next.js assembles those features from saved sales. Approved plans do not automatically deduct inventory.

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

These fixed accounts are for local prototype use only. They are not production authentication. Keep the app private and bound to localhost unless proper deployment security is configured.

### First use

1. Sign in to the web app.
2. Record complete sales for at least seven consecutive days for all five menu items.
3. Configure recipe prices and ingredient prices; record inventory counts.
4. Open **Tomorrow’s plan**, generate a forecast, review preparation quantities and ingredient needs, then save a draft or approve the plan as owner.

To try the spreadsheet page, use the fixtures in [`dapurplan-synthetic-test-data/`](dapurplan-synthetic-test-data/). Import recipes, ingredient prices, inventory, sales, and expenses in that order. Imports apply CSV values over current values for matching records; use a test database if you do not want to overwrite workspace data. Planning CSVs are export-only.

Application data is stored in `web/data/dapurplan.sqlite` by default. Set `DAPURPLAN_DB_PATH` to use a different SQLite file. The app creates the database schema on first use.

### Configuration

See [`web/.env.example`](web/.env.example). For local development, the forecast API defaults to `http://127.0.0.1:8000`. To use another forecast service, set `FORECAST_API_URL` in `web/.env.local` and restart the web app. `FORECAST_API_KEY` is only needed when connecting to the protected RunPod service; keep it server-side and never use a `NEXT_PUBLIC_` variable.

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

Replit hosting and team use have not been verified or configured in this repository. No `.replit` run configuration, live Replit demo URL, or proof-of-use document is currently included. If the team uses Replit, document the actual development/deployment workflow here and store secrets in Replit Secrets rather than in source files.

📄 Proof of use: not yet provided. Add the official, completed document under `submission/` when available.

## How We Use RunPod

This repository includes instructions for running the forecast API on a **protected RunPod CPU Pod**; it does not use a RunPod GPU or Serverless endpoint. No deployed endpoint is currently listed. The Pod service requires a private `FORECAST_API_KEY` of at least 32 characters and accepts authenticated prediction requests. See [`runpod/README.md`](runpod/README.md) for setup and connection details.

📄 Proof of use: not yet provided. Add the official, completed document under `submission/` if RunPod is used for the project.

---

## Challenges & Learnings

- Keeping recipe, sales, and inventory data consistent requires validation and auditable change history.
- Forecasting requires complete, correctly dated sales history; missing data should not silently be treated as zero.
- A model evaluated only on synthetic data is not evidence of real-world restaurant accuracy. Real-world validation is still needed.

## Future Improvements

- [ ] Evaluate forecasts using verified, consented restaurant sales data and monitor performance over time.
- [ ] Replace fixed demo accounts with secure user and workspace management before deployment.
- [ ] Provision and verify hosted services and persistent database storage before publishing live links.
- [ ] Add a workflow for importing or exporting preparation plans if supported by product requirements.

## Team

| Name | Role | GitHub |
| --- | --- | --- |
| To be provided | To be provided | To be provided |

---

## Submission Checklist

- [ ] Team name, domain, SDG track, leader, university, and member count confirmed
- [ ] Slide deck and demo video links added
- [ ] Replit use and proof documented, if applicable
- [ ] RunPod use and proof documented, if applicable
- [ ] Official preliminary submission and technology declaration completed
- [ ] Required submission documents added and renamed for the team
- [x] Local web app and forecast API run instructions documented
- [ ] Deployment and public demo links verified before publication
- [x] No API keys or service secrets are included in this README

## License

This project is licensed under the [Apache License 2.0](LICENSE).
