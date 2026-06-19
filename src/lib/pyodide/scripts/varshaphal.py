import json
from datetime import datetime, timedelta
from jyotishganit import calculate_birth_chart, get_birth_chart_json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio",
         "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
SIGN_LORD = {"Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon", "Leo": "Sun",
             "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars", "Sagittarius": "Jupiter",
             "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"}
NAKSHATRA_NAMES = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu",
    "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati",
    "Vishakha", "Anuradha", "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"]
# The engine emits a couple of alternate transliterations; map them so the Mudda lord isn't
# silently wrong for those moons. Keys lowercased.
NAKSHATRA_ALIASES = {"mula": "Moola", "dhanishta": "Dhanishtha"}

def _nak_index(name):
    if name in NAKSHATRA_NAMES:
        return NAKSHATRA_NAMES.index(name)
    key = (name or "").strip().lower()
    for i, n in enumerate(NAKSHATRA_NAMES):
        if n.lower() == key:
            return i
    canon = NAKSHATRA_ALIASES.get(key)
    return NAKSHATRA_NAMES.index(canon) if canon else 0
# Vimshottari dasha lords in sequence + their years (total 120). Nakshatra lord = VIM_ORDER[nak_index % 9].
VIM_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
VIM_YEARS = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7, "Rahu": 18,
             "Jupiter": 16, "Saturn": 19, "Mercury": 17}
SIDEREAL_YEAR_DAYS = 365.25636


def _sun_longitude(js):
    for h in js["d1Chart"]["houses"]:
        for o in h.get("occupants", []):
            if o["celestialBody"] == "Sun":
                return SIGNS.index(o["sign"]) * 30 + float(o["signDegrees"])
    return None


def _ascendant(js):
    for h in js["d1Chart"]["houses"]:
        if h["number"] == 1:
            return h["sign"]
    return None


def _cast(dt, lat, lon, tz):
    return get_birth_chart_json(calculate_birth_chart(
        birth_date=dt, latitude=lat, longitude=lon, timezone_offset=tz, location_name="", name="VARSHA"))


def _signed_diff(target, current):
    """Smallest signed angular distance target-current in (-180, 180]."""
    return (target - current + 180) % 360 - 180


def solar_return(natal_sun_lon, target_year, birth_month, birth_day, birth_hour, birth_minute, lat, lon, tz):
    """Find the datetime in target_year when the Sun returns to natal_sun_lon (Newton iteration,
    Sun ~0.9856 deg/day). Returns (datetime, varsha_chart_json)."""
    t = datetime(target_year, birth_month, birth_day, birth_hour, birth_minute)
    js = _cast(t, lat, lon, tz)
    for _ in range(6):
        diff = _signed_diff(natal_sun_lon, _sun_longitude(js))
        if abs(diff) < 0.0005:
            break
        t = t + timedelta(days=diff / 0.9856)
        js = _cast(t, lat, lon, tz)
    return t, js


def mudda_dasha(start_lord, start_dt, year_days=SIDEREAL_YEAR_DAYS):
    """Annual Vimshottari: the 120-year cycle compressed into one year, sequenced from start_lord."""
    i0 = VIM_ORDER.index(start_lord)
    seq = []
    cursor = start_dt
    for k in range(9):
        lord = VIM_ORDER[(i0 + k) % 9]
        span = year_days * VIM_YEARS[lord] / 120.0
        end = cursor + timedelta(days=span)
        seq.append({"lord": lord, "start": cursor.strftime("%Y-%m-%d"), "end": end.strftime("%Y-%m-%d")})
        cursor = end
    return seq


def compute_varshaphal(natal_chart_json, target_year, lat, lon, tz,
                       birth_year, birth_month, birth_day, birth_hour, birth_minute):
    natal_sun = _sun_longitude(natal_chart_json)
    natal_lagna = _ascendant(natal_chart_json)
    # Moon nakshatra (for Mudda start lord)
    moon_nak = ""
    for h in natal_chart_json["d1Chart"]["houses"]:
        for o in h.get("occupants", []):
            if o["celestialBody"] == "Moon":
                moon_nak = o.get("nakshatra", "")
    if natal_sun is None or not natal_lagna:
        return {"error": "Natal chart is missing the Sun or ascendant."}
    sr_dt, varsha = solar_return(natal_sun, target_year, birth_month, birth_day, birth_hour, birth_minute, lat, lon, tz)
    varsha_lagna = _ascendant(varsha)
    age = target_year - birth_year
    # Muntha: natal lagna sign advanced one sign per completed year of age.
    natal_idx = SIGNS.index(natal_lagna)
    muntha_idx = (natal_idx + age) % 12
    muntha_sign = SIGNS[muntha_idx]
    vl_idx = SIGNS.index(varsha_lagna)
    muntha_house = ((muntha_idx - vl_idx) % 12) + 1
    # Mudda start lord = lord of natal Moon nakshatra. Tolerate the engine's alternate spellings
    # ("Mula"/"Dhanishta") and case/spacing so the lord isn't silently wrong for those moons.
    nak_i = _nak_index(moon_nak)
    start_lord = VIM_ORDER[nak_i % 9]
    # varsha placements (planet -> sign, house from varsha lagna)
    placements = []
    for h in varsha["d1Chart"]["houses"]:
        for o in h.get("occupants", []):
            placements.append({"planet": o["celestialBody"], "sign": o["sign"], "house": h["number"],
                               "retrograde": o.get("motion_type", "direct") == "retrograde"})
    return {
        "year": target_year,
        "age": age,
        "solar_return": {"date": sr_dt.strftime("%Y-%m-%d"), "time": sr_dt.strftime("%H:%M")},
        "varsha_lagna": varsha_lagna,
        "varsha_lagna_lord": SIGN_LORD.get(varsha_lagna),
        "muntha": {"sign": muntha_sign, "house": muntha_house, "lord": SIGN_LORD.get(muntha_sign)},
        "mudda_dasha": mudda_dasha(start_lord, sr_dt),
        "placements": placements,
    }


def compute_varshaphal_json(natal_chart_json_str, target_year, lat, lon, tz,
                            birth_year, birth_month, birth_day, birth_hour, birth_minute):
    return json.dumps(compute_varshaphal(json.loads(natal_chart_json_str), int(target_year),
                      lat, lon, tz, int(birth_year), int(birth_month), int(birth_day),
                      int(birth_hour), int(birth_minute)),
                      default=str)
