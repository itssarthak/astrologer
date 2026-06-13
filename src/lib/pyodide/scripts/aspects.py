# src/lib/pyodide/scripts/aspects.py
"""Graha-drishti surfacing over adapter facts. jyotishganit already computes which
planets/houses each planet aspects (aspects.gives/receives); we add the degree-orb
tightness legend and a readable summary."""


def orb_within_sign(deg_a, deg_b):
    """Shortest separation of two within-sign degrees on the 30-degree wheel."""
    d = abs(float(deg_a) - float(deg_b)) % 30
    return round(min(d, 30 - d), 2)


def tightness(orb):
    """Weighting band for an aspect orb (skill legend)."""
    if orb <= 3:
        return "tight"     # full strength
    if orb <= 7:
        return "active"    # weight modestly
    if orb <= 10:
        return "loose"     # colouring only
    return "noted"         # list, do not act on


def aspect_summary(facts, planet):
    """Readable drishti summary for one planet from its adapter fact."""
    f = facts.get(planet, {})
    gives = f.get("aspects_gives", [])
    receives = f.get("aspects_receives", [])
    return {
        "aspects_planets": [g["to_planet"] for g in gives if "to_planet" in g],
        "aspects_houses": [g["to_house"] for g in gives if "to_house" in g],
        "aspected_by": [r["from_planet"] for r in receives if "from_planet" in r],
        "conjuncts": list(f.get("conjuncts", [])),
    }
