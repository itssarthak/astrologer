# tests/python/test_adapter.py
import json as _json
from adapter import planet_facts, lagna_sign, house_lords, current_dasha_chain, divisional_positions, chart_facts, chart_facts_json


def test_planet_facts_has_core_fields(sarthak_chart):
    facts = planet_facts(sarthak_chart)
    assert "Saturn" in facts
    s = facts["Saturn"]
    for key in ("sign", "sign_idx", "house", "sign_degrees", "nakshatra", "pada",
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


def test_lagna_sign(sarthak_chart):
    assert lagna_sign(sarthak_chart) == "Aquarius"  # known Aquarius lagna


def test_house_lords(sarthak_chart):
    lords = house_lords(sarthak_chart)
    assert len(lords) == 12
    assert lords[1] == "Saturn"   # Aquarius (H1) -> Saturn
    assert lords[5] == "Mercury"  # Gemini (5th from Aquarius) -> Mercury


def test_dasha_chain_for_known_date(sarthak_chart):
    # 1996-03-10 falls in the birth Ketu mahadasha / Ketu antardasha.
    # (natal dasha balance begins before physical birth — standard Vimshottari)
    chain = current_dasha_chain(sarthak_chart, ref_date="1996-03-10")
    assert chain["maha"] == "Ketu"
    assert chain["antar"] == "Ketu"
    assert chain["pratyantar"] is not None


def test_dasha_chain_keys(sarthak_chart):
    chain = current_dasha_chain(sarthak_chart, ref_date="2003-01-01")
    assert set(chain.keys()) == {"maha", "antar", "pratyantar"}
    assert chain["maha"] in {"Ketu", "Venus"}  # near the Ketu->Venus boundary (2003-03-08)


def test_divisional_d9(sarthak_chart):
    d9 = divisional_positions(sarthak_chart, "d9")
    assert d9["varga"] == "d9"
    assert d9["ascendant"]  # navamsa lagna sign present
    # Every classical planet should be placed somewhere in the varga.
    placed = {p["planet"] for p in d9["placements"]}
    assert {"Sun", "Moon", "Saturn"}.issubset(placed)
    for p in d9["placements"]:
        assert set(p.keys()) >= {"planet", "sign", "house"}


def test_divisional_unknown_returns_error(sarthak_chart):
    res = divisional_positions(sarthak_chart, "d99")
    assert "error" in res


def test_chart_facts_aggregates(sarthak_chart):
    cf = chart_facts(sarthak_chart, ref_date="2020-01-01")
    assert cf["lagna"] == "Aquarius"
    assert cf["planets"]["Saturn"]["sign"]
    assert cf["planets"]["Saturn"]["strength"] in {"strong", "adequate", "weak", "unknown"}
    assert set(cf["dasha"].keys()) == {"maha", "antar", "pratyantar"}
    assert cf["lords"][1] == "Saturn"


def test_chart_facts_json_roundtrips(sarthak_chart):
    s = chart_facts_json(_json.dumps(sarthak_chart), "2020-01-01")
    parsed = _json.loads(s)
    assert parsed["lagna"] == "Aquarius"


def test_dasha_chain_before_first_period_clamps_to_first(sarthak_chart):
    # ref before the chart's earliest mahadasha should clamp to the first period,
    # not silently return the last one.
    chain = current_dasha_chain(sarthak_chart, ref_date="1990-01-01")
    assert chain["maha"] == "Ketu"  # Ketu is the earliest (balance-at-birth) mahadasha


def test_dignity_normalized_to_canonical(sarthak_chart):
    from adapter import planet_facts
    pf = planet_facts(sarthak_chart)
    # jyotishganit raw vocabulary must never leak through the adapter.
    for name, f in pf.items():
        assert f["dignity"] not in ("own_sign", "deep_exaltation", "deep_debilitation"), \
            f"{name} leaked raw dignity {f['dignity']!r}"
        assert f["dignity"] in ("exalted", "debilitated", "moolatrikona", "own", "neutral")
    # Sarthak's Jupiter is in its own sign (Sagittarius) -> must normalize to 'own'.
    assert pf["Jupiter"]["dignity"] == "own"


def test_tanya_moon_nakshatra_smoke(tanya_chart):
    # Parity smoke anchor from the WhatsApp astro skill (DOB 11 Jul 1998 19:10 IST, Agra).
    facts = planet_facts(tanya_chart)
    assert facts["Moon"]["nakshatra"] == "Shravana"
