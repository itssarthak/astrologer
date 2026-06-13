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
