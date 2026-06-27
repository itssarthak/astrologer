import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from numerology import compute_numerology_match, _combined_completions


def _grid(counts):
    """Minimal Lo Shu grid stub: only the counts the helper reads."""
    return {"counts": {str(n): counts.get(n, 0) for n in range(1, 10)}}


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


def test_combined_completion_newly_completed_by_union():
    # A holds 4 and 2 of the mental plane (4-9-2); B supplies the missing 9. Neither full alone.
    c = _combined_completions(_grid({4: 1, 2: 1}), _grid({9: 1}))
    names = [l["name"] for l in c["completed_lines"]]
    assert "Mental plane (4-9-2)" in names
    line = next(l for l in c["completed_lines"] if l["name"] == "Mental plane (4-9-2)")
    assert line["type"] == "plane"
    assert line["raj_yog"] is False
    assert line["meaning"]  # sourced planet-ruler meaning carried through
    src = {f["number"]: f["source"] for f in line["from"]}
    assert src == {4: "a", 9: "b", 2: "a"}


def test_combined_completion_vertical_plane_is_a_plane():
    # The vertical lines (Thought/Will/Action) are planes too — not a lesser "column".
    c = _combined_completions(_grid({9: 1, 5: 1}), _grid({1: 1}))
    line = next(l for l in c["completed_lines"] if l["name"] == "Will plane (9-5-1)")
    assert line["type"] == "plane"
    assert line["raj_yog"] is False


def test_combined_completion_diagonal_is_raj_yog():
    # Diagonal 2-5-8: A holds 2 and 5, B supplies 8.
    c = _combined_completions(_grid({2: 1, 5: 1}), _grid({8: 1}))
    line = next(l for l in c["completed_lines"] if l["name"] == "Diagonal 2-5-8")
    assert line["type"] == "diagonal"
    assert line["raj_yog"] is True
    assert c["has_raj_yog"] is True


def test_combined_excludes_lines_already_full_for_one_partner():
    # A already has a complete mental plane — completing it jointly is not the partnership's add.
    c = _combined_completions(_grid({4: 1, 9: 1, 2: 1}), _grid({4: 1, 9: 1, 2: 1}))
    names = [l["name"] for l in c["completed_lines"]]
    assert "Mental plane (4-9-2)" not in names


def test_match_has_combined_block():
    m = compute_numerology_match("Sarthak Chhabra", "1996-11-22", "male",
                                 "Alice Smith", "1990-06-15", "female")
    assert "combined" in m
    assert isinstance(m["combined"]["completed_lines"], list)
    assert isinstance(m["combined"]["has_raj_yog"], bool)
    # Every surfaced line must genuinely be newly completed by the union.
    ga, gb = m["grid"]["a_grid"]["counts"], m["grid"]["b_grid"]["counts"]
    for line in m["combined"]["completed_lines"]:
        a_full = all(ga[str(c)] > 0 for c in line["cells"])
        b_full = all(gb[str(c)] > 0 for c in line["cells"])
        assert not a_full and not b_full


def test_match_driver_conductor_is_cross_paired():
    m = compute_numerology_match("A B", "1996-11-22", "male", "C D", "1990-06-15", "female")
    dc = m["driver_conductor"]
    assert set(dc["a_driver_vs_b_conductor"].keys()) == {"a", "b", "relation"}
    assert set(dc["b_driver_vs_a_conductor"].keys()) == {"a", "b", "relation"}
