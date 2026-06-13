# src/lib/pyodide/scripts/adapter.py
"""Convert jyotishganit chart JSON into one clean internal 'facts' structure.

This is the single source of truth for chart shape: every downstream rule module
(dignity, aspects, yogas, doshas, synastry) consumes adapter output, never the raw
jyotishganit JSON. Extraction only — no astrological interpretation here.
"""
import json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
SIGN_IDX = {s: i for i, s in enumerate(SIGNS)}


def planet_facts(chart_json):
    """planet name -> normalized fact dict (sign, house, strength, aspects, ...)."""
    out = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            sb = (occ.get("shadbala") or {}).get("Shadbala", {})
            meets = sb.get("MeetsRequirement", "No")
            asp = occ.get("aspects") or {}
            out[occ["celestialBody"]] = {
                "sign": occ["sign"],
                "sign_idx": SIGN_IDX.get(occ["sign"], -1),
                "house": h["number"],
                "longitude": round(float(occ.get("signDegrees", 0.0)), 4),
                "nakshatra": occ.get("nakshatra", ""),
                "pada": occ.get("pada", 1),
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
                "dignity": (occ.get("dignities") or {}).get("dignity", "neutral"),
                "rupas": sb.get("Rupas"),
                "min_required": sb.get("MinRequired"),
                "meets": meets,
                "is_strong": meets == "Yes",
                "conjuncts": list(occ.get("conjuncts", []) or []),
                "aspects_gives": list(asp.get("gives", []) or []),
                "aspects_receives": list(asp.get("receives", []) or []),
            }
    return out


SIGN_LORD = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter",
}


def lagna_sign(chart_json):
    """Ascendant sign (House 1's sign)."""
    for h in chart_json["d1Chart"]["houses"]:
        if h["number"] == 1:
            return h["sign"]
    return chart_json["d1Chart"]["houses"][0]["sign"]


def house_lords(chart_json):
    """house number (1..12) -> ruling planet, walking from the lagna sign."""
    lagna_i = SIGN_IDX[lagna_sign(chart_json)]
    return {i + 1: SIGN_LORD[SIGNS[(lagna_i + i) % 12]] for i in range(12)}


from datetime import datetime


def _active_period(periods, ref):
    """Given {name: {start, end, <subkey>?}}, return (name, node) whose [start,end) holds ref.
    Dates are 'YYYY-MM-DD' strings — lexicographic compare is correct for ISO dates."""
    for name, node in (periods or {}).items():
        if node.get("start", "9999") <= ref < node.get("end", "0000"):
            return name, node
    # ref past the last end (e.g. tree truncated) -> fall back to the last period.
    if periods:
        name = list(periods.keys())[-1]
        return name, periods[name]
    return None, {}


def current_dasha_chain(chart_json, ref_date=None):
    """Walk maha -> antar -> pratyantar for ref_date (default: today). Returns
    {'maha','antar','pratyantar'} planet names (any level may be None if absent)."""
    ref = ref_date or datetime.now().strftime("%Y-%m-%d")
    mahadashas = ((chart_json.get("dashas") or {}).get("all") or {}).get("mahadashas") or {}
    maha_name, maha = _active_period(mahadashas, ref)
    antar_name, antar = _active_period(maha.get("antardashas") if maha else None, ref)
    praty_name, _ = _active_period(antar.get("pratyantardashas") if antar else None, ref)
    return {"maha": maha_name, "antar": antar_name, "pratyantar": praty_name}


def divisional_positions(chart_json, varga):
    """Extract placements for a divisional chart, e.g. 'd9' (Navamsa).
    Returns {varga, ascendant, placements:[{planet, sign, house}]} or {error}."""
    charts = chart_json.get("divisionalCharts") or {}
    dv = charts.get(varga)
    if not dv or "houses" not in dv:
        return {"error": f"Unknown or unavailable divisional chart: {varga!r}"}
    placements = []
    for h in dv["houses"]:
        for occ in h.get("occupants", []):
            placements.append({
                "planet": occ["celestialBody"],
                "sign": occ["sign"],
                "house": h["number"],
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
            })
    return {
        "varga": varga,
        "ascendant": dv.get("ascendant"),
        "placements": placements,
    }
