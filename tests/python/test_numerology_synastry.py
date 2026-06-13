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
