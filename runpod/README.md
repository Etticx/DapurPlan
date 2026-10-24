# Runpod CPU deployment

This folder runs DapurPlan's existing forecast model on a **CPU Pod** using FastAPI. It does not retrain the model. A Serverless `handler.py` is not needed for this setup.

Flow: browser → Next.js on Replit → protected FastAPI on Runpod → JSON predictions → Replit → browser.

## 1. Create the Pod when ready

Use the official Ubuntu 24.04 CPU template. Start with 2 vCPU and 4 GB RAM, then measure performance before judging. Expose HTTP ports **8000** (FastAPI) and **8888** (optional Jupyter). SSH uses TCP port 22.

Generate a secret locally with Python: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Store it as `FORECAST_API_KEY` in the Pod's environment variables. Keep it private and use the same value in Replit Secrets.

## 2. Install the project

In the Pod terminal, clone or upload the **whole repository**, including `src/`, `model/forecast_model.joblib`, and `model/training_report.json`. The commands below assume `/workspace/DapurPlan`:

```bash
cd /workspace/DapurPlan
python3.12 --version
python3.12 -m venv .venv-runpod
.venv-runpod/bin/python -m pip install -r runpod/requirements.txt
bash runpod/start.sh
```

Use Python 3.12. If `python3.12` is missing, install Python 3.12 and its venv package before continuing. The startup command stays running in that terminal; closing the process stops the API. For judging, configure your Pod startup command or a process supervisor to run this script after installation, and test a restart.

The service refuses to start without a key of at least 32 characters. All routes, including health and API documentation, require `Authorization: Bearer <key>`.

## 3. Check it

In another Pod terminal with the same environment variable:

```bash
cd /workspace/DapurPlan
.venv-runpod/bin/python runpod/check_service.py
```

`test_input.json` contains fictional sales for all five menu items. This check uses the saved model and does not change sales records.

## 4. Connect Replit

Set these server-side Replit Secrets:

```text
FORECAST_API_URL=https://<POD_ID>-8000.proxy.runpod.net
FORECAST_API_KEY=<same private key as the Pod>
```

Use the HTTP service URL shown by Runpod for port 8000. Do not add `/predict` to the URL; the app adds it. Restart the Replit app after changing secrets, then test the full forecast flow. Never use a `NEXT_PUBLIC_` variable for this key.

The web app and business database stay with the web deployment; do not upload the SQLite database to the model Pod. Database deployment still needs separate preparation.

## Storage and cost

A running Pod consumes credit even without requests. Container storage is temporary; `/workspace` alone does not guarantee persistence. Configure persistent storage if needed, and retain code and model backups outside the Pod. Check the displayed compute and storage charges before deploying. This folder does not deploy or purchase resources automatically.
