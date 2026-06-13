# tests/python/test_aspects.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from aspects import orb_within_sign, tightness, aspect_summary


def test_orb_within_sign_wraps():
    assert orb_within_sign(2.0, 5.0) == 3.0
    assert orb_within_sign(1.0, 29.0) == 2.0  # shortest distance on the 30-degree wheel


def test_tightness_bands():
    assert tightness(2.0) == "tight"
    assert tightness(5.0) == "active"
    assert tightness(8.0) == "loose"
    assert tightness(12.0) == "noted"


def test_aspect_summary_lists_given_aspects():
    facts = {
        "Saturn": {"aspects_gives": [{"to_planet": "Jupiter", "aspect_type": "10"},
                                     {"to_house": 4, "aspect_type": "3"}],
                   "aspects_receives": [{"from_planet": "Mars", "aspect_type": "8"}],
                   "conjuncts": ["Ketu"]},
    }
    summ = aspect_summary(facts, "Saturn")
    assert "Jupiter" in summ["aspects_planets"]
    assert "Ketu" in summ["conjuncts"]
    assert 4 in summ["aspects_houses"]
    assert "Mars" in summ["aspected_by"]
