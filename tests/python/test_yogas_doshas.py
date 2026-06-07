import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from chart import compute_chart
from yogas import compute_yogas
from doshas import compute_doshas

SARTHAK = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")

def test_yogas_returns_list():
    result = compute_yogas(SARTHAK)
    assert isinstance(result, list)

def test_yogas_each_has_name_and_category():
    for y in compute_yogas(SARTHAK):
        assert "name" in y
        assert "category" in y

def test_doshas_returns_dict():
    result = compute_doshas(SARTHAK)
    assert isinstance(result, dict)

def test_doshas_manglik_has_required_keys():
    result = compute_doshas(SARTHAK)
    assert "manglik" in result
    m = result["manglik"]
    assert "present" in m
    assert "text" in m
    assert isinstance(m["present"], bool)

def test_doshas_kala_sarpa_present():
    result = compute_doshas(SARTHAK)
    assert "kala_sarpa" in result
    assert isinstance(result["kala_sarpa"]["present"], bool)
