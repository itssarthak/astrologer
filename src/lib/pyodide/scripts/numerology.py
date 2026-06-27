import json
from datetime import datetime

from relationships import planet_relation

# Chaldean letter values (primary system)
CHALDEAN = {
    'A': 1, 'I': 1, 'J': 1, 'Q': 1, 'Y': 1,
    'B': 2, 'K': 2, 'R': 2,
    'C': 3, 'G': 3, 'L': 3, 'S': 3,
    'D': 4, 'M': 4, 'T': 4,
    'E': 5, 'H': 5, 'N': 5, 'X': 5,
    'U': 6, 'V': 6, 'W': 6,
    'O': 7, 'Z': 7,
    'F': 8, 'P': 8,
}

# Pythagorean letter values (cross-check)
PYTHAGOREAN = {c: (i % 9) + 1
               for i, c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}

MASTER = {11, 22, 33}
VOWELS = set('AEIOU')
CONSONANTS = set('BCDFGHJKLMNPQRSTVWXYZ')

# Chaldean number -> ruling planet.
PLANET_RULER = {1: "Sun", 2: "Moon", 3: "Jupiter", 4: "Rahu",
                5: "Mercury", 6: "Venus", 7: "Ketu", 8: "Saturn", 9: "Mars"}


def _with_ruler(n):
    """A single-digit (1-9) number annotated with its ruling planet."""
    return {"number": n, "ruler": PLANET_RULER.get(n)}


def _reduce(n, keep_master=True):
    while n > 9 and (not keep_master or n not in MASTER):
        n = sum(int(d) for d in str(n))
    return n


def compute_kua(year, gender):
    """Eight Mansions (Ba Zhai) Kua number, 1-9. Returns None unless gender is male/female
    (the classical formula is only defined for those two)."""
    g = (gender or "").lower()
    if g not in ("male", "female"):
        return None
    s = _reduce(sum(int(d) for d in str(year)), keep_master=False)
    if g == "male":
        k = 10 - s
        return 2 if k == 5 else k
    k = _reduce(5 + s, keep_master=False)
    return 8 if k == 5 else k


# Lines through the Lo Shu magic square (4-9-2 / 3-5-7 / 8-1-6): the six planes — three
# horizontal (rows) and three vertical (columns) — plus the two diagonals. Geometry is
# magic-square fact; the meaning summarises the cells' planet rulers (PLANET_RULER) — not
# imported pop-numerology prose.
LOSHU_LINES = [
    ("Mental plane (4-9-2)",    [4, 9, 2]),
    ("Emotional plane (3-5-7)", [3, 5, 7]),
    ("Practical plane (8-1-6)", [8, 1, 6]),
    ("Thought plane (4-3-8)",   [4, 3, 8]),
    ("Will plane (9-5-1)",      [9, 5, 1]),
    ("Action plane (2-7-6)",    [2, 7, 6]),
    ("Diagonal 4-5-6",          [4, 5, 6]),
    ("Diagonal 2-5-8",          [2, 5, 8]),
]

LOSHU_LINE_MEANING = {
    "Mental plane (4-9-2)":    "thinking, drive and imagination (Rahu-Mars-Moon).",
    "Emotional plane (3-5-7)": "wisdom, balance and detachment (Jupiter-Mercury-Ketu).",
    "Practical plane (8-1-6)": "method, identity and comfort (Saturn-Sun-Venus).",
    "Thought plane (4-3-8)":   "planning and discipline (Rahu-Jupiter-Saturn).",
    "Will plane (9-5-1)":      "determination, intellect and identity (Mars-Mercury-Sun).",
    "Action plane (2-7-6)":    "instinct, detachment and harmony (Moon-Ketu-Venus).",
    "Diagonal 4-5-6":          "grounded, steady balance (Rahu-Mercury-Venus).",
    "Diagonal 2-5-8":          "emotional resilience (Moon-Mercury-Saturn).",
}


def compute_loshu_grid(dob, gender=None):
    """3x3 Lo Shu grid populated from DOB digits + mulank + bhagyank + kua. 0 is never placed."""
    parts = dob.split('-')
    mulank = _reduce(int(parts[2]), keep_master=False)
    bhagyank = _reduce(sum(int(d) for d in dob if d.isdigit()), keep_master=False)
    kua = compute_kua(int(parts[0]), gender)

    placed = [int(d) for d in dob if d.isdigit() and d != '0']
    placed += [mulank, bhagyank]
    if kua:
        placed.append(kua)
    placed = [n for n in placed if 1 <= n <= 9]

    counts = {str(n): placed.count(n) for n in range(1, 10)}
    missing = [n for n in range(1, 10) if counts[str(n)] == 0]
    repeated = [n for n in range(1, 10) if counts[str(n)] >= 2]

    lines = []
    for label, cells in LOSHU_LINES:
        present = sum(1 for c in cells if counts[str(c)] > 0)
        state = "full" if present == 3 else ("absent" if present == 0 else "partial")
        lines.append({"name": label, "cells": cells, "state": state,
                      "meaning": LOSHU_LINE_MEANING[label]})

    return {
        "counts": counts,
        "missing": missing,
        "repeated": repeated,
        "kua": kua,
        "kua_note": None if kua else "Kua omitted (requires male/female).",
        "lines": lines,
        "arrows_strength": [l["name"] for l in lines if l["state"] == "full"],
        "arrows_weakness": [l["name"] for l in lines if l["state"] == "absent"],
    }


def _name_sum(name, mapping, letter_filter=None):
    letters = [c for c in name.upper() if c.isalpha()]
    if letter_filter:
        letters = [c for c in letters if c in letter_filter]
    return sum(mapping.get(c, 0) for c in letters)


def _name_numbers(name):
    """Destiny/soul-urge/personality for one name, both systems."""
    return {
        "destiny": {"chaldean": _reduce(_name_sum(name, CHALDEAN)),
                    "pythagorean": _reduce(_name_sum(name, PYTHAGOREAN))},
        "soul_urge": {"chaldean": _reduce(_name_sum(name, CHALDEAN, VOWELS)),
                      "pythagorean": _reduce(_name_sum(name, PYTHAGOREAN, VOWELS))},
        "personality": {"chaldean": _reduce(_name_sum(name, CHALDEAN, CONSONANTS)),
                        "pythagorean": _reduce(_name_sum(name, PYTHAGOREAN, CONSONANTS))},
    }


def _compound_and_single(total):
    """single = the fully reduced 1-9 value (master numbers 11/22/33 kept);
    compound = Cheiro's compound number — the total itself when <= 52, otherwise
    the total reduced by repeated digit-sum to the first value <= 52."""
    compound = total
    while compound > 52:
        compound = sum(int(d) for d in str(compound))
    return compound, _reduce(total)


# Cheiro's compound-number meanings (10-52). Numbers above 52 reduce back into this range.
CHEIRO_COMPOUND = {
    10: "The Wheel of Fortune — honour, faith and self-confidence; rise and fall by one's own plans.",
    11: "A warning of hidden dangers, trials and treachery from others; needs caution.",
    12: "The sacrifice — the victim; warns of being deceived by others; suffering through plans.",
    13: "Upheaval and change; warns of the unknown; power that must be used well or brings destruction.",
    14: "Movement, travel and dealings with the public; risk from speculation and natural forces.",
    15: "Magic and personal magnetism; favours getting money and gifts; can be used for good or low ends.",
    16: "The shattered tower; warns of accidents and defeat of plans; must guard against them.",
    17: "The Star of the Magi — spiritual rising above trials; immortality of name; highly fortunate.",
    18: "Materialism striving to destroy the spiritual; bitter quarrels, treachery and deception.",
    19: "The Prince of Heaven — success, honour and happiness; one of the most fortunate numbers.",
    20: "The Awakening — a call to action for a great purpose; judgement; delays but ultimate success.",
    21: "The Crown — advancement, honour and elevation in life; victory after a long struggle.",
    22: "Caution and illusion; a good person living in a fool's paradise; warns to beware of false judgement.",
    23: "Royal Star of the Lion — success, help from superiors and protection; very fortunate.",
    24: "Gain through love and the help of those of rank; fortunate in money and partnerships.",
    25: "Strength gained through experience and hard lessons; success in the latter part of life.",
    26: "Grave warnings of disaster through bad partnerships and speculation; loss through others.",
    27: "The Sceptre — authority, command and reward from creative intellect; act on your own judgement.",
    28: "Promise of great success that is not lasting; contradictions; loss through trust and lawsuits.",
    29: "Uncertainties, treachery and deception by others; grief and betrayal; trials and unexpected dangers.",
    30: "Thoughtful deduction and mental superiority over others; neither fortunate nor unfortunate — by choice.",
    31: "Like 30 — self-contained, lonely and isolated from one's fellows; not fortunate materially.",
    32: "Magic power like 14 and 23; fortunate if one holds to one's own judgement against the crowd.",
    33: "Same as 24 — gain through love and influential help; fortunate in partnerships.",
    34: "Same as 25 — strength through experience.",
    35: "Same as 26 — warnings through partnerships and speculation.",
    36: "Same as 27 — authority and reward through intellect.",
    37: "Good and fortunate friendships and partnerships, especially in love and the opposite sex.",
    38: "Same as 29 — uncertainties and treachery from others.",
    39: "Same as 30 — mental superiority by choice.",
    40: "Same as 31 — isolation and detachment.",
    41: "Same as 32 — magic power held by independent judgement.",
    42: "Same as 24 and 33 — gain through love and influence.",
    43: "An unfortunate number of revolution, upheaval and strife; warns of failure of ambitions.",
    44: "Same as 26 — warnings through partnerships and speculation.",
    45: "Same as 27 — authority and reward through intellect.",
    46: "Same as 37 — fortunate friendships and partnerships.",
    47: "Same as 29 — uncertainties and treachery.",
    48: "Same as 30 — mental superiority by choice.",
    49: "Same as 31 — isolation.",
    50: "Same as 32 — magic power by independent judgement.",
    51: "The Warrior — sudden advancement and power; great for those in military or leadership; danger to foes.",
    52: "Same as 43 — revolution and strife.",
}


def compute_number_compatibility(a, b):
    """Compatibility between two numerology numbers (1-9) via their ruling planets."""
    a = a if a <= 9 else _reduce(a, keep_master=False)
    b = b if b <= 9 else _reduce(b, keep_master=False)
    pa, pb = PLANET_RULER.get(a), PLANET_RULER.get(b)
    relation = planet_relation(pa, pb) if pa and pb else "neutral"
    return {"a": a, "b": b, "rulers": [pa, pb], "relation": relation}


def compute_number_compatibility_json(a, b):
    return json.dumps(compute_number_compatibility(int(a), int(b)))


def _num_rating(score10):
    return "Harmonious" if score10 >= 7 else ("Mixed" if score10 >= 4 else "Challenging")


def _rel_points(pa, pb):
    rel = planet_relation(pa, pb) if pa and pb else "neutral"
    return {"friend": 2, "neutral": 1, "enemy": 0}[rel], rel


def _ruler_of(n):
    return PLANET_RULER.get(n if n <= 9 else _reduce(n, keep_master=False))


def _line_type(name):
    # The six rows+columns are all planes; the two diagonals are the Raj-Yog lines.
    return "diagonal" if name.startswith("Diagonal") else "plane"


def _orientation(idx, name):
    # LOSHU_LINES is ordered: 3 rows (horizontal), 3 columns (vertical), then 2 diagonals.
    if name.startswith("Diagonal"):
        return "diagonal"
    return "horizontal" if idx < 3 else "vertical"


def _sources(cells, ca, cb):
    """Per-cell attribution: which partner supplies each number of a line."""
    out = []
    for c in cells:
        a_has, b_has = ca[str(c)] > 0, cb[str(c)] > 0
        out.append({"number": c, "source": "both" if a_has and b_has else ("a" if a_has else "b")})
    return out


def _combined_completions(ga, gb):
    """Lo Shu lines newly completed by the UNION of two grids — full in the merged grid
    but not full in either partner alone (the partnership's value-add). Each line carries its
    orientation (horizontal/vertical plane, or diagonal). The two diagonals are reported
    always (with their merged-missing cells when incomplete) so the Raj-Yog status — the
    popular-numerology term for a jointly completed diagonal — is never silently dropped."""
    ca, cb = ga["counts"], gb["counts"]
    merged = {str(n): ca[str(n)] + cb[str(n)] for n in range(1, 10)}

    def full(counts, cells):
        return all(counts[str(c)] > 0 for c in cells)

    completed, diagonals = [], []
    for idx, (name, cells) in enumerate(LOSHU_LINES):
        orient = _orientation(idx, name)
        newly = full(merged, cells) and not full(ca, cells) and not full(cb, cells)
        if newly:
            completed.append({
                "name": name, "cells": cells, "meaning": LOSHU_LINE_MEANING[name],
                "type": _line_type(name), "orientation": orient,
                "raj_yog": orient == "diagonal", "from": _sources(cells, ca, cb),
            })
        if orient == "diagonal":
            diagonals.append({
                "name": name, "cells": cells, "meaning": LOSHU_LINE_MEANING[name],
                "newly": newly,
                "from": _sources(cells, ca, cb) if newly else None,
                "missing_in_merged": [c for c in cells if merged[str(c)] == 0],
            })
    return {
        "completed_lines": completed,
        "diagonals": diagonals,
        "has_raj_yog": any(d["newly"] for d in diagonals),
    }


def compute_numerology_match(name_a, dob_a, gender_a, name_b, dob_b, gender_b):
    """Indicative (non-classical) numerology compatibility between two people, via the
    ruling-planet NAISARGIKA friendship table and Lo Shu grid complementarity."""
    na = compute_numerology(name_a, dob_a, gender_a)
    nb = compute_numerology(name_b, dob_b, gender_b)

    # Core: like-for-like driver / conductor / life-path via ruling planets.
    core_pairs, core_pts = {}, 0
    for key, a_num, b_num in (
        ("mulank",    na["mulank"]["number"],   nb["mulank"]["number"]),
        ("bhagyank",  na["bhagyank"]["number"], nb["bhagyank"]["number"]),
        ("life_path", na["life_path"],          nb["life_path"]),
    ):
        pts, rel = _rel_points(_ruler_of(a_num), _ruler_of(b_num))
        core_pts += pts
        core_pairs[key] = {"a": a_num, "b": b_num, "relation": rel}
    core_score = round(core_pts / 6 * 10)

    # Driver-conductor: CROSS pairing (A driver vs B conductor, and vice-versa).
    a_drv, a_con = na["mulank"]["number"], na["bhagyank"]["number"]
    b_drv, b_con = nb["mulank"]["number"], nb["bhagyank"]["number"]
    p1, r1 = _rel_points(_ruler_of(a_drv), _ruler_of(b_con))
    p2, r2 = _rel_points(_ruler_of(b_drv), _ruler_of(a_con))
    dc_score = round((p1 + p2) / 4 * 10)

    # Grid complementarity: numbers one partner is missing that the other supplies.
    ga, gb = na["loshu"], nb["loshu"]
    a_filled = [n for n in ga["missing"] if n not in gb["missing"]]
    b_filled = [n for n in gb["missing"] if n not in ga["missing"]]
    shared = [n for n in ga["repeated"] if n in gb["repeated"]]
    total_missing = len(ga["missing"]) + len(gb["missing"])
    grid_score = round((len(a_filled) + len(b_filled)) / total_missing * 10) if total_missing else 5

    overall = round((core_score + dc_score + grid_score) / 3)
    return {
        "between": [name_a, name_b],
        "core": {"pairs": core_pairs, "score": core_score, "rating": _num_rating(core_score)},
        "driver_conductor": {
            "a_driver_vs_b_conductor": {"a": a_drv, "b": b_con, "relation": r1},
            "b_driver_vs_a_conductor": {"a": b_drv, "b": a_con, "relation": r2},
            "score": dc_score, "rating": _num_rating(dc_score),
        },
        "grid": {
            "a_missing_filled_by_b": a_filled,
            "b_missing_filled_by_a": b_filled,
            "shared_strengths": shared,
            "score": grid_score, "rating": _num_rating(grid_score),
            # Full per-person Lo Shu grids so the UI can render both side-by-side.
            "a_grid": ga,
            "b_grid": gb,
        },
        "combined": _combined_completions(ga, gb),
        "indicative_score": overall,
        "indicative_label": "indicative, non-classical",
        "summary_rating": _num_rating(overall),
    }


def compute_numerology_match_json(name_a, dob_a, gender_a, name_b, dob_b, gender_b):
    return json.dumps(compute_numerology_match(name_a, dob_a, gender_a, name_b, dob_b, gender_b))


def compute_loshu_grid_json(dob, gender=None):
    """Worker entry point: just the Lo Shu grid (no name required)."""
    return json.dumps(compute_loshu_grid(dob, gender))


def compute_numerology(full_name, dob, gender=None, name_in_use=None):
    """
    full_name: str (birth certificate name)
    dob: 'YYYY-MM-DD'
    gender: str | None ('male'/'female' enables the Kua number in the Lo Shu grid)
    name_in_use: str | None (everyday name, if different from the birth name)
    Returns: dict with life_path, destiny, soul_urge, personality, personal_year,
             mulank, bhagyank, name_compound, loshu, name_in_use
    """
    # Life Path / Bhagyank (Destiny number): reduce all digits in DOB.
    dob_digits = [int(d) for d in dob if d.isdigit()]
    life_path = _reduce(sum(dob_digits))

    # Mulank (Driver / Psychic number): the day of birth reduced to 1-9 (no master numbers).
    parts = dob.split('-')
    mulank = _reduce(int(parts[2]), keep_master=False)

    # Destiny / Soul Urge / Personality for the full birth name (both systems).
    name_numbers = _name_numbers(full_name)
    destiny = name_numbers["destiny"]
    soul_urge = name_numbers["soul_urge"]
    personality = name_numbers["personality"]

    # Compound (Cheiro) number off the Chaldean full-name total.
    name_total = _name_sum(full_name, CHALDEAN)
    _compound, _single = _compound_and_single(name_total)
    name_compound = {
        "raw": name_total,
        "compound": _compound,
        "single": _single,
        "meaning": CHEIRO_COMPOUND.get(_compound),
    }

    # Personal Year: day + month of birth + current year
    current_year = datetime.now().year
    day_month_sum = int(parts[2]) + int(parts[1])
    year_sum = sum(int(d) for d in str(current_year))
    personal_year = _reduce(day_month_sum + year_sum)

    return {
        "life_path": life_path,
        "destiny": destiny,
        "soul_urge": soul_urge,
        "personality": personality,
        "personal_year": personal_year,
        "mulank": _with_ruler(mulank),
        "bhagyank": _with_ruler(life_path if life_path <= 9 else _reduce(life_path, keep_master=False)),
        "name_compound": name_compound,
        "loshu": compute_loshu_grid(dob, gender),
        "name_in_use": (_name_numbers(name_in_use) if name_in_use else None),
    }


def compute_numerology_json(full_name, dob, gender=None, name_in_use=None):
    return json.dumps(compute_numerology(full_name, dob, gender, name_in_use))
