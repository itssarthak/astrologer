"""Pure-logic koota tests for the classical Yoni + Vashya implementations (no jyotishganit)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from synastry import compute_guna_milan, YONI_KOOTA


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
