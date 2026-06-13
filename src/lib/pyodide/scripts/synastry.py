import json

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Moola", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
    "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]
NAKSHATRA_INDEX = {n: i for i, n in enumerate(NAKSHATRA_NAMES)}

VARNA = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"]
NAK_VARNA = [
    2,2,0,0,2,3,0,0,3,3,2,0,2,3,3,0,0,3,3,2,0,2,3,3,0,0,2
]
NAK_GANA = [
    0,1,2,0,0,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,0
]  # 0=Deva, 1=Manushya, 2=Rakshasa
NAK_NADI = [
    0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0,1,2
]  # 0=Vata, 1=Pitta, 2=Kapha
NAK_YONI = [
    0,14,7,3,5,10,8,12,13,1,2,2,12,9,11,9,10,15,15,4,4,11,6,6,3,5,0
]
NAK_GRAHA = [
    4,3,0,1,2,5,4,0,1,3,5,0,1,2,5,4,2,1,4,3,0,1,2,5,4,0,3
]  # 0=Sun,1=Moon,2=Mars,3=Merc,4=Jup,5=Ven,6=Sat
GRAHA_FRIEND = {
    0: {0,1,2,4}, 1: {0,3}, 2: {0,1,4}, 3: {0,5}, 4: {0,1,2}, 5: {3,6}, 6: {3,5}
}

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
                return occ.get("nakshatra", ""), occ.get("pada", 1)
    return "", 1

def _nak_idx(name):
    return NAKSHATRA_INDEX.get(name, 0)

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

def _bhakoot_score(nak_boy, nak_girl):
    b = nak_boy // 9 + 1
    g = nak_girl // 9 + 1
    diff = abs(b - g)
    return 0 if diff in {6, 8} else 7

# Gana koota points: (groom_gana, bride_gana) -> score. 0=Deva, 1=Manushya, 2=Rakshasa.
# Directional — e.g. a Rakshasa groom with a Deva bride scores worse than the reverse.
GANA_KOOTA = {
    (0, 0): 6, (0, 1): 6, (0, 2): 0,
    (1, 0): 5, (1, 1): 6, (1, 2): 0,
    (2, 0): 1, (2, 1): 0, (2, 2): 6,
}

def _varna_score(boy_i, girl_i):
    # 1 point if the groom's varna is equal or higher than the bride's (lower index = higher).
    return 1 if NAK_VARNA[boy_i] <= NAK_VARNA[girl_i] else 0

def _gana_score(boy_i, girl_i):
    return GANA_KOOTA[(NAK_GANA[boy_i], NAK_GANA[girl_i])]

def compute_guna_milan(nak_a_name, gender_a, nak_b_name, gender_b):
    ia, ib = _nak_idx(nak_a_name), _nak_idx(nak_b_name)

    # Symmetric kootas — gender-independent, identical either way.
    vashya = 2  # simplified
    tara = _tara_score(ia, ib)
    yoni = 4 if NAK_YONI[ia] == NAK_YONI[ib] else (2 if abs(NAK_YONI[ia] - NAK_YONI[ib]) <= 3 else 0)
    graha_x, graha_y = NAK_GRAHA[ia], NAK_GRAHA[ib]
    x_friend = graha_x in GRAHA_FRIEND.get(graha_y, set())
    y_friend = graha_y in GRAHA_FRIEND.get(graha_x, set())
    graha_maitri = (5 if graha_x == graha_y
                    else 5 if (x_friend and y_friend)
                    else 4 if (x_friend or y_friend)
                    else 0)
    bhakoot = _bhakoot_score(ia, ib)
    nadi = 8 if NAK_NADI[ia] != NAK_NADI[ib] else 0

    # Varna and Gana are genuinely directional (groom -> bride). Use the stated genders to pick
    # the groom. For a same-sex or gender-unknown pair, average both assignments so the score
    # stays well-defined and order-independent without faking a gender.
    ga, gb = str(gender_a or "").lower(), str(gender_b or "").lower()
    if ga == "male" and gb == "female":
        varna, gana = _varna_score(ia, ib), _gana_score(ia, ib)
    elif ga == "female" and gb == "male":
        varna, gana = _varna_score(ib, ia), _gana_score(ib, ia)
    else:
        varna = (_varna_score(ia, ib) + _varna_score(ib, ia)) / 2
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
        "verdict": "Strong" if total >= 24 else "Acceptable" if total >= 18 else "Weak",
    }

def compute_house_overlays(chart_a, chart_b):
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
                overlays.append({
                    "planet": planet,
                    "falls_in_house": house_in_a,
                    "house_meaning": HOUSE_MEANING.get(house_in_a, ""),
                    "sign": sign,
                    "nature": nature,
                    "effect": effect,
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

def compute_synastry(chart_a_json, chart_b_json, gender_a="", gender_b=""):
    nak_a, _ = _moon_nakshatra(chart_a_json)
    nak_b, _ = _moon_nakshatra(chart_b_json)
    a_in_b = compute_house_overlays(chart_b_json, chart_a_json)
    b_in_a = compute_house_overlays(chart_a_json, chart_b_json)
    return {
        "guna_milan": compute_guna_milan(nak_a, gender_a, nak_b, gender_b),
        "a_planets_in_b_houses": a_in_b,
        "b_planets_in_a_houses": b_in_a,
        "overlay_summary": _overlay_tally(a_in_b, b_in_a),
    }

def compute_synastry_json(chart_a_str, chart_b_str, gender_a="", gender_b=""):
    return json.dumps(
        compute_synastry(json.loads(chart_a_str), json.loads(chart_b_str), gender_a, gender_b),
        default=str,
    )
