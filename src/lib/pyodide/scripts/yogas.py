"""Vedic yoga detection as a rule registry over adapter facts.

Each rule is a pure function of a context dict (planets + house lords + lagna),
returning True when the yoga is present. jyotishganit supplies dignity, shadbala
strength, graha-drishti aspects and conjunctions; we read those (never recompute).
Clean-room implementations from classical (BPHS) definitions.
"""
import json
from adapter import planet_facts, house_lords, lagna_sign, SIGN_IDX

KENDRAS = {1, 4, 7, 10}
TRIKONAS = {1, 5, 9}
DUSTHANAS = {6, 8, 12}
NODES = {"Rahu", "Ketu"}
STRONG_DIGNITIES = {"exalted", "moolatrikona", "own"}


def _context(chart_json):
    """Build the per-chart context every rule consumes."""
    return {
        "planets": planet_facts(chart_json),
        "lords": house_lords(chart_json),
        "lagna_idx": SIGN_IDX[lagna_sign(chart_json)],
    }


def house_distance(from_house, to_house):
    """1-based count from from_house to to_house (inclusive of the destination),
    e.g. the 7th from H1 is distance 7; same house is 1."""
    return ((to_house - from_house) % 12) + 1


def planet_in(ctx, planet):
    """The planet's fact dict, or None if not placed (e.g. some charts omit a body)."""
    return ctx["planets"].get(planet)


YOGA_RULES = []  # populated by later tasks


def compute_yogas(chart_json):
    """Run every registered rule; return active yogas as {name, category, description}."""
    ctx = _context(chart_json)
    out = []
    for rule in YOGA_RULES:
        try:
            if rule["detect"](ctx):
                out.append({
                    "name": rule["name"],
                    "category": rule["category"],
                    "description": rule["description"],
                })
        except Exception:
            # A malformed/edge chart must never crash the whole reading — skip the rule.
            continue
    return out


def compute_yogas_json(chart_json_str):
    """Worker entry point: accepts JSON string, returns JSON string."""
    return json.dumps(compute_yogas(json.loads(chart_json_str)), default=str)
