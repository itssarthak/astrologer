"""Vedic yoga detection as a rule registry over adapter facts.

Each rule is a pure function of a context dict (planets + house lords + lagna),
returning True when the yoga is present. jyotishganit supplies dignity, shadbala
strength, graha-drishti aspects and conjunctions; we read those (never recompute).
Clean-room implementations from classical (BPHS) definitions.
"""
import json
from adapter import planet_facts, house_lords, lagna_sign, SIGN_IDX, SIGN_LORD

KENDRAS = {1, 4, 7, 10}
TRIKONAS = {1, 5, 9}
DUSTHANAS = {6, 8, 12}
NODES = {"Rahu", "Ketu"}
STRONG_DIGNITIES = {"exalted", "moolatrikona", "own"}

# planet -> the signs it rules (inverse of adapter.SIGN_LORD).
OWNED_SIGNS = {}
for _sign, _lord in SIGN_LORD.items():
    OWNED_SIGNS.setdefault(_lord, []).append(_sign)


def _aspects(ctx, giver, receiver):
    """True if `giver` casts a graha-drishti onto `receiver` (read from the
    receiver's pre-computed aspects_receives — jyotishganit already resolved drishti)."""
    pr = ctx["planets"].get(receiver)
    if not pr:
        return False
    return any(e.get("from_planet") == giver for e in pr.get("aspects_receives", []))


def _parivartana(ctx, a, b):
    """Sign exchange (parivartana): a sits in a sign b rules AND b sits in a sign a rules."""
    pa, pb = ctx["planets"].get(a), ctx["planets"].get(b)
    if not pa or not pb:
        return False
    return pa["sign"] in OWNED_SIGNS.get(b, []) and pb["sign"] in OWNED_SIGNS.get(a, [])


def _associated(ctx, a, b):
    """Classical 'association' of two planets: conjunction (same house),
    mutual aspect, or sign exchange. Two distinct planets only."""
    if a == b:
        return False
    pa, pb = ctx["planets"].get(a), ctx["planets"].get(b)
    if not pa or not pb:
        return False
    if pa["house"] == pb["house"]:
        return True
    if _aspects(ctx, a, b) and _aspects(ctx, b, a):
        return True
    return _parivartana(ctx, a, b)


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


_MAHAPURUSHA = {
    "Mars": ("Ruchaka", "Bold, disciplined, commanding — natural drive and physical courage."),
    "Mercury": ("Bhadra", "Sharp intellect and communication — quick, articulate, business-minded."),
    "Jupiter": ("Hamsa", "Wise, principled, respected — a teacher's grace and good fortune."),
    "Venus": ("Malavya", "Charm, comfort, and an eye for beauty — refined and well-liked."),
    "Saturn": ("Sasa", "Patient, hard-working, authoritative — slow-built, durable success."),
}


def _mahapurusha_present(ctx, planet):
    """One of the five Pancha Mahapurusha yogas: the planet sits in its own/
    moolatrikona/exalted sign AND in a kendra (1/4/7/10) from the lagna."""
    p = planet_in(ctx, planet)
    if not p:
        return False
    return p["house"] in KENDRAS and p["dignity"] in STRONG_DIGNITIES


YOGA_RULES = []  # populated below

for _planet, (_name, _desc) in _MAHAPURUSHA.items():
    YOGA_RULES.append({
        "id": f"mahapurusha_{_name.lower()}",
        "name": _name,
        "category": "Pancha Mahapurusha",
        "description": _desc,
        "detect": (lambda p: (lambda ctx: _mahapurusha_present(ctx, p)))(_planet),
    })


def _planets_in_house_from(ctx, anchor_house, distance, exclude=()):
    """Names of planets sitting `distance` houses from anchor_house, excluding `exclude`."""
    target = ((anchor_house - 1 + (distance - 1)) % 12) + 1
    return [name for name, p in ctx["planets"].items()
            if p["house"] == target and name not in exclude]


def _gaja_kesari(ctx):
    """Jupiter in a kendra (1/4/7/10) FROM the Moon, and not debilitated."""
    moon, jup = planet_in(ctx, "Moon"), planet_in(ctx, "Jupiter")
    if not moon or not jup:
        return False
    return house_distance(moon["house"], jup["house"]) in {1, 4, 7, 10} \
        and jup["dignity"] != "debilitated"


def _sunapha(ctx):
    """A planet other than the Sun or Moon (and not a node) in the 2nd/12th from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    return len(_planets_in_house_from(ctx, moon["house"], 2, exclude={"Sun", "Moon"} | NODES)) > 0


def _anapha(ctx):
    """A planet other than the Sun or Moon (and not a node) in the 2nd/12th from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    return len(_planets_in_house_from(ctx, moon["house"], 12, exclude={"Sun", "Moon"} | NODES)) > 0


def _durudhara(ctx):
    """Both the 2nd AND 12th from the Moon occupied (Sunapha + Anapha together)."""
    return _sunapha(ctx) and _anapha(ctx)


def _kemadruma(ctx):
    """Affliction yoga: the Moon is isolated — no planet (other than Sun/Moon) in the
    2nd or 12th from the Moon, AND no planet other than the Moon in a kendra from lagna."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    flank = (_planets_in_house_from(ctx, moon["house"], 2, exclude={"Sun", "Moon"} | NODES)
             + _planets_in_house_from(ctx, moon["house"], 12, exclude={"Sun", "Moon"} | NODES))
    if flank:
        return False
    # any non-Moon classical planet in a kendra house breaks Kemadruma
    for name, p in ctx["planets"].items():
        if name in ({"Moon"} | NODES):
            continue
        if p["house"] in KENDRAS:
            return False
    return True


YOGA_RULES.extend([
    {"id": "gaja_kesari", "name": "Gaja-Kesari", "category": "Chandra",
     "description": "Wisdom paired with standing — Jupiter strengthens the mind; brings respect, judgment and lasting reputation.",
     "detect": _gaja_kesari},
    {"id": "sunapha", "name": "Sunapha", "category": "Chandra",
     "description": "Self-made prosperity and a capable mind — gains through one's own effort.",
     "detect": _sunapha},
    {"id": "anapha", "name": "Anapha", "category": "Chandra",
     "description": "Well-rounded, healthy and well-regarded — comfort and a good name.",
     "detect": _anapha},
    {"id": "durudhara", "name": "Durudhara", "category": "Chandra",
     "description": "Generous and prosperous — supported on both sides; enjoys and shares wealth.",
     "detect": _durudhara},
    {"id": "kemadruma", "name": "Kemadruma", "category": "Chandra (affliction)",
     "description": "An isolated Moon — periods of struggle, instability or feeling unsupported; needs deliberate structure and support.",
     "detect": _kemadruma},
])


def _budha_aditya(ctx):
    """Sun and Mercury together (same house) — intelligence yoga."""
    sun, merc = planet_in(ctx, "Sun"), planet_in(ctx, "Mercury")
    return bool(sun and merc and sun["house"] == merc["house"])


def _vesi(ctx):
    """A planet other than the Sun or Moon (and not a node) in the 2nd/12th from the Sun."""
    sun = planet_in(ctx, "Sun")
    if not sun:
        return False
    return len(_planets_in_house_from(ctx, sun["house"], 2, exclude={"Sun", "Moon"} | NODES)) > 0


def _vasi(ctx):
    """A planet other than the Sun or Moon (and not a node) in the 2nd/12th from the Sun."""
    sun = planet_in(ctx, "Sun")
    if not sun:
        return False
    return len(_planets_in_house_from(ctx, sun["house"], 12, exclude={"Sun", "Moon"} | NODES)) > 0


def _ubhayachari(ctx):
    """Planets flanking the Sun on both sides (2nd AND 12th) — Vesi + Vasi together."""
    return _vesi(ctx) and _vasi(ctx)


YOGA_RULES.extend([
    {"id": "budha_aditya", "name": "Budha-Aditya", "category": "Surya",
     "description": "Bright, analytical intelligence — clear thinking, learning and communication.",
     "detect": _budha_aditya},
    {"id": "vesi", "name": "Vesi", "category": "Surya",
     "description": "Steady, balanced disposition — a measured, principled nature.",
     "detect": _vesi},
    {"id": "vasi", "name": "Vasi", "category": "Surya",
     "description": "Capable and persuasive — gains through skill and goodwill.",
     "detect": _vasi},
    {"id": "ubhayachari", "name": "Ubhayachari", "category": "Surya",
     "description": "All-round comfort and standing — well-supported, healthy, respected.",
     "detect": _ubhayachari},
])


BENEFICS = {"Mercury", "Jupiter", "Venus"}


def _chandra_mangal(ctx):
    """Moon and Mars in the same house — drive directed at wealth/security."""
    moon, mars = planet_in(ctx, "Moon"), planet_in(ctx, "Mars")
    return bool(moon and mars and moon["house"] == mars["house"])


def _adhi(ctx):
    """Two or more natural benefics in the 6th/7th/8th from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    target = {((moon["house"] - 1 + off) % 12) + 1 for off in (5, 6, 7)}  # 6th,7th,8th
    count = 0
    for b in BENEFICS:
        p = planet_in(ctx, b)
        if p and p["house"] in target:
            count += 1
    return count >= 2


def _kesari(ctx):
    """Jupiter strong (own/moolatrikona/exalted) in a kendra (1/4/7/10) from the lagna."""
    jup = planet_in(ctx, "Jupiter")
    if not jup:
        return False
    return jup["house"] in KENDRAS and jup["dignity"] in STRONG_DIGNITIES


def _lakshmi(ctx):
    """Venus strong (own/moolatrikona/exalted) AND the 9th lord strong in a kendra or trikona."""
    venus = planet_in(ctx, "Venus")
    lord9_name = ctx["lords"].get(9)
    lord9 = planet_in(ctx, lord9_name) if lord9_name else None
    if not (venus and lord9):
        return False
    return venus["dignity"] in STRONG_DIGNITIES \
        and lord9["house"] in (KENDRAS | TRIKONAS) \
        and lord9["dignity"] in STRONG_DIGNITIES


def _dharma_karmadhipati(ctx):
    """The 9th and 10th lords conjunct in the same house (a strong Raja yoga)."""
    l9, l10 = ctx["lords"].get(9), ctx["lords"].get(10)
    if not l9 or not l10 or l9 == l10:
        return False
    p9, p10 = planet_in(ctx, l9), planet_in(ctx, l10)
    if not p9 or not p10:
        return False
    return p9["house"] == p10["house"]


YOGA_RULES.extend([
    {"id": "chandra_mangal", "name": "Chandra-Mangal", "category": "Chandra",
     "description": "A strong money drive — earning power and ambition, sometimes intense about finances.",
     "detect": _chandra_mangal},
    {"id": "adhi", "name": "Adhi", "category": "Chandra",
     "description": "Leadership and prosperity — well-supported, healthy, and trusted with responsibility.",
     "detect": _adhi},
    {"id": "kesari", "name": "Kesari", "category": "Jupiter",
     "description": "A strong, well-placed Jupiter — sound judgment, optimism and protection in life.",
     "detect": _kesari},
    {"id": "lakshmi", "name": "Lakshmi", "category": "Raja",
     "description": "Wealth and grace — comfort, beauty and good fortune through the year's blessings.",
     "detect": _lakshmi},
    {"id": "dharma_karmadhipati", "name": "Dharma-Karmadhipati", "category": "Raja",
     "description": "Luck meets effort — a powerful combination for career rise and recognition.",
     "detect": _dharma_karmadhipati},
])


def _raja_kendra_trikona(ctx):
    """Generalized Raja yoga: any kendra lord (1/4/7/10) associated with any
    trikona lord (1/5/9). The lagna lord rules both, so same-planet pairs are skipped."""
    lords = ctx["lords"]
    kendra_lords = {lords.get(h) for h in (1, 4, 7, 10)} - {None}
    trikona_lords = {lords.get(h) for h in (1, 5, 9)} - {None}
    for k in kendra_lords:
        for t in trikona_lords:
            if k != t and _associated(ctx, k, t):
                return True
    return False


YOGA_RULES.append({
    "id": "raja_kendra_trikona", "name": "Raja Yoga", "category": "Raja",
    "description": "A kendra lord and a trikona lord join forces — the classic marker of rise in status, authority and worldly success.",
    "detect": _raja_kendra_trikona,
})


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
