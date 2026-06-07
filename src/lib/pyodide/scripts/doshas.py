import json


def compute_doshas(chart_json):
    planets = {}
    for h in chart_json["d1Chart"]["houses"]:
        for occ in h.get("occupants", []):
            planets[occ["celestialBody"]] = {
                "house": h["number"],
                "sign": occ["sign"],
                "nakshatra": occ.get("nakshatra", ""),
            }

    doshas = {}

    # --- Mangal (Mars) Dosha: Mars in H1/2/4/7/8/12 ---
    mars = planets.get("Mars")
    if mars:
        manglik_houses = {1, 2, 4, 7, 8, 12}
        present = mars["house"] in manglik_houses
        # Cancellations: Mars in own sign (Aries/Scorpio) or exalted (Capricorn)
        cancelled = mars["sign"] in {"Aries", "Scorpio", "Capricorn"}
        rahu = planets.get("Rahu")
        if rahu and rahu["house"] == mars["house"]:
            cancelled = True  # mutual Manglik cancellation heuristic

        doshas["manglik"] = {
            "present": present and not cancelled,
            "house": mars["house"],
            "cancelled": cancelled,
            "text": (
                "Mangal Dosha present" if (present and not cancelled)
                else "Mangal Dosha present but neutralised" if present
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

    return doshas


def compute_doshas_json(chart_json_str):
    """Accepts JSON string, returns JSON string — for Pyodide JS."""
    return json.dumps(compute_doshas(json.loads(chart_json_str)), default=str)
