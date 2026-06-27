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


from numerology import compute_loshu_grid


def test_loshu_counts_skip_zero_and_include_driver_conductor():
    # 1996-11-22: DOB digits (no 0s) = 1,9,9,6,1,1,2,2 ; mulank=4 (22->4); bhagyank=life_path
    # life_path = 1+9+9+6+1+1+2+2 = 31 -> 4 ; kua omitted (no gender)
    g = compute_loshu_grid("1996-11-22")
    assert set(g["counts"].keys()) == {str(n) for n in range(1, 10)}   # only 1-9, never 0
    assert g["counts"]["1"] == 3       # three 1s in the date
    assert g["counts"]["9"] == 2
    assert g["counts"]["4"] == 2       # mulank(4) + bhagyank(4)
    assert g["kua"] is None
    assert g["kua_note"]


def test_loshu_missing_and_repeated():
    g = compute_loshu_grid("1996-11-22")
    assert 5 in g["missing"]           # no 5 placed
    assert 9 in g["repeated"]          # appears twice


def test_loshu_lines_and_arrows_present():
    g = compute_loshu_grid("1996-11-22")
    names = {l["name"] for l in g["lines"]}
    assert "Mental plane (4-9-2)" in names
    assert "Will plane (9-5-1)" in names
    for l in g["lines"]:
        assert l["state"] in ("full", "partial", "absent")
        assert l["meaning"]
    assert isinstance(g["arrows_strength"], list)
    assert isinstance(g["arrows_weakness"], list)


def test_loshu_kua_placed_when_gender_given():
    # 1996 male kua = 3; that adds an extra 3 to the grid
    no_g = compute_loshu_grid("1996-11-22")
    male = compute_loshu_grid("1996-11-22", "male")
    assert male["kua"] == 3
    assert male["counts"]["3"] == no_g["counts"]["3"] + 1


import json
from numerology import compute_loshu_grid_json


def test_loshu_grid_json_roundtrips():
    raw = compute_loshu_grid_json("1996-11-22", "male")
    g = json.loads(raw)
    assert g["kua"] == 3
    assert set(g["counts"].keys()) == {str(n) for n in range(1, 10)}


def test_loshu_grid_json_no_gender():
    g = json.loads(compute_loshu_grid_json("1996-11-22"))
    assert g["kua"] is None
