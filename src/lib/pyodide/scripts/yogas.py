import json

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

SIGN_LORD = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"
}

EXALTED = {"Sun": "Aries", "Moon": "Taurus", "Mars": "Capricorn",
           "Mercury": "Virgo", "Jupiter": "Cancer", "Venus": "Pisces", "Saturn": "Libra"}

OWN_SIGNS = {
    "Sun": ["Leo"], "Moon": ["Cancer"], "Mars": ["Aries", "Scorpio"],
    "Mercury": ["Gemini", "Virgo"], "Jupiter": ["Sagittarius", "Pisces"],
    "Venus": ["Taurus", "Libra"], "Saturn": ["Capricorn", "Aquarius"]
}

KENDRAS = {1, 4, 7, 10}


def _planets(chart_json):
    result = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            result[occ["celestialBody"]] = {
                "sign": occ["sign"],
                "house": h["number"],
                "retrograde": occ.get("motion_type", "direct") == "retrograde",
            }
    return result


def _is_strong(planet, sign):
    return sign == EXALTED.get(planet) or sign in OWN_SIGNS.get(planet, [])


def _house_lords(lagna_idx):
    return {i + 1: SIGN_LORD[SIGNS[(lagna_idx + i) % 12]] for i in range(12)}


def compute_yogas(chart_json):
    planets = _planets(chart_json)
    lagna_sign = chart_json["d1Chart"]["houses"][0]["sign"]
    lagna_idx = SIGNS.index(lagna_sign)
    lords = _house_lords(lagna_idx)
    yogas = []

    # --- Pancha Mahapurusha ---
    for planet, name in [("Mars", "Ruchaka"), ("Mercury", "Bhadra"),
                          ("Jupiter", "Hamsa"), ("Venus", "Malavya"), ("Saturn", "Sasa")]:
        p = planets.get(planet)
        if p and p["house"] in KENDRAS and _is_strong(planet, p["sign"]):
            yogas.append({"name": name, "category": "Pancha Mahapurusha",
                          "planet": planet, "house": p["house"]})

    # --- Gaja-Kesari: Jupiter in kendra from Moon ---
    moon = planets.get("Moon")
    jup = planets.get("Jupiter")
    if moon and jup:
        diff = (jup["house"] - moon["house"]) % 12
        if diff in {0, 3, 6, 9}:
            yogas.append({"name": "Gaja-Kesari", "category": "Chandra",
                          "planets": ["Moon", "Jupiter"]})

    # --- Chandra-Mangal: Moon + Mars conjunction ---
    mars = planets.get("Mars")
    if moon and mars and moon["house"] == mars["house"]:
        yogas.append({"name": "Chandra-Mangal", "category": "Chandra",
                      "planets": ["Moon", "Mars"]})

    # --- Budha-Aditya: Sun + Mercury conjunction ---
    sun = planets.get("Sun")
    merc = planets.get("Mercury")
    if sun and merc and sun["house"] == merc["house"]:
        yogas.append({"name": "Budha-Aditya", "category": "Solar",
                      "planets": ["Sun", "Mercury"]})

    # --- Adhi Yoga: Mercury/Jupiter/Venus in 6/7/8 from Moon ---
    if moon:
        target = {(moon["house"] - 1 + offset) % 12 + 1 for offset in (5, 6, 7)}
        benefics = [p for p in ["Mercury", "Jupiter", "Venus"]
                    if planets.get(p) and planets[p]["house"] in target]
        if len(benefics) >= 2:
            yogas.append({"name": "Adhi", "category": "Chandra", "planets": benefics})

    # --- Sunapha: planet (not Sun) in 2nd from Moon ---
    if moon:
        h2 = moon["house"] % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h2:
                yogas.append({"name": "Sunapha", "category": "Chandra", "planet": p})
                break

    # --- Anapha: planet (not Sun) in 12th from Moon ---
    if moon:
        h12 = (moon["house"] - 2) % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h12:
                yogas.append({"name": "Anapha", "category": "Chandra", "planet": p})
                break

    # --- Vesi: planet in 2nd from Sun ---
    if sun:
        h2 = sun["house"] % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h2:
                yogas.append({"name": "Vesi", "category": "Solar", "planet": p})
                break

    # --- Vasi: planet in 12th from Sun ---
    if sun:
        h12 = (sun["house"] - 2) % 12 + 1
        for p in ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"]:
            if planets.get(p) and planets[p]["house"] == h12:
                yogas.append({"name": "Vasi", "category": "Solar", "planet": p})
                break

    # --- Lakshmi Yoga: Venus in own/exalted + 9H lord in kendra/trikona strong ---
    venus = planets.get("Venus")
    lord_9 = lords.get(9)
    p9 = planets.get(lord_9) if lord_9 else None
    if (venus and _is_strong("Venus", venus["sign"]) and
            p9 and p9["house"] in KENDRAS | {5, 9} and _is_strong(lord_9, p9["sign"])):
        yogas.append({"name": "Lakshmi", "category": "Raja", "planets": ["Venus", lord_9]})

    # --- Dharma-Karmadhipati: 9H and 10H lords conjunct or in mutual kendra ---
    lord_10 = lords.get(10)
    if lord_9 and lord_10 and lord_9 != lord_10:
        p10 = planets.get(lord_10)
        if p9 and p10:
            diff = (p9["house"] - p10["house"]) % 12
            if diff in {0, 3, 6, 9}:
                yogas.append({"name": "Dharma-Karmadhipati", "category": "Raja",
                              "planets": [lord_9, lord_10]})

    # --- Kesari: Jupiter in 1/4/7/10 from Lagna and strong ---
    if jup and jup["house"] in KENDRAS and _is_strong("Jupiter", jup["sign"]):
        yogas.append({"name": "Kesari", "category": "Jupiter", "house": jup["house"]})

    return yogas


def compute_yogas_json(chart_json_str):
    """Accepts JSON string, returns JSON string — for Pyodide JS."""
    return json.dumps(compute_yogas(json.loads(chart_json_str)), default=str)
