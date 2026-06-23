import json

from relationships import planet_relation, NAISARGIKA
from adapter import chart_facts
from aspects import orb_within_sign, tightness

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]
NAKSHATRA_INDEX = {n: i for i, n in enumerate(NAKSHATRA_NAMES)}
# The chart engine (jyotishganit) emits a couple of transliteration spellings that differ from the
# list above. Without these, _nak_idx would silently fall back to 0 (Ashwini) and miscompute every
# nakshatra-based koota for those moons. Keys are lowercased.
NAKSHATRA_ALIASES = {"mula": "Moola", "dhanishta": "Dhanishtha"}

VARNA = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"]  # ranks, highest -> lowest (Varna is moon-sign based; see SIGN_VARNA)
# Display names for the per-person koota attributes (indices match the lookup tables below).
VASHYA_NAMES = ["Chatushpada", "Manava", "Jalachara", "Vanachara", "Keeta"]
GANA_NAMES = ["Deva", "Manushya", "Rakshasa"]
NADI_NAMES = ["Vata", "Pitta", "Kapha"]
# Standard classical Gana classification, 9 each (Deva / Manushya / Rakshasa), indexed
# Ashwini..Revati. Confirmed against published Ashtakoota sources (jagannathhora.com,
# rashidarshan.com). 0=Deva, 1=Manushya, 2=Rakshasa.
NAK_GANA = [
    0,1,2,1,0,1,0,0,2,2,1,1,0,2,0,2,0,2,2,1,1,0,2,2,1,1,0
]
NAK_NADI = [
    0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2
]  # 0=Vata, 1=Pitta, 2=Kapha
# Yoni koota — each nakshatra maps to one of 14 animal yonis; compatibility comes from the
# classical animal-pair table (same yoni 4, friendly 3, neutral 2, inimical 1, sworn enemy 0).
YONI_ANIMALS = [
    "Horse", "Elephant", "Sheep", "Serpent", "Dog", "Cat", "Rat",
    "Cow", "Buffalo", "Tiger", "Deer", "Monkey", "Mongoose", "Lion",
]
# nakshatra index (0=Ashwini..26=Revati) -> yoni animal index
NAK_YONI = [
    0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1,
]
# Symmetric 14x14 yoni compatibility points (rows/cols follow YONI_ANIMALS). Diagonal = 4
# (same yoni); the seven sworn-enemy pairs = 0. Validated for symmetry at import below.
YONI_KOOTA = [
    [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],  # Horse
    [2, 4, 3, 3, 2, 2, 2, 2, 3, 2, 3, 3, 2, 0],  # Elephant
    [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 2],  # Sheep
    [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],  # Serpent
    [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],  # Dog
    [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],  # Cat
    [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 2, 1],  # Rat
    [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],  # Cow
    [0, 3, 3, 1, 2, 2, 2, 3, 4, 2, 2, 2, 2, 1],  # Buffalo
    [1, 2, 1, 2, 1, 1, 2, 0, 2, 4, 2, 2, 2, 1],  # Tiger
    [3, 3, 2, 2, 0, 3, 2, 3, 2, 2, 4, 2, 2, 1],  # Deer
    [3, 3, 0, 2, 2, 3, 2, 2, 2, 2, 2, 4, 2, 3],  # Monkey
    [2, 2, 3, 0, 1, 2, 2, 2, 2, 2, 2, 2, 4, 2],  # Mongoose
    [1, 0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3, 2, 4],  # Lion
]
# Fail loudly on a typo rather than silently scoring asymmetrically.
assert all(
    YONI_KOOTA[i][j] == YONI_KOOTA[j][i]
    for i in range(14) for j in range(14)
), "YONI_KOOTA must be symmetric"

# Vashya koota — group each moon sign (rashi) into one of five vashya classes, then score the
# class pair (out of 2). Same class is fully compatible; a predator/prey pair (lion vs a
# quadruped) scores 0; the rest are neutral.
SIGN_NAMES = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]
SIGN_INDEX = {s: i for i, s in enumerate(SIGN_NAMES)}
# 0=Chatushpada(quadruped) 1=Manava(human) 2=Jalachara(watery) 3=Vanachara(wild) 4=Keeta(insect)
SIGN_VASHYA = [0, 0, 1, 2, 3, 1, 1, 4, 1, 2, 1, 2]
VASHYA_CLASS_SCORE = [
    #Q  M  J  V  K
    [2, 1, 1, 0, 1],  # Chatushpada
    [1, 2, 1, 1, 1],  # Manava
    [1, 1, 2, 1, 1],  # Jalachara
    [0, 1, 1, 2, 1],  # Vanachara
    [1, 1, 1, 1, 2],  # Keeta
]

# Ruling planet of each moon sign (rashi), used by Graha Maitri. Indexed Aries..Pisces.
SIGN_LORD = [
    "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
]
# Varna of each moon sign by element (water=Brahmin, fire=Kshatriya, earth=Vaishya, air=Shudra).
# Values are VARNA ranks: 0=Brahmin (highest) .. 3=Shudra (lowest). Indexed Aries..Pisces.
SIGN_VARNA = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]

# Graha Maitri points from the two moon-sign lords' mutual Naisargika relationship (out of 5).
# Standard BV Raman scoring: friend-friend 5, friend-neutral 4, neutral-neutral 3,
# friend-enemy 1, neutral-enemy 0.5, enemy-enemy 0 (same lord -> 5).
_GM_SCORE = {
    ("friend", "friend"): 5,
    ("friend", "neutral"): 4, ("neutral", "friend"): 4,
    ("neutral", "neutral"): 3,
    ("friend", "enemy"): 1, ("enemy", "friend"): 1,
    ("neutral", "enemy"): 0.5, ("enemy", "neutral"): 0.5,
    ("enemy", "enemy"): 0,
}

def _planet_view(p_from, p_to):
    """How p_from naturally regards p_to: friend | enemy | neutral (Naisargika, directional)."""
    rec = NAISARGIKA.get(p_from, {})
    if p_to in rec.get("enemy", set()):
        return "enemy"
    if p_to in rec.get("friend", set()):
        return "friend"
    return "neutral"

def _graha_maitri_score(sign_a, sign_b):
    ia, ib = SIGN_INDEX.get(sign_a), SIGN_INDEX.get(sign_b)
    if ia is None or ib is None:
        return 3  # neutral fallback when a moon sign is missing
    la, lb = SIGN_LORD[ia], SIGN_LORD[ib]
    if la == lb:
        return 5  # signs ruled by the same planet are fully harmonious
    return _GM_SCORE[(_planet_view(la, lb), _planet_view(lb, la))]

# --- House-overlay interpretation -------------------------------------------------
# When one partner's planet falls into a house of the other's chart, it activates that
# life area for them. Benefics generally bless it; malefics generally stress it. The
# 7th (partnership) house affects the relationship itself most directly, and the
# dusthana houses (6/8/12) are inherently difficult.
BENEFIC_PLANETS = {"Jupiter", "Venus", "Mercury", "Moon"}
MALEFIC_PLANETS = {"Saturn", "Mars", "Sun", "Rahu", "Ketu"}
HARD_HOUSES = {6, 8, 12}

HOUSE_MEANING = {
    1: "sense of self", 2: "money & family", 3: "drive & communication",
    4: "home & emotional security", 5: "romance, joy & children",
    6: "conflict, health & daily grind", 7: "the partnership itself",
    8: "intimacy & shared resources", 9: "luck, beliefs & growth",
    10: "career & reputation", 11: "gains, friends & hopes",
    12: "letting go, costs & the unseen",
}

def _classify_overlay(planet, house):
    """Returns (nature, effect, note). effect ∈ supportive | challenging | neutral."""
    nature = "benefic" if planet in BENEFIC_PLANETS else "malefic" if planet in MALEFIC_PLANETS else "neutral"
    area = HOUSE_MEANING.get(house, "this area of life")

    if house == 7:  # partnership house — strongest direct effect on the relationship
        if nature == "benefic":
            return nature, "supportive", f"{planet} brings warmth and ease to {area}"
        if nature == "malefic":
            return nature, "challenging", f"{planet} can bring friction or distance to {area}"
        return nature, "neutral", f"{planet} strongly activates {area}"

    if house in HARD_HOUSES:
        if nature == "malefic":
            return nature, "challenging", f"{planet} adds strain to their {area}"
        if nature == "benefic":
            return nature, "neutral", f"{planet} softens a difficult area — their {area}"
        return nature, "neutral", f"{planet} colours their {area}"

    # supportive houses (1,2,3,4,5,9,10,11)
    if nature == "benefic":
        return nature, "supportive", f"{planet} blesses their {area}"
    if nature == "malefic":
        return nature, "neutral", f"{planet} pushes hard on their {area} — growth with some friction"
    return nature, "neutral", f"{planet} activates their {area}"


def _moon_nakshatra(chart_json):
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            if occ["celestialBody"] == "Moon":
                return occ.get("nakshatra", ""), occ.get("pada", 1), occ.get("sign", "")
    return "", 1, ""

def _yoni_score(nak_a, nak_b):
    return YONI_KOOTA[NAK_YONI[nak_a]][NAK_YONI[nak_b]]

def _vashya_score(sign_a, sign_b):
    # Needs the moon rashi; if a sign is missing/unknown, fall back to a neutral 1.
    ia, ib = SIGN_INDEX.get(sign_a), SIGN_INDEX.get(sign_b)
    if ia is None or ib is None:
        return 1
    return VASHYA_CLASS_SCORE[SIGN_VASHYA[ia]][SIGN_VASHYA[ib]]

def _nak_idx(name):
    # Resolve a nakshatra name to its index, tolerant of case/spacing and the engine's alternate
    # spellings (e.g. "Mula"/"Dhanishta"). Defaults to 0 only for a genuinely unknown name.
    if name in NAKSHATRA_INDEX:
        return NAKSHATRA_INDEX[name]
    key = (name or "").strip().lower()
    for i, n in enumerate(NAKSHATRA_NAMES):
        if n.lower() == key:
            return i
    canon = NAKSHATRA_ALIASES.get(key)
    return NAKSHATRA_INDEX[canon] if canon else 0

def _tara_ok(src, dst):
    # Dina/Tara koota: count from one's birth star to the other's (inclusive); the 3rd, 5th
    # and 7th taras (Vipat, Pratyak, Naidhana) are inauspicious, the rest auspicious.
    count = ((dst - src) % 27) + 1
    return (count % 9) not in (3, 5, 7)

def _tara_score(nak_a, nak_b):
    # Proper Tara considers BOTH directions, so it's symmetric (gender-independent):
    # full 3 if both ways are auspicious, half if one way, 0 if neither.
    fwd, rev = _tara_ok(nak_a, nak_b), _tara_ok(nak_b, nak_a)
    return 3 if (fwd and rev) else (1.5 if (fwd or rev) else 0)

def _bhakoot_score(sign_a, sign_b):
    # Bhakoot/Rashi koota is based on the two moon SIGNS. Count each sign's position from the
    # other (both ways); the 2/12 (Dwirdwadash), 5/9 (Nav-Pancham) and 6/8 (Shadashtak)
    # relationships are Bhakoot dosha -> 0, everything else -> 7.
    ia, ib = SIGN_INDEX.get(sign_a), SIGN_INDEX.get(sign_b)
    if ia is None or ib is None:
        return 7
    fwd = ((ib - ia) % 12) + 1
    rev = ((ia - ib) % 12) + 1
    return 0 if {fwd, rev} in ({2, 12}, {5, 9}, {6, 8}) else 7

# Gana koota points: (groom_gana, bride_gana) -> score. 0=Deva, 1=Manushya, 2=Rakshasa.
# Directional — e.g. a Rakshasa groom with a Deva bride scores worse than the reverse.
GANA_KOOTA = {
    (0, 0): 6, (0, 1): 6, (0, 2): 0,
    (1, 0): 5, (1, 1): 6, (1, 2): 0,
    (2, 0): 1, (2, 1): 0, (2, 2): 6,
}

def _varna_score(groom_sign, bride_sign):
    # Varna koota is based on the moon SIGN. 1 point if the groom's varna is equal or higher than
    # the bride's (lower rank index = higher varna). Missing sign -> benefit-of-doubt 1.
    ig, ib = SIGN_INDEX.get(groom_sign), SIGN_INDEX.get(bride_sign)
    if ig is None or ib is None:
        return 1
    return 1 if SIGN_VARNA[ig] <= SIGN_VARNA[ib] else 0

def _gana_score(boy_i, girl_i):
    return GANA_KOOTA[(NAK_GANA[boy_i], NAK_GANA[girl_i])]

def _guna_profile(nak_name, sign):
    """Each person's underlying koota attributes (the basis behind the scores): moon sign,
    nakshatra, varna, vashya group, yoni animal, moon-sign lord (Graha Maitri), gana, nadi."""
    si = SIGN_INDEX.get(sign, -1)
    # Guard the nakshatra-indexed fields too: a missing nakshatra must read None, not silently
    # fall back to _nak_idx's index-0 (Ashwini) yoni/gana/nadi.
    i = _nak_idx(nak_name) if nak_name else -1
    return {
        "moon_sign": sign or None,
        "nakshatra": nak_name or None,
        "varna": VARNA[SIGN_VARNA[si]] if si >= 0 else None,
        "vashya": VASHYA_NAMES[SIGN_VASHYA[si]] if si >= 0 else None,
        "yoni": YONI_ANIMALS[NAK_YONI[i]] if i >= 0 else None,
        "sign_lord": SIGN_LORD[si] if si >= 0 else None,
        "gana": GANA_NAMES[NAK_GANA[i]] if i >= 0 else None,
        "nadi": NADI_NAMES[NAK_NADI[i]] if i >= 0 else None,
    }


def compute_guna_milan(nak_a_name, gender_a, nak_b_name, gender_b, sign_a="", sign_b=""):
    ia, ib = _nak_idx(nak_a_name), _nak_idx(nak_b_name)

    # Symmetric kootas — gender-independent, identical either way.
    vashya = _vashya_score(sign_a, sign_b)
    tara = _tara_score(ia, ib)
    yoni = _yoni_score(ia, ib)
    graha_maitri = _graha_maitri_score(sign_a, sign_b)
    bhakoot = _bhakoot_score(sign_a, sign_b)
    nadi = 8 if NAK_NADI[ia] != NAK_NADI[ib] else 0

    # Varna and Gana are genuinely directional (groom -> bride). Use the stated genders to pick
    # the groom. For a same-sex or gender-unknown pair, average both assignments so the score
    # stays well-defined and order-independent without faking a gender. Varna keys off the moon
    # sign; Gana off the nakshatra.
    ga, gb = str(gender_a or "").lower(), str(gender_b or "").lower()
    if ga == "male" and gb == "female":
        varna, gana = _varna_score(sign_a, sign_b), _gana_score(ia, ib)
    elif ga == "female" and gb == "male":
        varna, gana = _varna_score(sign_b, sign_a), _gana_score(ib, ia)
    else:
        varna = (_varna_score(sign_a, sign_b) + _varna_score(sign_b, sign_a)) / 2
        gana = (_gana_score(ia, ib) + _gana_score(ib, ia)) / 2

    total = varna + vashya + tara + yoni + graha_maitri + gana + bhakoot + nadi
    return {
        "total": total,
        "max": 36,
        "breakdown": {
            "varna": {"score": varna, "max": 1},
            "vashya": {"score": vashya, "max": 2},
            "tara": {"score": tara, "max": 3},
            "yoni": {"score": yoni, "max": 4},
            "graha_maitri": {"score": graha_maitri, "max": 5},
            "gana": {"score": gana, "max": 6},
            "bhakoot": {"score": bhakoot, "max": 7},
            "nadi": {"score": nadi, "max": 8},
        },
        # Each person's underlying attributes behind the koota scores (e.g. A's varna, B's yoni).
        "profiles": {
            "a": _guna_profile(nak_a_name, sign_a),
            "b": _guna_profile(nak_b_name, sign_b),
        },
        "verdict": "Strong" if total >= 24 else "Acceptable" if total >= 18 else "Weak",
    }

def compute_house_overlays(chart_a, chart_b, facts_b=None):
    signs_a = [h["sign"] for h in chart_a["d1Chart"]["houses"]]
    sign_to_house_a = {s: i + 1 for i, s in enumerate(signs_a)}

    overlays = []
    for h in chart_b["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            planet = occ["celestialBody"]
            sign = occ["sign"]
            house_in_a = sign_to_house_a.get(sign, 0)
            if house_in_a:
                nature, effect, note = _classify_overlay(planet, house_in_a)
                f = (facts_b or {}).get(planet, {})
                strength = f.get("strength")
                base = 1.5 if effect in ("supportive", "challenging") else 0.0
                weight = round(base * {"strong": 1.5, "adequate": 1.0, "weak": 0.5}.get(strength, 1.0), 2)
                overlays.append({
                    "planet": planet,
                    "falls_in_house": house_in_a,
                    "house_meaning": HOUSE_MEANING.get(house_in_a, ""),
                    "sign": sign,
                    "dignity": f.get("dignity"),
                    "strength": strength,
                    "nature": nature,
                    "effect": effect,
                    "weight": weight,
                    "note": note,
                })
    return overlays

def _overlay_tally(*overlay_lists):
    flat = [o for lst in overlay_lists for o in lst]
    supportive = sum(1 for o in flat if o["effect"] == "supportive")
    challenging = sum(1 for o in flat if o["effect"] == "challenging")
    return {
        "supportive": supportive,
        "challenging": challenging,
        "neutral": len(flat) - supportive - challenging,
        # Overall lean of the planetary overlays, independent of Guna Milan.
        "lean": "harmonious" if supportive > challenging
                else "challenging" if challenging > supportive
                else "mixed",
    }

# Vedic graha-drishti angles (1-based, 1 = same sign). Every planet aspects the 7th; Mars also
# the 4th & 8th, Jupiter the 5th & 9th, Saturn the 3rd & 10th. Rahu/Ketu: 5th, 7th, 9th (common).
ASPECT_ANGLES = {
    "Mars": {4, 7, 8}, "Jupiter": {5, 7, 9}, "Saturn": {3, 7, 10},
    "Rahu": {5, 7, 9}, "Ketu": {5, 7, 9},
}
DEFAULT_ASPECT = {7}
# Romantic/relationship-salient planets, used only to flag a higher-signal note.
_AFFECTION = {"Venus", "Moon"}


def _aspect_effect(from_planet, weight_strength):
    """benefic caster -> supportive, malefic -> challenging; strength scales the weight."""
    nature = ("benefic" if from_planet in BENEFIC_PLANETS
              else "malefic" if from_planet in MALEFIC_PLANETS else "neutral")
    effect = "supportive" if nature == "benefic" else "challenging" if nature == "malefic" else "neutral"
    w = {"strong": 1.5, "adequate": 1.0, "weak": 0.5}.get(weight_strength, 1.0)
    return nature, effect, round(w if effect != "neutral" else 0.0, 2)


def _cross_one_direction(facts_from, owner, facts_to, out):
    for pf, ff in facts_from.items():
        ia = ff.get("sign_idx", -1)
        if ia < 0:
            continue
        angles = ASPECT_ANGLES.get(pf, DEFAULT_ASPECT)
        for pt, ft in facts_to.items():
            ib = ft.get("sign_idx", -1)
            if ib < 0:
                continue
            dist = ((ib - ia) % 12) + 1
            if dist == 1:
                continue  # conjunction handled once, separately
            if dist in angles:
                nature, effect, weight = _aspect_effect(pf, ff.get("strength"))
                orb = orb_within_sign(ff.get("sign_degrees", 0.0), ft.get("sign_degrees", 0.0))
                tight = tightness(orb)
                mult = {"tight": 1.5, "active": 1.0, "loose": 0.7, "noted": 0.4}[tight]
                weight = round(weight * mult, 2)
                note = f"{owner}'s {pf} aspects their {pt}"
                if pf == "Saturn" and pt in _AFFECTION:
                    note = f"{owner}'s Saturn restrains their {pt} — can feel heavy in affection"
                elif pf in ("Jupiter", "Venus") and pt in _AFFECTION:
                    note = f"{owner}'s {pf} warms their {pt} — affection and ease"
                out.append({"from": pf, "from_owner": owner, "to": pt, "type": "aspect",
                            "dignity": ff.get("dignity"), "strength": ff.get("strength"),
                            "nature": nature, "effect": effect, "weight": weight,
                            "tightness": tight, "orb": orb, "note": note})


def cross_aspects(facts_a, facts_b):
    """All planet->planet graha-drishti between the two charts, both directions, plus
    same-sign conjunctions (listed once). facts_* are adapter planet-fact dicts (need sign_idx,
    dignity, strength)."""
    out = []
    _cross_one_direction(facts_a, "A", facts_b, out)
    _cross_one_direction(facts_b, "B", facts_a, out)
    # Conjunctions (same sign) — list each unordered pair once.
    seen = set()
    for pa, fa in facts_a.items():
        for pb, fb in facts_b.items():
            if fa.get("sign_idx", -2) == fb.get("sign_idx", -1):
                key = tuple(sorted((f"A:{pa}", f"B:{pb}")))
                if key in seen:
                    continue
                seen.add(key)
                na = pa in BENEFIC_PLANETS or pb in BENEFIC_PLANETS
                ma = pa in MALEFIC_PLANETS or pb in MALEFIC_PLANETS
                effect = "challenging" if ma and not na else "supportive" if na and not ma else "neutral"
                orb = orb_within_sign(fa.get("sign_degrees", 0.0), fb.get("sign_degrees", 0.0))
                tight = tightness(orb)
                mult = {"tight": 1.5, "active": 1.0, "loose": 0.7, "noted": 0.4}[tight]
                weight = round((1.0 if effect != "neutral" else 0.0) * mult, 2)
                out.append({"from": pa, "from_owner": "A", "to": pb, "type": "conjunction",
                            "nature": "mixed", "effect": effect, "weight": weight,
                            "tightness": tight, "orb": orb,
                            "note": f"{pa} and {pb} sit together — fused energies"})
    return out

def marriage_factors(facts, lords):
    """Relationship-significant condition for one chart: the 7th lord and the love karakas."""
    l7 = lords.get(7)
    l7f = facts.get(l7, {}) if l7 else {}
    venus = facts.get("Venus", {})
    jup = facts.get("Jupiter", {})
    return {
        "seventh_lord": l7,
        "seventh_lord_strength": l7f.get("strength"),
        "seventh_lord_house": l7f.get("house"),
        "venus_strength": venus.get("strength"),
        "venus_dignity": venus.get("dignity"),
        "jupiter_strength": jup.get("strength"),
        "summary": (
            f"7th lord {l7 or '—'} is {l7f.get('strength','unknown')}; "
            f"Venus is {venus.get('strength','unknown')}, Jupiter {jup.get('strength','unknown')}"
        ),
    }

def _current_maha_end(chart_json, maha_lord):
    """End date (YYYY-MM-DD) of the given mahadasha in this chart, or None."""
    md = ((chart_json.get("dashas") or {}).get("all") or {}).get("mahadashas") or {}
    return (md.get(maha_lord) or {}).get("end")


def dasha_overlap(maha_a, maha_b, end_a=None, end_b=None):
    """Compatibility of the two people's current Mahadasha lords. When the lords clash
    (natural enemies) and we know the period ends, `eases_after` is the sooner of the two
    mahadasha end dates — when that lord-pairing changes and the timing friction lifts.
    (ISO dates compare lexicographically, so min() is chronological.)"""
    if not maha_a or not maha_b:
        return {"a_maha": maha_a, "b_maha": maha_b, "relation": "unknown",
                "eases_after": None, "note": "current period unavailable for one or both"}
    rel = planet_relation(maha_a, maha_b)
    note = {
        "friend": "Both are running periods whose lords are natural friends — easy timing alignment.",
        "neutral": "Their current period lords are neutral to each other — neither helps nor hinders.",
        "enemy": "Their current period lords are natural enemies — timing and priorities tend to clash in this phase.",
    }[rel]
    eases_after = None
    if rel == "enemy":
        ends = [e for e in (end_a, end_b) if e]
        if ends:
            eases_after = min(ends)
            note += f" This clashing pairing runs until {eases_after}, when the earlier major period changes and the friction should ease."
    return {"a_maha": maha_a, "b_maha": maha_b, "relation": rel, "eases_after": eases_after, "note": note}

def _digest(items, effect):
    """Top weighted items of one effect, as short strings, highest weight first."""
    picked = sorted((i for i in items if i.get("effect") == effect),
                    key=lambda i: i.get("weight", 0), reverse=True)
    return [i["note"] for i in picked[:5]]


def compute_synastry(chart_a_json, chart_b_json, gender_a="", gender_b=""):
    nak_a, _, sign_a = _moon_nakshatra(chart_a_json)
    nak_b, _, sign_b = _moon_nakshatra(chart_b_json)

    fa = chart_facts(chart_a_json)   # {lagna, lords, planets(with strength), dasha}
    fb = chart_facts(chart_b_json)
    planets_a, planets_b = fa["planets"], fb["planets"]

    a_in_b = compute_house_overlays(chart_b_json, chart_a_json, planets_a)  # A's planets in B's houses
    b_in_a = compute_house_overlays(chart_a_json, chart_b_json, planets_b)
    crosses = cross_aspects(planets_a, planets_b)

    maha_a, maha_b = fa["dasha"].get("maha"), fb["dasha"].get("maha")
    dovl = dasha_overlap(maha_a, maha_b,
                         _current_maha_end(chart_a_json, maha_a),
                         _current_maha_end(chart_b_json, maha_b))

    all_items = a_in_b + b_in_a + crosses
    overlay_summary = _overlay_tally(a_in_b, b_in_a, crosses)
    # When the match leans challenging (or the periods clash), surface the date the current
    # period-driven friction eases — a static natal lean has no end, but the phase it bites in does.
    challenging_until = (dovl.get("eases_after")
                         if (overlay_summary["lean"] == "challenging" or dovl["relation"] == "enemy")
                         else None)
    return {
        "guna_milan": compute_guna_milan(nak_a, gender_a, nak_b, gender_b, sign_a, sign_b),
        "a_planets_in_b_houses": a_in_b,
        "b_planets_in_a_houses": b_in_a,
        "cross_aspects": crosses,
        "marriage_factors": {"a": marriage_factors(planets_a, fa["lords"]),
                             "b": marriage_factors(planets_b, fb["lords"])},
        "dasha_overlap": dovl,
        "overlay_summary": overlay_summary,
        "challenging_until": challenging_until,
        "top_supportive": _digest(all_items, "supportive"),
        "top_challenging": _digest(all_items, "challenging"),
    }

def compute_synastry_json(chart_a_str, chart_b_str, gender_a="", gender_b=""):
    return json.dumps(
        compute_synastry(json.loads(chart_a_str), json.loads(chart_b_str), gender_a, gender_b),
        default=str,
    )
