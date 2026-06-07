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


def _reduce(n, keep_master=True):
    while n > 9 and (not keep_master or n not in MASTER):
        n = sum(int(d) for d in str(n))
    return n


def _name_sum(name, mapping, letter_filter=None):
    letters = [c for c in name.upper() if c.isalpha()]
    if letter_filter:
        letters = [c for c in letters if c in letter_filter]
    return sum(mapping.get(c, 0) for c in letters)


def compute_numerology(full_name, dob):
    """
    full_name: str (birth certificate name)
    dob: 'YYYY-MM-DD'
    Returns: dict with life_path, destiny, soul_urge, personality, personal_year
    """
    # Life Path: reduce all digits in DOB
    dob_digits = [int(d) for d in dob if d.isdigit()]
    life_path = _reduce(sum(dob_digits))

    # Destiny (Expression): all letters
    destiny = {
        "chaldean": _reduce(_name_sum(full_name, CHALDEAN)),
        "pythagorean": _reduce(_name_sum(full_name, PYTHAGOREAN)),
    }

    # Soul Urge: vowels only
    soul_urge = {
        "chaldean": _reduce(_name_sum(full_name, CHALDEAN, VOWELS)),
        "pythagorean": _reduce(_name_sum(full_name, PYTHAGOREAN, VOWELS)),
    }

    # Personality: consonants only
    personality = {
        "chaldean": _reduce(_name_sum(full_name, CHALDEAN, CONSONANTS)),
        "pythagorean": _reduce(_name_sum(full_name, PYTHAGOREAN, CONSONANTS)),
    }

    # Personal Year: day + month of birth + current year
    parts = dob.split('-')
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
    }


def compute_numerology_json(full_name, dob):
    return json.dumps(compute_numerology(full_name, dob))
