"""
Local tests for the PyJHora Lambda handler — no AWS required.

Run:
    python -m venv .venv-backend && source .venv-backend/bin/activate
    pip install -r backend/requirements.txt pytest
    pytest backend/test_handler.py -v

The CORS + validation tests run without pyjhora installed; the full-compute test
is skipped automatically if pyjhora/pyswisseph aren't importable.
"""
import json
import importlib.util
import pytest

from handler import lambda_handler  # run pytest from the backend/ dir, or add it to sys.path

HAS_PYJHORA = importlib.util.find_spec("jhora") is not None

# A Lambda Function URL (HTTP API v2) event for a known birth: Mumbai, 1990-06-15 14:30 IST.
def make_event(method="POST", body=None):
    return {
        "version": "2.0",
        "requestContext": {"http": {"method": method, "path": "/"}},
        "body": json.dumps(body) if body is not None else "",
        "isBase64Encoded": False,
    }

VALID_BODY = {
    "name": "Test Person", "dob": "1990-06-15", "time": "14:30",
    "lat": 19.076, "lon": 72.877, "tz_offset": 5.5,
}


def test_cors_preflight_returns_200():
    resp = lambda_handler(make_event(method="OPTIONS"), None)
    assert resp["statusCode"] == 200
    assert resp["headers"]["Access-Control-Allow-Origin"] == "*"


def test_missing_field_returns_400():
    resp = lambda_handler(make_event(body={"name": "Test"}), None)  # missing dob/time/...
    assert resp["statusCode"] == 400
    assert "error" in json.loads(resp["body"])


def test_bad_numeric_returns_400():
    bad = {**VALID_BODY, "lat": "not-a-number"}
    resp = lambda_handler(make_event(body=bad), None)
    assert resp["statusCode"] == 400


@pytest.mark.skipif(not HAS_PYJHORA, reason="pyjhora/pyswisseph not installed")
def test_valid_request_returns_yogas_and_doshas():
    resp = lambda_handler(make_event(body=VALID_BODY), None)
    assert resp["statusCode"] == 200, resp["body"]
    data = json.loads(resp["body"])
    assert "yogas_active" in data and isinstance(data["yogas_active"], list)
    assert "doshas" in data and "manglik" in data["doshas"]
