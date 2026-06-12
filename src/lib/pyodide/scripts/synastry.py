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

def compute_guna_milan(nak_a_name, pada_a, nak_b_name, pada_b):
    # Several kootas (varna, tara, graha maitri) are traditionally directional (groom -> bride).
    # This app has no gender, so the score must NOT depend on which profile is active vs. the
    # partner. Order the two nakshatras canonically so compute(A, B) == compute(B, A).
    bi, gi = sorted([_nak_idx(nak_a_name), _nak_idx(nak_b_name)])

    varna = 1 if NAK_VARNA[gi] >= NAK_VARNA[bi] else 0
    vashya = 2  # simplified
    tara = _tara_score(bi, gi)
    yoni = 4 if NAK_YONI[bi] == NAK_YONI[gi] else (2 if abs(NAK_YONI[bi] - NAK_YONI[gi]) <= 3 else 0)
    # Graha Maitri = mutual friendship of the two Moon-sign lords (symmetric):
    # same lord or mutual friends -> 5, a one-way friendship -> 4, otherwise 0.
    graha_a = NAK_GRAHA[bi]
    graha_b = NAK_GRAHA[gi]
    a_friend_b = graha_a in GRAHA_FRIEND.get(graha_b, set())
    b_friend_a = graha_b in GRAHA_FRIEND.get(graha_a, set())
    graha_maitri = (5 if graha_a == graha_b
                    else 5 if (a_friend_b and b_friend_a)
                    else 4 if (a_friend_b or b_friend_a)
                    else 0)
    gana_boy = NAK_GANA[bi]
    gana_girl = NAK_GANA[gi]
    gana = 6 if gana_boy == gana_girl else (3 if abs(gana_boy - gana_girl) == 1 else 0)
    bhakoot = _bhakoot_score(bi, gi)
    nadi = 8 if NAK_NADI[bi] != NAK_NADI[gi] else 0

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

def compute_synastry(chart_a_json, chart_b_json):
    nak_a, pada_a = _moon_nakshatra(chart_a_json)
    nak_b, pada_b = _moon_nakshatra(chart_b_json)
    a_in_b = compute_house_overlays(chart_b_json, chart_a_json)
    b_in_a = compute_house_overlays(chart_a_json, chart_b_json)
    return {
        "guna_milan": compute_guna_milan(nak_a, pada_a, nak_b, pada_b),
        "a_planets_in_b_houses": a_in_b,
        "b_planets_in_a_houses": b_in_a,
        "overlay_summary": _overlay_tally(a_in_b, b_in_a),
    }

def compute_synastry_json(chart_a_str, chart_b_str):
    return json.dumps(compute_synastry(json.loads(chart_a_str), json.loads(chart_b_str)), default=str)
