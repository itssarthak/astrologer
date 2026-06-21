import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_kua


def test_kua_male_1996():
    # 1+9+9+6 = 25 -> 7; male = 10 - 7 = 3
    assert compute_kua(1996, "male") == 3


def test_kua_female_1996():
    # female = 5 + 7 = 12 -> 3
    assert compute_kua(1996, "female") == 3


def test_kua_male_five_maps_to_two():
    # 1994 -> 1+9+9+4 = 23 -> 5; male = 10 - 5 = 5 -> 2
    assert compute_kua(1994, "male") == 2


def test_kua_female_five_maps_to_eight():
    # year root 9 -> female 5+9 = 14 -> 5 -> 8 (e.g. 1980: 1+9+8+0=18->9)
    assert compute_kua(1980, "female") == 8


def test_kua_none_for_other_or_blank():
    assert compute_kua(1996, "other") is None
    assert compute_kua(1996, "") is None
    assert compute_kua(1996, None) is None
