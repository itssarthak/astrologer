import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_numerology_match


def test_match_structure_and_scores():
    m = compute_numerology_match("Sarthak Chhabra", "1996-11-22", "male",
                                 "Alice Smith", "1990-06-15", "female")
    assert m["between"] == ["Sarthak Chhabra", "Alice Smith"]
    for block in ("core", "driver_conductor", "grid"):
        assert 0 <= m[block]["score"] <= 10
        assert m[block]["rating"] in ("Harmonious", "Mixed", "Challenging")
    assert 0 <= m["indicative_score"] <= 10
    assert m["indicative_label"] == "indicative, non-classical"
    assert m["summary_rating"] in ("Harmonious", "Mixed", "Challenging")


def test_match_core_pairs_use_relations():
    m = compute_numerology_match("Sarthak Chhabra", "1996-11-22", "male",
                                 "Alice Smith", "1990-06-15", "female")
    for key in ("mulank", "bhagyank", "life_path"):
        pair = m["core"]["pairs"][key]
        assert pair["relation"] in ("friend", "neutral", "enemy")


def test_match_is_deterministic():
    args = ("A B", "1996-11-22", "male", "C D", "1990-06-15", "female")
    assert compute_numerology_match(*args) == compute_numerology_match(*args)


def test_match_includes_full_per_person_grids():
    m = compute_numerology_match("Sarthak Chhabra", "1996-11-22", "male",
                                 "Alice Smith", "1990-06-15", "female")
    for key in ("a_grid", "b_grid"):
        g = m["grid"][key]
        assert set(g["counts"].keys()) == {str(n) for n in range(1, 10)}
        assert isinstance(g["missing"], list)
        assert isinstance(g["repeated"], list)
        assert "arrows_strength" in g and "arrows_weakness" in g


def test_match_driver_conductor_is_cross_paired():
    m = compute_numerology_match("A B", "1996-11-22", "male", "C D", "1990-06-15", "female")
    dc = m["driver_conductor"]
    assert set(dc["a_driver_vs_b_conductor"].keys()) == {"a", "b", "relation"}
    assert set(dc["b_driver_vs_a_conductor"].keys()) == {"a", "b", "relation"}
