# src/lib/pyodide/scripts/relationships.py
"""Naisargika (natural) planetary friendships (BPHS) — the canonical reference used by both
numerology compatibility and synastry. 'friend'/'enemy'/'neutral' only. Rahu follows Saturn's
set and Ketu follows Mars's set (standard convention)."""

NAISARGIKA = {
    "Sun":     {"friend": {"Moon", "Mars", "Jupiter"},   "enemy": {"Venus", "Saturn"}},
    "Moon":    {"friend": {"Sun", "Mercury"},            "enemy": set()},
    "Mars":    {"friend": {"Sun", "Moon", "Jupiter"},    "enemy": {"Mercury"}},
    "Mercury": {"friend": {"Sun", "Venus"},              "enemy": {"Moon"}},
    "Jupiter": {"friend": {"Sun", "Moon", "Mars"},       "enemy": {"Mercury", "Venus"}},
    "Venus":   {"friend": {"Mercury", "Saturn"},         "enemy": {"Sun", "Moon"}},
    "Saturn":  {"friend": {"Mercury", "Venus"},          "enemy": {"Sun", "Moon", "Mars"}},
    "Rahu":    {"friend": {"Mercury", "Venus", "Saturn"},"enemy": {"Sun", "Moon", "Mars"}},
    "Ketu":    {"friend": {"Sun", "Moon", "Jupiter"},    "enemy": {"Mercury"}},
}


def planet_relation(p_a, p_b):
    """friend | enemy | neutral between two planets (enemy dominates, then friend, else neutral)."""
    a = NAISARGIKA.get(p_a, {})
    b = NAISARGIKA.get(p_b, {})
    if p_b in a.get("enemy", set()) or p_a in b.get("enemy", set()):
        return "enemy"
    if p_b in a.get("friend", set()) or p_a in b.get("friend", set()):
        return "friend"
    return "neutral"
