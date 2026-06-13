# tests/python/test_adapter.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from adapter import planet_facts


def test_planet_facts_has_core_fields(sarthak_chart):
    facts = planet_facts(sarthak_chart)
    assert "Saturn" in facts
    s = facts["Saturn"]
    for key in ("sign", "sign_idx", "house", "longitude", "nakshatra", "pada",
                "retrograde", "dignity", "rupas", "min_required", "meets", "is_strong",
                "conjuncts", "aspects_gives", "aspects_receives"):
        assert key in s, f"missing {key}"


def test_planet_facts_types(sarthak_chart):
    s = planet_facts(sarthak_chart)["Saturn"]
    assert isinstance(s["sign_idx"], int) and 0 <= s["sign_idx"] <= 11
    assert isinstance(s["retrograde"], bool)
    assert isinstance(s["is_strong"], bool)
    assert isinstance(s["conjuncts"], list)
    assert isinstance(s["aspects_gives"], list)
    assert s["is_strong"] == (s["meets"] == "Yes")


from adapter import lagna_sign, house_lords


def test_lagna_sign(sarthak_chart):
    assert lagna_sign(sarthak_chart) == "Aquarius"  # known Aquarius lagna


def test_house_lords(sarthak_chart):
    lords = house_lords(sarthak_chart)
    assert len(lords) == 12
    assert lords[1] == "Saturn"   # Aquarius (H1) -> Saturn
    assert lords[5] == "Mercury"  # Gemini (5th from Aquarius) -> Mercury
