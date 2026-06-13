import json
import sys

def lambda_handler(event, context):
    """
    AWS Lambda entry point. Accepts birth data, returns PyJHora yogas + doshas.

    Event body (JSON):
    {
      "name": str, "dob": "YYYY-MM-DD", "time": "HH:MM",
      "lat": float, "lon": float, "tz_offset" | "timezone_offset": float
    }

    Response body (JSON):
    { "yogas_active": [...], "doshas": {...} }
    """
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    # Handle CORS preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        body = json.loads(event.get("body", "{}"))
        name = body["name"]
        dob = body["dob"]           # "YYYY-MM-DD"
        time_str = body["time"]     # "HH:MM"
        lat = float(body["lat"])
        lon = float(body["lon"])
        # The web client sends "timezone_offset"; accept either spelling.
        if "tz_offset" in body:
            tz_offset = float(body["tz_offset"])
        else:
            tz_offset = float(body["timezone_offset"])
    except (KeyError, ValueError) as e:
        return {
            "statusCode": 400,
            "headers": headers,
            "body": json.dumps({"error": f"Invalid input: {e}"}),
        }

    try:
        from jhora.horoscope.chart import yoga as jhora_yoga
        from jhora.horoscope.chart import dosha as jhora_dosha
        from jhora import utils

        year, month, day = [int(x) for x in dob.split("-")]
        hour, minute = [int(x) for x in time_str.split(":")]

        place = utils.Place(name, lat, lon, tz_offset)
        jd = utils.julian_day_number((year, month, day), (hour, minute, 0))

        # Yogas
        yogas_raw = jhora_yoga.get_yoga_details(jd, place)
        yogas_active = [
            {"name": y[0], "description": y[1]}
            for y in (yogas_raw or [])
            if y and len(y) >= 2
        ]

        # Doshas
        doshas = {}
        try:
            manglik = jhora_dosha.manglik_dosha(jd, place)
            doshas["manglik"] = {"present": bool(manglik[0]), "text": str(manglik[1])}
        except Exception:
            doshas["manglik"] = {"present": False, "text": "Could not compute"}

        try:
            kala_sarpa = jhora_dosha.kala_sarpa_dosha(jd, place)
            doshas["kala_sarpa"] = {"present": bool(kala_sarpa[0]), "text": str(kala_sarpa[1])}
        except Exception:
            doshas["kala_sarpa"] = {"present": False, "text": "Could not compute"}

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"yogas_active": yogas_active, "doshas": doshas}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)}),
        }
