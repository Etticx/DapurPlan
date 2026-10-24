#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv-runpod/bin/python ]]; then
  echo "Create .venv-runpod and install runpod/requirements.txt first. See runpod/README.md."
  exit 1
fi
export PYTHONPATH="$PWD/src${PYTHONPATH:+:$PYTHONPATH}"
exec .venv-runpod/bin/python -m uvicorn --app-dir "$PWD/runpod" serve:create_app --factory --host 0.0.0.0 --port 8000
