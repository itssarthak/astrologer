import json
from datetime import datetime
from jyotishganit import calculate_birth_chart, get_birth_chart_json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]


def compute_transit(natal_lagna_sign, lat, lon, tz_offset, on_date=None):
    """
    Casts a chart for the current moment (or, if on_date YYYY-MM-DD is given, for that
    date at 12:00 local — a noon midpoint) and maps each planet to the natal house it
    occupies (based on natal lagna sign).
    Returns: dict with date, panchanga, planets list
    """
    # Guard a missing/unknown lagna up front so we return a structured error the JS layer
    # can surface, rather than raising ValueError deep in an unhandled promise rejection —
    # and before doing the expensive chart computation below.
    if natal_lagna_sign not in SIGNS:
        return {"error": f"Unknown natal lagna sign: {natal_lagna_sign!r}"}

    # Reference moment: now by default, else the requested date at local noon.
    ref = datetime.now() if not on_date else datetime.strptime(on_date, "%Y-%m-%d").replace(hour=12, minute=0)
    chart = calculate_birth_chart(
        birth_date=ref,
        latitude=lat,
        longitude=lon,
        timezone_offset=tz_offset,
        location_name="",
        name="TRANSIT",
    )
    js = get_birth_chart_json(chart)

    lagna_idx = SIGNS.index(natal_lagna_sign)
    sign_to_house = {SIGNS[(lagna_idx + i) % 12]: i + 1 for i in range(12)}

    planets = []
    for h in js["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            sign = occ["sign"]
            planets.append({
                "planet": occ["celestialBody"],
                "sign": sign,
                "degrees": round(float(occ["signDegrees"]), 2),
                "nakshatra": occ["nakshatra"],
                "pada": occ.get("pada", 1),
                "natal_house": sign_to_house.get(sign, 0),
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
            })

    return {
        "date": ref.strftime("%Y-%m-%d"),
        "time": ref.strftime("%H:%M"),
        "panchanga": js["panchanga"],
        "planets": planets,
    }


def compute_transit_json(natal_lagna_sign, lat, lon, tz_offset, on_date=None):
    """Returns JSON string for Pyodide JS."""
    return json.dumps(compute_transit(natal_lagna_sign, lat, lon, tz_offset, on_date), default=str)
