"""Check health and five example predictions without printing the API key."""
import json
import math
import os
from pathlib import Path
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost")):
        raise SystemExit("Use HTTPS for a remote Pod.")
    key = os.environ.get("FORECAST_API_KEY", "")
    if len(key) < 32:
        raise SystemExit("Set FORECAST_API_KEY first (at least 32 characters).")
    headers = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
    payload = json.loads(Path(__file__).with_name("test_input.json").read_text(encoding="utf-8"))
    for route, data in [("health", None), ("predict", json.dumps(payload).encode())]:
        with urlopen(Request(base + "/" + route, data=data, headers=headers), timeout=30) as response:
            result = json.load(response)
        if route == "predict":
            rows = result["predictions"]
            assert len(rows) == 5
            assert {row["item"] for row in rows} == {row["item"] for row in payload}
            assert all(isinstance(row["predicted_servings"], (int, float)) and math.isfinite(row["predicted_servings"]) and row["predicted_servings"] >= 0 for row in rows)
        print(route + ": OK")


if __name__ == "__main__":
    main()
