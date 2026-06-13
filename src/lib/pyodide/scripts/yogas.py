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

# Nabhasa-core support: the 7 classical planets, sign modalities, and natural temperaments.
CLASSICAL = ("Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn")
MOVABLE = {0, 3, 6, 9}      # Aries, Cancer, Libra, Capricorn
FIXED = {1, 4, 7, 10}       # Taurus, Leo, Scorpio, Aquarius
DUAL = {2, 5, 8, 11}        # Gemini, Virgo, Sagittarius, Pisces
NATURAL_BENEFICS = {"Jupiter", "Venus", "Mercury", "Moon"}
NATURAL_MALEFICS = {"Sun", "Mars", "Saturn"}


def _classical(ctx):
    """Facts of the 7 classical planets present in the chart."""
    return [ctx["planets"][p] for p in CLASSICAL if p in ctx["planets"]]


def _classical_houses(ctx):
    """Set of houses (1..12) occupied by the 7 classical planets present."""
    return {p["house"] for p in _classical(ctx) if p.get("house")}


def _all_classical_in(ctx, houses):
    """True if every classical planet present sits within `houses` (non-empty)."""
    hs = _classical_houses(ctx)
    return bool(hs) and hs <= set(houses)

# planet -> the signs it rules (inverse of adapter.SIGN_LORD).
OWNED_SIGNS = {}
for _sign, _lord in SIGN_LORD.items():
    OWNED_SIGNS.setdefault(_lord, []).append(_sign)

# The planet exalted in each sign (signs with no exaltation are omitted).
EXALTED_IN_SIGN = {
    "Aries": "Sun", "Taurus": "Moon", "Cancer": "Jupiter", "Virgo": "Mercury",
    "Libra": "Saturn", "Capricorn": "Mars", "Pisces": "Venus",
}


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
    """A planet other than the Sun or Moon (and not a node) in the 2nd from the Moon."""
    moon = planet_in(ctx, "Moon")
    if not moon:
        return False
    return len(_planets_in_house_from(ctx, moon["house"], 2, exclude={"Sun", "Moon"} | NODES)) > 0


def _anapha(ctx):
    """A planet other than the Sun or Moon (and not a node) in the 12th from the Moon."""
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
    """A planet other than the Sun or Moon (and not a node) in the 2nd from the Sun."""
    sun = planet_in(ctx, "Sun")
    if not sun:
        return False
    return len(_planets_in_house_from(ctx, sun["house"], 2, exclude={"Sun", "Moon"} | NODES)) > 0


def _vasi(ctx):
    """A planet other than the Sun or Moon (and not a node) in the 12th from the Sun."""
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


def _viparita(ctx, lord_house):
    """Viparita Raja yoga: the lord of a dusthana (6/8/12) is itself placed in a
    dusthana (6/8/12) — adversity turning to advantage."""
    lord = ctx["lords"].get(lord_house)
    p = ctx["planets"].get(lord) if lord else None
    return bool(p and p["house"] in DUSTHANAS)


YOGA_RULES.extend([
    {"id": "viparita_harsha", "name": "Harsha (Viparita Raja)", "category": "Viparita Raja",
     "description": "The 6th lord falls in a dusthana — enemies, debts and health troubles turn into strength; you outlast your obstacles.",
     "detect": (lambda ctx: _viparita(ctx, 6))},
    {"id": "viparita_sarala", "name": "Sarala (Viparita Raja)", "category": "Viparita Raja",
     "description": "The 8th lord falls in a dusthana — resilience through crises; long life and recovery from setbacks.",
     "detect": (lambda ctx: _viparita(ctx, 8))},
    {"id": "viparita_vimala", "name": "Vimala (Viparita Raja)", "category": "Viparita Raja",
     "description": "The 12th lord falls in a dusthana — losses convert to gains; thrift and good conduct bring quiet prosperity.",
     "detect": (lambda ctx: _viparita(ctx, 12))},
])


def _kendra_from(ctx, planet, anchor_house):
    """True if `planet` sits in a kendra (1/4/7/10) counted from anchor_house."""
    p = ctx["planets"].get(planet)
    return bool(p and house_distance(anchor_house, p["house"]) in KENDRAS)


def _neecha_bhanga(ctx):
    """Neecha Bhanga Raja yoga: a planet is debilitated, but its weakness is cancelled
    because either the dispositor of its sign OR the planet exalted in that sign sits in
    a kendra from the lagna or from the Moon."""
    moon = ctx["planets"].get("Moon")
    moon_house = moon["house"] if moon else None
    for name, p in ctx["planets"].items():
        if name in NODES or p["dignity"] != "debilitated":
            continue
        rescuers = [r for r in (SIGN_LORD.get(p["sign"]), EXALTED_IN_SIGN.get(p["sign"])) if r]
        for r in rescuers:
            rp = ctx["planets"].get(r)
            if not rp:
                continue
            if rp["house"] in KENDRAS:  # kendra from the lagna (house is lagna-relative)
                return True
            if moon_house and _kendra_from(ctx, r, moon_house):
                return True
    return False


YOGA_RULES.append({
    "id": "neecha_bhanga", "name": "Neecha Bhanga Raja Yoga", "category": "Raja (cancellation)",
    "description": "A debilitated planet's weakness is cancelled — an early struggle in that area of life tends to reverse into notable strength and success later.",
    "detect": _neecha_bhanga,
})


def _dhana(ctx):
    """Dhana (wealth) yoga: the lord of the 2nd (accumulated wealth) and the lord of
    the 11th (gains/income) are associated — conjunction, mutual aspect, or exchange."""
    l2, l11 = ctx["lords"].get(2), ctx["lords"].get(11)
    if not l2 or not l11 or l2 == l11:
        return False
    return _associated(ctx, l2, l11)


YOGA_RULES.append({
    "id": "dhana_2_11", "name": "Dhana Yoga", "category": "Dhana",
    "description": "The lords of wealth (2nd) and gains (11th) combine — strong support for accumulating money and assets through the right channels.",
    "detect": _dhana,
})


# --- Nabhasa core: Sankhya, Asraya, Dala (classical 7 planets only) ---

def _sankhya_count(ctx):
    """Number of distinct signs the 7 classical planets occupy (Sankhya).
    Only planets with a valid sign_idx (>= 0) are counted; nodes are excluded."""
    signs = {p["sign_idx"] for p in _classical(ctx)
             if isinstance(p.get("sign_idx"), int) and p["sign_idx"] >= 0}
    return len(signs)


_SANKHYA = {
    7: ("nabhasa_vallaki", "Vallaki", "Veena — a life rich in variety, arts and many interests"),
    6: ("nabhasa_damini", "Damini", "wealth and generosity, well-distributed energies"),
    5: ("nabhasa_pasa", "Pasa", "hard-working, capable of juggling many ties and duties"),
    4: ("nabhasa_kedara", "Kedara", "steady, productive, helpful to many — like fertile fields"),
    3: ("nabhasa_soola", "Soola", "sharp and one-pointed, but can be harsh or struggle-prone"),
    2: ("nabhasa_yuga", "Yuga", "polarised focus — strong drives pulling in two directions"),
    1: ("nabhasa_gola", "Gola", "intensely concentrated energy in one area; lopsided life"),
}

YOGA_RULES.extend([
    {"id": _id, "name": _name, "category": "Nabhasa (Sankhya)", "description": _desc,
     "detect": (lambda n: (lambda ctx: _sankhya_count(ctx) == n))(_n)}
    for _n, (_id, _name, _desc) in _SANKHYA.items()
])


def _asraya(ctx, modality):
    """True if every classical planet present sits in a sign of the given modality
    (and at least one such planet exists). Planets with sign_idx < 0 disqualify the chart."""
    facts = _classical(ctx)
    if not facts:
        return False
    return all(isinstance(p.get("sign_idx"), int) and p["sign_idx"] in modality for p in facts)


YOGA_RULES.extend([
    {"id": "nabhasa_rajju", "name": "Rajju", "category": "Nabhasa (Asraya)",
     "description": "restless, travel-loving, always on the move; success away from home",
     "detect": (lambda ctx: _asraya(ctx, MOVABLE))},
    {"id": "nabhasa_musala", "name": "Musala", "category": "Nabhasa (Asraya)",
     "description": "fixed, determined, dignified — steady wealth and a strong will",
     "detect": (lambda ctx: _asraya(ctx, FIXED))},
    {"id": "nabhasa_nala", "name": "Nala", "category": "Nabhasa (Asraya)",
     "description": "adaptable and clever, but uneven fortunes; resourceful under change",
     "detect": (lambda ctx: _asraya(ctx, DUAL))},
])


def _dala(ctx, group):
    """Dala: every planet of `group` present in the chart sits in a kendra (1/4/7/10),
    AND those planets occupy at least 3 distinct kendra houses. Returns False when no
    planet of the group is present (no vacuous fire)."""
    present = [ctx["planets"][n] for n in group if n in ctx["planets"]]
    if not present:
        return False
    if not all(p["house"] in KENDRAS for p in present):
        return False
    return len({p["house"] for p in present}) >= 3


YOGA_RULES.extend([
    {"id": "nabhasa_mala", "name": "Maalaa", "category": "Nabhasa (Dala)",
     "description": "Maalaa — comfort, helpful friends and a pleasant, well-supported life",
     "detect": (lambda ctx: _dala(ctx, NATURAL_BENEFICS))},
    {"id": "nabhasa_sarpa", "name": "Sarpa", "category": "Nabhasa (Dala)",
     "description": "Sarpa — struggle and hardship; resilience built through difficulty",
     "detect": (lambda ctx: _dala(ctx, NATURAL_MALEFICS))},
])


# --- Nabhasa: Akriti (shape by the houses the 7 classical planets occupy) ---

# Fixed-house-set shapes: fire when every classical planet present sits within S.
_AKRITI_FIXED = [
    ("nabhasa_yupa", "Yupa", {1, 2, 3, 4},
     "self-reliant, ritual/disciplined, focused on security and roots"),
    ("nabhasa_ishu", "Ishu (Sara)", {4, 5, 6, 7},
     "sharp and incisive; good with tools, defence, or precise skills"),
    ("nabhasa_sakti", "Sakti", {7, 8, 9, 10},
     "patient and enduring; rewards come later, through perseverance"),
    ("nabhasa_danda", "Danda", {10, 11, 12, 1},
     "ups and downs; hard-won independence, sometimes isolation"),
    ("nabhasa_nauka", "Nauka", {1, 2, 3, 4, 5, 6, 7},
     "industrious and self-made; gains through one's own effort, fond of water/travel"),
    ("nabhasa_koota", "Koota", {4, 5, 6, 7, 8, 9, 10},
     "guarded and self-protective; works behind defences, can face confinement/struggle"),
    ("nabhasa_chatra", "Chatra", {7, 8, 9, 10, 11, 12, 1},
     "protective and benevolent; supports others, comfort in the latter half of life"),
    ("nabhasa_chapa", "Chapa (Dhanu)", {10, 11, 12, 1, 2, 3, 4},
     "restless and freedom-loving; gains through travel or trade, dislikes constraint"),
    ("nabhasa_chakra", "Chakra", {1, 3, 5, 7, 9, 11},
     "regal, idealistic, rises to authority"),
    ("nabhasa_samudra", "Samudra", {2, 4, 6, 8, 10, 12},
     "wealthy and well-resourced; broad means and many enjoyments"),
    ("nabhasa_sakata", "Sakata", {1, 7},
     "fluctuating fortunes — wheel-like rise and fall; resilience needed"),
    ("nabhasa_vihaga", "Vihaga (Pakshi)", {4, 10},
     "always travelling/seeking; restless, opportunistic, lives by movement"),
    ("nabhasa_sringataka", "Sringataka", {1, 5, 9},
     "happy, devoted and fortunate; good family life and faith"),
    ("nabhasa_kamala", "Kamala", {1, 4, 7, 10},
     "lotus — fame, virtue and lasting prosperity; a strong, accomplished life"),
    ("nabhasa_vapi", "Vapi", {2, 3, 5, 6, 8, 9, 11, 12},
     "accumulates and conserves wealth steadily; quietly well-off"),
]

YOGA_RULES.extend([
    {"id": _id, "name": _name, "category": "Nabhasa (Akriti)", "description": _desc,
     "detect": (lambda s: (lambda ctx: _all_classical_in(ctx, s)))(_s)}
    for _id, _name, _s, _desc in _AKRITI_FIXED
])


# Gada: all classical planets confined to two ADJACENT kendras.
_GADA_PAIRS = ({1, 4}, {4, 7}, {7, 10}, {10, 1})


def _gada(ctx):
    return any(_all_classical_in(ctx, pair) for pair in _GADA_PAIRS)


# Hala: all confined to one mutual-trine set NOT anchored on the lagna.
_HALA_TRINES = ({2, 6, 10}, {3, 7, 11}, {4, 8, 12})


def _hala(ctx):
    return any(_all_classical_in(ctx, tri) for tri in _HALA_TRINES)


def _ardha_chandra(ctx):
    """The 7 classical planets occupy 7 consecutive houses whose run does NOT start
    on a kendra: a start house h not in {1,4,7,10} covers every occupied house."""
    if len(_classical(ctx)) != 7:
        return False
    hs = _classical_houses(ctx)
    if not hs:
        return False
    for h in range(1, 13):
        if h in KENDRAS:
            continue
        run = {((h - 1 + k) % 12) + 1 for k in range(7)}
        if hs <= run:
            return True
    return False


def _present(ctx, names):
    """Facts of the named planets present in the chart."""
    return [ctx["planets"][n] for n in names if n in ctx["planets"]]


def _vajra(ctx):
    """Every natural benefic present in {1,7} AND every natural malefic present in
    {4,10}, with at least one of each present."""
    ben = _present(ctx, NATURAL_BENEFICS)
    mal = _present(ctx, NATURAL_MALEFICS)
    if not ben or not mal:
        return False
    return all(p["house"] in {1, 7} for p in ben) and all(p["house"] in {4, 10} for p in mal)


def _yava(ctx):
    """Every natural malefic present in {1,7} AND every natural benefic present in
    {4,10}, with at least one of each present."""
    ben = _present(ctx, NATURAL_BENEFICS)
    mal = _present(ctx, NATURAL_MALEFICS)
    if not ben or not mal:
        return False
    return all(p["house"] in {1, 7} for p in mal) and all(p["house"] in {4, 10} for p in ben)


YOGA_RULES.extend([
    {"id": "nabhasa_gada", "name": "Gada", "category": "Nabhasa (Akriti)",
     "description": "energetic and acquisitive; devoted to wealth, ritual and music",
     "detect": _gada},
    {"id": "nabhasa_hala", "name": "Hala", "category": "Nabhasa (Akriti)",
     "description": "hard agricultural-style toil; gains through labour, can struggle with want",
     "detect": _hala},
    {"id": "nabhasa_ardha_chandra", "name": "Ardha Chandra", "category": "Nabhasa (Akriti)",
     "description": "half-moon — handsome, strong, favoured by leaders; commands respect",
     "detect": _ardha_chandra},
    {"id": "nabhasa_vajra", "name": "Vajra", "category": "Nabhasa (Akriti)",
     "description": "happy at the start and end of life, with a tougher middle; brave",
     "detect": _vajra},
    {"id": "nabhasa_yava", "name": "Yava", "category": "Nabhasa (Akriti)",
     "description": "tougher start and end, comfortable middle years; charitable, steady",
     "detect": _yava},
])


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
