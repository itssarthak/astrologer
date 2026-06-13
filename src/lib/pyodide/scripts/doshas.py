import json


def compute_doshas(chart_json):
    planets = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            planets[occ["celestialBody"]] = {
                "house": h["number"],
                "sign": occ["sign"],
                "nakshatra": occ.get("nakshatra", ""),
                "aspects_receives": list((occ.get("aspects") or {}).get("receives", []) or []),
            }

    doshas = {}

    # --- Mangal (Mars) Dosha: Mars in H1/2/4/7/8/12 from the lagna ---
    # House-specific benign signs where Mars in a manglik house does NOT cause the dosha
    # (own/friendly/exalted placements), per the classical cancellation rules.
    MANGLIK_BENIGN_SIGN = {
        1: {"Aries", "Scorpio"},
        2: {"Gemini", "Virgo"},
        4: {"Aries", "Scorpio"},
        7: {"Cancer", "Capricorn"},
        8: {"Sagittarius", "Pisces"},
        12: {"Taurus", "Libra"},
    }
    mars = planets.get("Mars")
    if mars:
        manglik_houses = {1, 2, 4, 7, 8, 12}
        present = mars["house"] in manglik_houses

        # Cancellations:
        #  - Mars in its own sign (Aries/Scorpio) or exalted (Capricorn)
        #  - Mars in a house-specific benign sign (table above)
        #  - Mars conjunct or with a benefic guard (Jupiter / Moon) in the same house
        #  - Mars conjunct the lunar nodes (Rahu/Ketu) — neutralising heuristic
        cancellations = []
        if mars["sign"] in {"Aries", "Scorpio", "Capricorn"}:
            cancellations.append("Mars in own/exalted sign")
        if mars["sign"] in MANGLIK_BENIGN_SIGN.get(mars["house"], set()):
            cancellations.append("Mars in a benign sign for this house")
        for guard in ("Jupiter", "Moon"):
            g = planets.get(guard)
            if g and g["house"] == mars["house"]:
                cancellations.append(f"{guard} conjunct Mars")
        for node in ("Rahu", "Ketu"):
            n = planets.get(node)
            if n and n["house"] == mars["house"]:
                cancellations.append(f"{node} conjunct Mars")
        # Jupiter aspecting Mars neutralises the dosha (benefic guard by aspect).
        if any(a.get("from_planet") == "Jupiter" for a in mars.get("aspects_receives", [])):
            cancellations.append("Jupiter aspects Mars")
        cancelled = bool(cancellations)

        severity = ("full" if mars["house"] in {1, 4, 7, 8}
                    else "partial" if mars["house"] in {2, 12} else None)

        doshas["manglik"] = {
            "present": present and not cancelled,
            "house": mars["house"],
            "severity": severity,
            "cancelled": present and cancelled,
            "cancellation_reasons": cancellations if present else [],
            "text": (
                "Mangal Dosha present" if (present and not cancelled)
                else f"Mangal Dosha present but neutralised ({', '.join(cancellations)})" if present
                else "No Mangal Dosha"
            ),
        }

    # --- Kala Sarpa Dosha: all planets between Rahu and Ketu ---
    rahu = planets.get("Rahu")
    ketu = planets.get("Ketu")
    if rahu and ketu:
        rahu_h = rahu["house"]
        ketu_h = ketu["house"]
        classical = {"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"}
        occupied = {v["house"] for k, v in planets.items() if k in classical}
        min_h, max_h = min(rahu_h, ketu_h), max(rahu_h, ketu_h)
        arc1 = all(min_h <= h <= max_h for h in occupied)
        arc2 = all(h <= min_h or h >= max_h for h in occupied)
        present = arc1 or arc2
        doshas["kala_sarpa"] = {
            "present": present,
            "text": "Kala Sarpa Dosha present" if present else "No Kala Sarpa Dosha",
        }

    # --- Guru Chandala: Jupiter conjunct Rahu ---
    jup = planets.get("Jupiter")
    if jup and rahu:
        present = jup["house"] == rahu["house"]
        doshas["guru_chandala"] = {
            "present": present,
            "text": "Guru Chandala Dosha — Jupiter conjunct Rahu" if present else "No Guru Chandala Dosha",
        }

    # --- Pitru Dosha: Sun conjunct Rahu ---
    sun = planets.get("Sun")
    if sun and rahu:
        present = sun["house"] == rahu["house"]
        doshas["pitru"] = {
            "present": present,
            "text": "Pitru Dosha — Sun conjunct Rahu" if present else "No Pitru Dosha",
        }

    # --- Ganda Moola: Moon in specific nakshatras ---
    moon = planets.get("Moon")
    if moon:
        ganda_moola_nakshatras = {"Ashwini", "Ashlesha", "Magha", "Jyeshtha", "Moola", "Revati"}
        present = moon.get("nakshatra", "") in ganda_moola_nakshatras
        doshas["ganda_moola"] = {
            "present": present,
            "text": f"Ganda Moola Dosha — Moon in {moon.get('nakshatra')}" if present else "No Ganda Moola Dosha",
        }

    # --- Kalathra Dosha: a natural malefic occupies the 7th house (marriage) ---
    MALEFICS = ("Mars", "Saturn", "Sun", "Rahu", "Ketu")
    afflictors = [p for p in MALEFICS if planets.get(p) and planets[p]["house"] == 7]
    present = bool(afflictors)
    doshas["kalathra"] = {
        "present": present,
        "afflictors": afflictors,
        "text": (f"Kalathra Dosha — strain on the marriage area from {', '.join(afflictors)}"
                 if present else "No Kalathra Dosha"),
    }

    # --- Shrapit Dosha: Saturn conjunct Rahu ---
    sat = planets.get("Saturn")
    if sat and rahu:
        present = sat["house"] == rahu["house"]
        harsh = present and sat["house"] in {6, 8, 12}
        doshas["shrapit"] = {
            "present": present,
            "text": (("Shrapit Dosha — Saturn conjunct Rahu"
                      + (" in a difficult house" if harsh else ""))
                     if present else "No Shrapit Dosha"),
        }

    # --- Shakata Dosha: Moon in the 6th/8th/12th from Jupiter (cancelled if Jupiter is in a kendra) ---
    if jup and moon:
        dist = ((moon["house"] - jup["house"]) % 12) + 1
        present = dist in {6, 8, 12}
        cancelled = present and jup["house"] in {1, 4, 7, 10}
        doshas["shakata"] = {
            "present": present and not cancelled,
            "cancelled": cancelled,
            "text": ("Shakata Dosha — fluctuating fortunes, effort that doesn't always stick"
                     if (present and not cancelled)
                     else "Shakata Dosha present but cancelled (Jupiter well-placed)" if present
                     else "No Shakata Dosha"),
        }

    return doshas


def compute_doshas_json(chart_json_str):
    """Accepts JSON string, returns JSON string — for Pyodide JS."""
    return json.dumps(compute_doshas(json.loads(chart_json_str)), default=str)
