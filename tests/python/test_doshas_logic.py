"""Pure-logic dosha tests — build minimal charts by hand so these run without jyotishganit."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from doshas import compute_doshas


def chart(planet_houses, nakshatras=None, signs=None):
    """planet_houses: {planet: house number 1..12}."""
    nakshatras = nakshatras or {}
    signs = signs or {}
    houses = []
    for n in range(1, 13):
        occupants = [
            {"celestialBody": p, "sign": signs.get(p, "Gemini"), "nakshatra": nakshatras.get(p, "")}
            for p, h in planet_houses.items() if h == n
        ]
        houses.append({"number": n, "occupants": occupants})
    return {"d1Chart": {"houses": houses}}


def test_guru_chandala_present_when_jupiter_conjunct_rahu():
    d = compute_doshas(chart({"Jupiter": 5, "Rahu": 5, "Ketu": 11}))
    assert d["guru_chandala"]["present"] is True

def test_guru_chandala_absent_when_jupiter_not_with_rahu():
    d = compute_doshas(chart({"Jupiter": 3, "Rahu": 5, "Ketu": 11}))
    assert d["guru_chandala"]["present"] is False

def test_pitru_present_when_sun_conjunct_rahu():
    d = compute_doshas(chart({"Sun": 7, "Rahu": 7, "Ketu": 1}))
    assert d["pitru"]["present"] is True

def test_pitru_absent_when_sun_not_with_rahu():
    d = compute_doshas(chart({"Sun": 2, "Rahu": 7, "Ketu": 1}))
    assert d["pitru"]["present"] is False

def test_ganda_moola_present_when_moon_in_moola_nakshatra():
    d = compute_doshas(chart({"Moon": 4}, nakshatras={"Moon": "Moola"}))
    assert d["ganda_moola"]["present"] is True

def test_ganda_moola_absent_for_ordinary_nakshatra():
    d = compute_doshas(chart({"Moon": 4}, nakshatras={"Moon": "Rohini"}))
    assert d["ganda_moola"]["present"] is False

def test_kala_sarpa_present_when_all_planets_inside_rahu_ketu_arc():
    # Rahu H1, Ketu H7; all classical planets in houses 2..6 (inside the arc).
    planets = {"Rahu": 1, "Ketu": 7, "Sun": 2, "Moon": 3, "Mars": 4,
               "Mercury": 5, "Jupiter": 6, "Venus": 2, "Saturn": 3}
    assert compute_doshas(chart(planets))["kala_sarpa"]["present"] is True

def test_kala_sarpa_absent_when_a_planet_breaks_the_arc():
    # Saturn at H9 sits outside both arcs of a Rahu(H1)-Ketu(H7) axis.
    planets = {"Rahu": 1, "Ketu": 7, "Sun": 2, "Moon": 3, "Mars": 4,
               "Mercury": 5, "Jupiter": 6, "Venus": 2, "Saturn": 9}
    assert compute_doshas(chart(planets))["kala_sarpa"]["present"] is False

def test_kala_sarpa_boundary_planet_on_the_axis_counts_as_inside():
    # A planet exactly on the Rahu house (the arc boundary) should not break the dosha.
    planets = {"Rahu": 1, "Ketu": 7, "Sun": 1, "Moon": 3, "Mars": 4,
               "Mercury": 5, "Jupiter": 6, "Venus": 2, "Saturn": 3}
    assert compute_doshas(chart(planets))["kala_sarpa"]["present"] is True

def test_manglik_cancelled_when_mars_in_own_sign():
    # Mars in a manglik house (H7) but in its own sign Aries -> cancelled.
    d = compute_doshas(chart({"Mars": 7}, signs={"Mars": "Aries"}))
    assert d["manglik"]["present"] is False
    assert d["manglik"]["cancelled"] is True

def test_manglik_present_in_manglik_house_without_cancellation():
    d = compute_doshas(chart({"Mars": 7}, signs={"Mars": "Gemini"}))
    assert d["manglik"]["present"] is True
