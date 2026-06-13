"""Pure-logic koota tests for the classical Yoni + Vashya implementations (no jyotishganit)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from synastry import compute_guna_milan, YONI_KOOTA, cross_aspects, ASPECT_ANGLES


def _pf(planet, sign_idx, dignity="neutral", strength="adequate"):
    return {planet: {"sign_idx": sign_idx, "dignity": dignity, "strength": strength}}


def test_seventh_aspect_is_mutual():
    # A's Venus in Aries(0), B's Mars in Libra(6): distance 7 both ways -> both aspect.
    a = _pf("Venus", 0); b = _pf("Mars", 6)
    res = cross_aspects(a, b)
    pairs = {(x["from"], x["from_owner"], x["to"]) for x in res}
    assert ("Venus", "A", "Mars") in pairs   # Venus aspects Mars (7th)
    assert ("Mars", "B", "Venus") in pairs    # Mars aspects Venus (7th, mutual)


def test_jupiter_special_5th_aspect():
    # A's Jupiter in Aries(0) aspects B's planet in Leo(4): distance 5 -> Jupiter's 5th aspect.
    a = _pf("Jupiter", 0); b = _pf("Moon", 4)
    res = cross_aspects(a, b)
    assert any(x["from"] == "Jupiter" and x["to"] == "Moon" and x["type"] == "aspect" for x in res)
    # but the reverse (Moon -> Jupiter, distance 9) is NOT a Moon aspect
    assert not any(x["from"] == "Moon" and x["to"] == "Jupiter" for x in res)


def test_conjunction_same_sign():
    a = _pf("Venus", 3); b = _pf("Mars", 3)
    res = cross_aspects(a, b)
    assert any(x["type"] == "conjunction" and {x["from"], x["to"]} == {"Venus", "Mars"} for x in res)


def test_benefic_aspect_supportive_malefic_challenging():
    a = _pf("Jupiter", 0); b = _pf("Moon", 6)   # Jupiter (benefic) -> Moon, 7th
    assert any(x["from"] == "Jupiter" and x["effect"] == "supportive" for x in cross_aspects(a, b))
    a2 = _pf("Saturn", 0); b2 = _pf("Moon", 6)  # Saturn (malefic) -> Moon, 7th
    assert any(x["from"] == "Saturn" and x["effect"] == "challenging" for x in cross_aspects(a2, b2))


from synastry import compute_house_overlays, marriage_factors, dasha_overlap
from synastry import compute_synastry
from chart import compute_chart


def test_compute_synastry_has_deep_layers():
    a = compute_chart("A", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    b = compute_chart("B", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra")
    s = compute_synastry(a, b)
    assert "cross_aspects" in s and isinstance(s["cross_aspects"], list)
    assert "marriage_factors" in s and set(s["marriage_factors"]) == {"a", "b"}
    assert "dasha_overlap" in s and "relation" in s["dasha_overlap"]
    assert "top_supportive" in s and "top_challenging" in s
    # digest items are capped
    assert len(s["top_supportive"]) <= 5 and len(s["top_challenging"]) <= 5
    # existing keys preserved
    assert "guna_milan" in s and "overlay_summary" in s


def test_dasha_overlap_relation():
    assert dasha_overlap("Sun", "Jupiter")["relation"] == "friend"
    assert dasha_overlap("Sun", "Saturn")["relation"] == "enemy"
    assert dasha_overlap(None, "Saturn")["relation"] == "unknown"


def test_dasha_overlap_eases_after_is_sooner_end_when_enemy():
    r = dasha_overlap("Sun", "Saturn", "2029-03-08", "2027-10-31")
    assert r["relation"] == "enemy"
    assert r["eases_after"] == "2027-10-31"   # the chronologically-sooner mahadasha end
    assert "2027-10-31" in r["note"]


def test_dasha_overlap_no_eases_when_not_enemy():
    assert dasha_overlap("Sun", "Jupiter", "2029-03-08", "2030-01-01")["eases_after"] is None


def test_compute_synastry_exposes_challenging_until_key():
    a = compute_chart("A", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    b = compute_chart("B", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra")
    s = compute_synastry(a, b)
    assert "challenging_until" in s   # date string or None depending on the live periods


def test_marriage_factors_reports_seventh_lord_and_karakas():
    facts = {
        "Venus": {"house": 2, "dignity": "own", "strength": "strong"},
        "Jupiter": {"house": 5, "dignity": "neutral", "strength": "adequate"},
        "Saturn": {"house": 7, "dignity": "neutral", "strength": "weak"},
    }
    lords = {7: "Saturn"}
    mf = marriage_factors(facts, lords)
    assert mf["seventh_lord"] == "Saturn"
    assert mf["seventh_lord_strength"] == "weak"
    assert mf["venus_strength"] == "strong"
    assert mf["jupiter_strength"] == "adequate"


def test_overlay_carries_strength_when_facts_given():
    # minimal charts: B has Jupiter in the sign that is A's 7th house.
    chart_a = {"d1Chart": {"houses": [{"number": n, "sign": s, "occupants": []}
               for n, s in enumerate(["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra",
                                       "Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"], 1)]}}
    chart_b = {"d1Chart": {"houses": [{"number": 1, "sign": "Aries",
               "occupants": [{"celestialBody": "Jupiter", "sign": "Libra"}]}]}}
    facts_b = {"Jupiter": {"dignity": "exalted", "strength": "strong"}}
    ov = compute_house_overlays(chart_a, chart_b, facts_b)
    j = next(o for o in ov if o["planet"] == "Jupiter")
    assert j["falls_in_house"] == 7
    assert j["strength"] == "strong" and j["dignity"] == "exalted"
    assert j["weight"] >= 1.5  # strong benefic on the 7th weighs more


def test_overlay_without_facts_still_works():
    # back-compat: no facts arg -> no strength/dignity, weight defaults.
    chart_a = {"d1Chart": {"houses": [{"number": 1, "sign": "Aries", "occupants": []}]}}
    chart_b = {"d1Chart": {"houses": [{"number": 1, "sign": "Aries",
               "occupants": [{"celestialBody": "Mars", "sign": "Aries"}]}]}}
    ov = compute_house_overlays(chart_a, chart_b)
    assert ov and ov[0]["planet"] == "Mars"


def yoni(a, b, sa="", sb=""):
    return compute_guna_milan(a, "", b, "", sa, sb)["breakdown"]["yoni"]["score"]

def vashya(sa, sb):
    return compute_guna_milan("Ashwini", "", "Ashwini", "", sa, sb)["breakdown"]["vashya"]["score"]


def test_yoni_matrix_is_symmetric_and_diagonal_four():
    for i in range(14):
        assert YONI_KOOTA[i][i] == 4
        for j in range(14):
            assert YONI_KOOTA[i][j] == YONI_KOOTA[j][i]

def test_yoni_same_animal_scores_four():
    # Ashwini and Shatabhisha are both Horse yoni.
    assert yoni("Ashwini", "Shatabhisha") == 4

def test_yoni_sworn_enemy_scores_zero():
    # Uttara Phalguni = Cow, Chitra = Tiger — a sworn-enemy pair.
    assert yoni("Uttara Phalguni", "Chitra") == 0

def test_yoni_is_in_range():
    assert 0 <= yoni("Bharani", "Rohini") <= 4

def test_vashya_same_class_scores_two():
    # Aries and Taurus are both Chatushpada (quadruped).
    assert vashya("Aries", "Taurus") == 2

def test_vashya_predator_prey_scores_zero():
    # Leo (Vanachara/wild) vs Aries (Chatushpada/quadruped) — predator/prey, 0 points.
    assert vashya("Leo", "Aries") == 0

def test_vashya_unknown_sign_falls_back_to_neutral():
    assert vashya("", "Taurus") == 1

def test_vashya_is_symmetric_for_known_signs():
    assert vashya("Cancer", "Pisces") == vashya("Pisces", "Cancer")
