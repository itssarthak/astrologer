import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from datetime import datetime
from chart import compute_chart
from varshaphal import (
    compute_varshaphal, _sun_longitude, _signed_diff, _cast,
    SIGNS, VIM_ORDER, VIM_YEARS, SIDEREAL_YEAR_DAYS,
)

NATAL = compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")


def _varshaphal_2026():
    return compute_varshaphal(NATAL, 2026, 28.6139, 77.2090, 5.5, 1996, 11, 22, 13, 6)


def test_no_error():
    result = _varshaphal_2026()
    assert "error" not in result, result.get("error")


def test_solar_return_near_birthday_and_sun_at_natal_longitude():
    result = _varshaphal_2026()
    sr = result["solar_return"]
    sr_dt = datetime.strptime(sr["date"] + " " + sr["time"], "%Y-%m-%d %H:%M")
    # Solar return falls within a few days of the birthday (Nov 22) in target year.
    assert sr_dt.year == 2026
    assert abs((sr_dt - datetime(2026, 11, 22)).days) <= 4

    # Re-cast at the returned moment: Sun must be back at the natal sidereal longitude.
    natal_sun = _sun_longitude(NATAL)
    varsha = _cast(sr_dt, 28.6139, 77.2090, 5.5)
    assert abs(_signed_diff(natal_sun, _sun_longitude(varsha))) < 0.01

    # And the Sun's sign in the placements matches the natal Sun's sign (Scorpio).
    natal_sun_sign = SIGNS[int(natal_sun // 30)]
    assert natal_sun_sign == "Scorpio"
    sun_place = next(p for p in result["placements"] if p["planet"] == "Sun")
    assert sun_place["sign"] == "Scorpio"
    # Each placement also carries its dignity in the varsha chart.
    assert "dignity" in sun_place
    assert isinstance(sun_place["dignity"], str)


def test_muntha_and_lagna_lord():
    result = _varshaphal_2026()
    muntha = result["muntha"]
    assert muntha["sign"] in SIGNS
    assert 1 <= muntha["house"] <= 12
    assert muntha["lord"] in VIM_ORDER or muntha["lord"] in (
        "Mars", "Venus", "Mercury", "Moon", "Sun", "Jupiter", "Saturn")
    assert result["varsha_lagna"] in SIGNS
    assert result["varsha_lagna_lord"] in (
        "Mars", "Venus", "Mercury", "Moon", "Sun", "Jupiter", "Saturn")
    # age = 2026 - 1996 = 30
    assert result["age"] == 30


def test_mudda_dasha_sequence():
    result = _varshaphal_2026()
    mudda = result["mudda_dasha"]
    assert len(mudda) == 9
    # First period starts on the solar-return date.
    assert mudda[0]["start"] == result["solar_return"]["date"]
    # The nine lords are exactly the full Vimshottari set.
    lords = [p["lord"] for p in mudda]
    assert set(lords) == set(VIM_ORDER)
    # Periods follow Vimshottari order from the start lord.
    start_i = VIM_ORDER.index(lords[0])
    expected = [VIM_ORDER[(start_i + k) % 9] for k in range(9)]
    assert lords == expected
    # Each period's end is the next period's start (contiguous).
    for a, b in zip(mudda, mudda[1:]):
        assert a["end"] == b["start"]


def test_mudda_dasha_total_span_is_one_year():
    result = _varshaphal_2026()
    mudda = result["mudda_dasha"]
    start = datetime.strptime(mudda[0]["start"], "%Y-%m-%d")
    end = datetime.strptime(mudda[-1]["end"], "%Y-%m-%d")
    total_days = (end - start).days
    assert abs(total_days - SIDEREAL_YEAR_DAYS) <= 2
