# src/lib/pyodide/scripts/dignity.py
"""Interpretation helpers over a single planet fact (from adapter.planet_facts).
jyotishganit already computes dignity + shadbala; we only label/rank it here."""

# Higher = stronger placement. jyotishganit's dignity strings map onto this ladder.
DIGNITY_RANK = {
    "exalted": 5,
    "moolatrikona": 4,
    "own": 3,
    "friend": 2,
    "neutral": 1,
    "enemy": 0,
    "debilitated": -1,
}


def strength_label(fact):
    """'strong' | 'adequate' | 'weak' | 'unknown' from shadbala Rupas vs MinRequired."""
    rupas = fact.get("rupas")
    minreq = fact.get("min_required")
    if rupas is None or minreq is None:
        return "unknown"
    if rupas > minreq:
        return "strong"
    if rupas >= minreq:  # exactly meets requirement
        return "adequate"
    return "weak"
