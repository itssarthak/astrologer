import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_numerology
from synastry import compute_guna_milan, compute_synastry
from chart import compute_chart

def test_numerology_life_path_range():
    result = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert 1 <= result["life_path"] <= 33

def test_numerology_has_all_keys():
    result = compute_numerology("Sarthak Chhabra", "1996-11-22")
    for key in ("life_path", "destiny", "soul_urge", "personality", "personal_year"):
        assert key in result

def test_numerology_destiny_has_both_systems():
    result = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert "chaldean" in result["destiny"]
    assert "pythagorean" in result["destiny"]

def test_numerology_mulank_and_rulers():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert r["mulank"]["number"] == 4          # 22 -> 2+2 = 4
    assert r["mulank"]["ruler"] == "Rahu"      # 4 is ruled by Rahu
    assert r["bhagyank"]["number"] == r["life_path"]
    assert r["bhagyank"]["ruler"] in ("Sun","Moon","Jupiter","Rahu","Mercury","Venus","Ketu","Saturn","Mars")


def test_numerology_name_in_use_present_when_passed():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22", name_in_use="Sarthak")
    assert "name_in_use" in r
    assert "chaldean" in r["name_in_use"]["destiny"]


def test_numerology_name_in_use_absent_when_not_passed():
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    assert r.get("name_in_use") is None


def test_numerology_compound_number_structure():
    from numerology import CHEIRO_COMPOUND
    r = compute_numerology("Sarthak Chhabra", "1996-11-22")
    cn = r["name_compound"]
    assert "raw" in cn and "compound" in cn and "single" in cn
    assert cn["single"] == r["destiny"]["chaldean"]
    assert isinstance(cn["compound"], int)
    # When the raw total is already in/under the Cheiro band, compound IS the raw total.
    if cn["raw"] <= 52:
        assert cn["compound"] == cn["raw"]
    assert cn["meaning"] == CHEIRO_COMPOUND.get(cn["compound"])


def test_cheiro_meaning_lookup_for_known_compound():
    from numerology import CHEIRO_COMPOUND, _compound_and_single
    compound, single = _compound_and_single(23)
    assert compound == 23 and single == 5
    assert CHEIRO_COMPOUND[23].startswith("Royal Star of the Lion")


def test_compound_and_single_pins_value():
    from numerology import _compound_and_single, CHEIRO_COMPOUND
    assert _compound_and_single(23) == (23, 5)        # already in 10-52 band
    assert _compound_and_single(37) == (37, 1)        # in-band; meaning must exist
    assert CHEIRO_COMPOUND[37]                          # row is present (not a hole)
    c, s = _compound_and_single(137)                    # >52 -> reduce into band
    assert c <= 52 and c in CHEIRO_COMPOUND


def test_number_compatibility_neutral():
    from numerology import compute_number_compatibility
    # Saturn(8) and Jupiter(3) are neutral both ways in the Naisargika matrix.
    assert compute_number_compatibility(8, 3)["relation"] == "neutral"


def test_number_compatibility_friends_and_enemies():
    from numerology import compute_number_compatibility
    # 1 (Sun) and 3 (Jupiter) are natural friends.
    r = compute_number_compatibility(1, 3)
    assert r["relation"] == "friend"
    # 1 (Sun) and 8 (Saturn) are natural enemies.
    assert compute_number_compatibility(1, 8)["relation"] == "enemy"
    # symmetric in label severity: enemy/friend determined per the matrix both ways
    assert compute_number_compatibility(3, 1)["relation"] == "friend"


def test_number_compatibility_json_roundtrips():
    import json as _json
    from numerology import compute_number_compatibility_json
    parsed = _json.loads(compute_number_compatibility_json(2, 6))
    assert parsed["a"] == 2 and parsed["b"] == 6
    assert parsed["relation"] in ("friend", "neutral", "enemy")


def test_guna_milan_total_in_range():
    result = compute_guna_milan("Shravana", "male", "Ashwini", "female")
    assert 0 <= result["total"] <= 36

def test_guna_milan_nadi_full_score_different_nadi():
    result = compute_guna_milan("Ashwini", "", "Rohini", "")  # Vata vs Kapha
    assert result["breakdown"]["nadi"]["score"] == 8

def test_guna_milan_no_gender_is_order_independent():
    # Without gender the directional kootas average both ways, so the same pair scores the
    # same regardless of which profile is active vs. partner (regression: A->B 31 vs B->A 27).
    import itertools
    from synastry import NAKSHATRA_NAMES
    for a, b in itertools.combinations(NAKSHATRA_NAMES, 2):
        assert compute_guna_milan(a, "", b, "")["total"] == compute_guna_milan(b, "", a, "")["total"], f"{a} vs {b}"

def test_guna_milan_with_gender_is_pair_consistent_and_directional():
    # The score depends on the actual genders, NOT argument order.
    assert compute_guna_milan("Rohini", "male", "Magha", "female")["total"] \
        == compute_guna_milan("Magha", "female", "Rohini", "male")["total"]
    # Swapping who is groom vs bride can change the directional Varna/Gana kootas.
    mf = compute_guna_milan("Magha", "male", "Rohini", "female")["breakdown"]
    fm = compute_guna_milan("Magha", "female", "Rohini", "male")["breakdown"]
    assert (mf["varna"]["score"], mf["gana"]["score"]) != (fm["varna"]["score"], fm["gana"]["score"])

def test_synastry_returns_guna_milan_and_overlays():
    chart_a = compute_chart("A", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    chart_b = compute_chart("B", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra")
    result = compute_synastry(chart_a, chart_b)
    assert "guna_milan" in result
    assert "a_planets_in_b_houses" in result
    assert "b_planets_in_a_houses" in result
