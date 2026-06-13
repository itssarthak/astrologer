import json
from datetime import datetime

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


# Naisargika (natural) planetary friendships (BPHS). 'friend'/'enemy'/'neutral' only.
# Rahu follows Saturn's set and Ketu follows Mars's set (standard convention).
_NAISARGIKA = {
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


def _planet_relation(p_a, p_b):
    """friend | enemy | neutral between two planets (max severity of the two directions:
    enemy dominates, then friend, else neutral)."""
    a = _NAISARGIKA.get(p_a, {})
    b = _NAISARGIKA.get(p_b, {})
    if p_b in a.get("enemy", set()) or p_a in b.get("enemy", set()):
        return "enemy"
    if p_b in a.get("friend", set()) or p_a in b.get("friend", set()):
        return "friend"
    return "neutral"


def compute_number_compatibility(a, b):
    """Compatibility between two numerology numbers (1-9) via their ruling planets."""
    a = a if a <= 9 else _reduce(a, keep_master=False)
    b = b if b <= 9 else _reduce(b, keep_master=False)
    pa, pb = PLANET_RULER.get(a), PLANET_RULER.get(b)
    relation = _planet_relation(pa, pb) if pa and pb else "neutral"
    return {"a": a, "b": b, "rulers": [pa, pb], "relation": relation}


def compute_number_compatibility_json(a, b):
    return json.dumps(compute_number_compatibility(int(a), int(b)))


def compute_numerology(full_name, dob, name_in_use=None):
    """
    full_name: str (birth certificate name)
    dob: 'YYYY-MM-DD'
    name_in_use: str | None (everyday name, if different from the birth name)
    Returns: dict with life_path, destiny, soul_urge, personality, personal_year,
             mulank, bhagyank, name_compound, name_in_use
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
        "name_in_use": (_name_numbers(name_in_use) if name_in_use else None),
    }


def compute_numerology_json(full_name, dob, name_in_use=None):
    return json.dumps(compute_numerology(full_name, dob, name_in_use))
