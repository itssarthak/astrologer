# tests/python/test_dignity.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from dignity import strength_label, DIGNITY_RANK


def test_strength_label_bands():
    assert strength_label({"rupas": 7.0, "min_required": 5.0}) == "strong"
    assert strength_label({"rupas": 5.0, "min_required": 5.0}) == "adequate"
    assert strength_label({"rupas": 3.0, "min_required": 5.0}) == "weak"


def test_strength_label_missing_data():
    assert strength_label({"rupas": None, "min_required": None}) == "unknown"


def test_dignity_rank_orders_exalted_above_debilitated():
    assert DIGNITY_RANK["exalted"] > DIGNITY_RANK["debilitated"]
    assert DIGNITY_RANK["own"] > DIGNITY_RANK["neutral"]
