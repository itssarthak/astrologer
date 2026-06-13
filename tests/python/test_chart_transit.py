import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
import json
from chart import compute_chart
from transit import compute_transit

def test_chart_returns_expected_lagna():
    # Sarthak's known chart: Aquarius lagna
    result = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    houses = result["d1Chart"]["houses"]
    lagna_sign = houses[0]["sign"]
    assert lagna_sign == "Aquarius", f"Expected Aquarius lagna, got {lagna_sign}"

def test_chart_includes_divisional_charts():
    result = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")
    assert "divisionalCharts" in result
    # jyotishganit uses lowercase keys: "d9" not "D9"
    assert "d9" in result["divisionalCharts"], (
        f"Expected 'd9' key; got keys: {list(result['divisionalCharts'].keys())}"
    )

def test_transit_unknown_lagna_returns_error_not_exception():
    # An unexpected/missing lagna must yield a structured error, not raise ValueError.
    result = compute_transit("NotASign", 28.6139, 77.2090, 5.5)
    assert "error" in result
    assert "NotASign" in result["error"]

def test_transit_returns_12_planets():
    result = compute_transit("Aquarius", 28.6139, 77.2090, 5.5)
    assert len(result["planets"]) >= 9  # Sun through Ketu minimum
    assert "panchanga" in result
    assert "date" in result

def test_transit_natal_house_in_range():
    result = compute_transit("Aquarius", 28.6139, 77.2090, 5.5)
    for p in result["planets"]:
        assert 1 <= p["natal_house"] <= 12, f"House {p['natal_house']} out of range for {p['planet']}"

def test_transit_on_arbitrary_date():
    # An explicit on_date casts the transit chart for that date (noon midpoint),
    # not "now". The returned date echoes the requested date.
    result = compute_transit("Aquarius", 28.6139, 77.2090, 5.5, on_date="2030-01-01")
    assert result["date"] == "2030-01-01"
    assert len(result["planets"]) >= 9
