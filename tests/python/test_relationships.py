import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from relationships import NAISARGIKA, planet_relation


def test_matrix_has_nine_grahas():
    assert set(NAISARGIKA) == {"Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"}


def test_relations_symmetric_severity():
    assert planet_relation("Sun", "Jupiter") == "friend"
    assert planet_relation("Sun", "Saturn") == "enemy"
    assert planet_relation("Saturn", "Jupiter") == "neutral"
    # enemy dominates if either side is an enemy
    assert planet_relation("Moon", "Mercury") == "enemy"   # Mercury counts Moon an enemy
    assert planet_relation("nope", "Sun") == "neutral"     # unknown -> neutral
