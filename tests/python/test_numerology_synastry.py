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
    result = compute_guna_milan("Shravana", 3, "Ashwini", 1)
    assert 0 <= result["total"] <= 36

def test_guna_milan_nadi_full_score_different_nadi():
    result = compute_guna_milan("Ashwini", 1, "Rohini", 1)  # Vata vs Kapha
    assert result["breakdown"]["nadi"]["score"] == 8

def test_synastry_returns_guna_milan_and_overlays():
    chart_a = compute_chart("A", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    chart_b = compute_chart("B", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra")
    result = compute_synastry(chart_a, chart_b)
    assert "guna_milan" in result
    assert "a_planets_in_b_houses" in result
    assert "b_planets_in_a_houses" in result
