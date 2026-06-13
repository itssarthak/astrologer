import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from yogas import _context, compute_yogas, YOGA_RULES
from yogas import _mahapurusha_present
from yogas import (_gaja_kesari, _sunapha, _anapha, _durudhara, _kemadruma)
from yogas import (_budha_aditya, _vesi, _vasi, _ubhayachari)
from yogas import (_chandra_mangal, _adhi, _kesari, _lakshmi, _dharma_karmadhipati)
from yogas import _aspects, _parivartana, _associated, OWNED_SIGNS
from yogas import _raja_kendra_trikona
from yogas import _viparita


def test_context_shape(sarthak_chart):
    ctx = _context(sarthak_chart)
    assert set(ctx.keys()) >= {"planets", "lords", "lagna_idx"}
    assert ctx["lagna_idx"] == 10  # Aquarius
    assert ctx["planets"]["Saturn"]["house"] >= 1
    assert ctx["lords"][1] == "Saturn"


def test_registry_entries_well_formed():
    assert len(YOGA_RULES) >= 1
    for r in YOGA_RULES:
        assert set(r.keys()) >= {"id", "name", "category", "description", "detect"}
        assert callable(r["detect"])


def test_compute_yogas_returns_named_list(sarthak_chart):
    result = compute_yogas(sarthak_chart)
    assert isinstance(result, list)
    for y in result:
        assert "name" in y and "category" in y and "description" in y


def _ctx(planets, lords=None, lagna_idx=10):
    """Build a minimal synthetic context for rule unit tests."""
    full = {}
    for name, p in planets.items():
        full[name] = {"house": p.get("house", 1), "sign": p.get("sign", "Aries"),
                      "sign_idx": p.get("sign_idx", 0), "dignity": p.get("dignity", "neutral"),
                      "is_strong": p.get("is_strong", False), "retrograde": p.get("retrograde", False),
                      "conjuncts": p.get("conjuncts", []),
                      "aspects_gives": p.get("aspects_gives", []),
                      "aspects_receives": p.get("aspects_receives", [])}
    return {"planets": full, "lords": lords or {}, "lagna_idx": lagna_idx}


def test_mahapurusha_fires_for_own_sign_in_kendra():
    # Mars in own sign, in a kendra (H10) -> Ruchaka.
    ctx = _ctx({"Mars": {"house": 10, "dignity": "own"}})
    assert _mahapurusha_present(ctx, "Mars") is True


def test_mahapurusha_absent_when_not_in_kendra():
    ctx = _ctx({"Mars": {"house": 3, "dignity": "own"}})
    assert _mahapurusha_present(ctx, "Mars") is False


def test_mahapurusha_absent_when_neutral_dignity():
    ctx = _ctx({"Jupiter": {"house": 1, "dignity": "neutral"}})
    assert _mahapurusha_present(ctx, "Jupiter") is False


# Helpers: place planets by house. Moon at H1 means 2nd-from-Moon = H2, 12th-from-Moon = H12.

def test_gaja_kesari_fires_jupiter_kendra_from_moon():
    # Moon H1, Jupiter H4 (a kendra from Moon), Jupiter not debilitated.
    ctx = _ctx({"Moon": {"house": 1}, "Jupiter": {"house": 4, "dignity": "own"}})
    assert _gaja_kesari(ctx) is True


def test_gaja_kesari_absent_when_jupiter_debilitated():
    ctx = _ctx({"Moon": {"house": 1}, "Jupiter": {"house": 4, "dignity": "debilitated"}})
    assert _gaja_kesari(ctx) is False


def test_sunapha_fires_planet_2nd_from_moon():
    # Moon H5, planet (Mars) in H6 = 2nd from Moon. Sun/nodes excluded.
    ctx = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}})
    assert _sunapha(ctx) is True


def test_sunapha_ignores_sun_and_nodes():
    ctx = _ctx({"Moon": {"house": 5}, "Sun": {"house": 6}, "Rahu": {"house": 6}})
    assert _sunapha(ctx) is False


def test_anapha_fires_planet_12th_from_moon():
    # Moon H5, planet in H4 = 12th from Moon.
    ctx = _ctx({"Moon": {"house": 5}, "Venus": {"house": 4}})
    assert _anapha(ctx) is True


def test_durudhara_requires_both_2nd_and_12th():
    ctx = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}, "Venus": {"house": 4}})
    assert _durudhara(ctx) is True
    ctx2 = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}})
    assert _durudhara(ctx2) is False


def test_kemadruma_fires_when_moon_isolated():
    # Moon H5, NOTHING in 2nd(H6)/12th(H4) from Moon (Sun/Moon allowed there), and no
    # non-Moon planet in kendras from lagna (lagna_idx default 10 -> kendras H1/4/7/10).
    ctx = _ctx({"Moon": {"house": 5}})
    assert _kemadruma(ctx) is True


def test_kemadruma_absent_when_planet_flanks_moon():
    ctx = _ctx({"Moon": {"house": 5}, "Mars": {"house": 6}})
    assert _kemadruma(ctx) is False


def test_budha_aditya_fires_sun_mercury_same_house():
    ctx = _ctx({"Sun": {"house": 3}, "Mercury": {"house": 3}})
    assert _budha_aditya(ctx) is True
    ctx2 = _ctx({"Sun": {"house": 3}, "Mercury": {"house": 5}})
    assert _budha_aditya(ctx2) is False


def test_vesi_fires_planet_2nd_from_sun():
    # Sun H1, planet (Jupiter) in H2 = 2nd from Sun. Moon/nodes excluded.
    ctx = _ctx({"Sun": {"house": 1}, "Jupiter": {"house": 2}})
    assert _vesi(ctx) is True


def test_vasi_fires_planet_12th_from_sun():
    ctx = _ctx({"Sun": {"house": 5}, "Saturn": {"house": 4}})
    assert _vasi(ctx) is True


def test_ubhayachari_requires_both_sides_of_sun():
    ctx = _ctx({"Sun": {"house": 5}, "Jupiter": {"house": 6}, "Saturn": {"house": 4}})
    assert _ubhayachari(ctx) is True
    ctx2 = _ctx({"Sun": {"house": 5}, "Jupiter": {"house": 6}})
    assert _ubhayachari(ctx2) is False


def test_chandra_mangal_fires_moon_mars_conjunct():
    ctx = _ctx({"Moon": {"house": 7}, "Mars": {"house": 7}})
    assert _chandra_mangal(ctx) is True
    assert _chandra_mangal(_ctx({"Moon": {"house": 7}, "Mars": {"house": 8}})) is False


def test_adhi_fires_two_benefics_6_7_8_from_moon():
    # Moon H1 -> 6th=H6, 7th=H7, 8th=H8. Mercury H6, Jupiter H7 -> two benefics.
    ctx = _ctx({"Moon": {"house": 1}, "Mercury": {"house": 6}, "Jupiter": {"house": 7}})
    assert _adhi(ctx) is True
    assert _adhi(_ctx({"Moon": {"house": 1}, "Mercury": {"house": 6}})) is False  # only one


def test_kesari_fires_strong_jupiter_in_lagna_kendra():
    # lagna_idx 10 (Aquarius) -> kendras H1/4/7/10. Jupiter strong in H1.
    ctx = _ctx({"Jupiter": {"house": 1, "dignity": "own", "is_strong": True}})
    assert _kesari(ctx) is True
    assert _kesari(_ctx({"Jupiter": {"house": 3, "dignity": "own", "is_strong": True}})) is False


def test_lakshmi_fires_strong_venus_and_strong_9th_lord_in_trikona():
    # 9th lord = Venus per lords map; Venus strong, in a trikona (H9).
    ctx = _ctx({"Venus": {"house": 9, "dignity": "exalted", "is_strong": True}},
               lords={9: "Venus"})
    assert _lakshmi(ctx) is True


def test_dharma_karmadhipati_fires_9th_10th_lords_conjunct():
    ctx = _ctx({"Jupiter": {"house": 5}, "Mars": {"house": 5}},
               lords={9: "Jupiter", 10: "Mars"})
    assert _dharma_karmadhipati(ctx) is True
    ctx2 = _ctx({"Jupiter": {"house": 5}, "Mars": {"house": 8}},
                lords={9: "Jupiter", 10: "Mars"})
    assert _dharma_karmadhipati(ctx2) is False


def test_kemadruma_broken_by_planet_in_kendra():
    # Moon isolated (H5, nothing in 2nd/12th from it), BUT Jupiter sits in a kendra (H1)
    # from the lagna -> Kemadruma must NOT fire.
    ctx = _ctx({"Moon": {"house": 5}, "Jupiter": {"house": 1}})
    assert _kemadruma(ctx) is False


def test_compute_yogas_on_real_chart_is_wellformed(sarthak_chart):
    result = compute_yogas(sarthak_chart)
    # Every active yoga carries a non-empty name, category and description.
    for y in result:
        assert y["name"] and y["category"] and y["description"]
    # Names are unique (no rule fires twice).
    names = [y["name"] for y in result]
    assert len(names) == len(set(names))


def test_compute_yogas_json_roundtrips(sarthak_chart):
    import json as _json
    from yogas import compute_yogas_json
    parsed = _json.loads(compute_yogas_json(_json.dumps(sarthak_chart)))
    assert isinstance(parsed, list)


def test_owned_signs_map():
    assert set(OWNED_SIGNS["Mars"]) == {"Aries", "Scorpio"}
    assert OWNED_SIGNS["Sun"] == ["Leo"]


def test_aspects_reads_receives():
    # B (Mars) records that it receives an aspect from A (Saturn).
    ctx = _ctx({"Saturn": {"house": 1}, "Mars": {"house": 7}})
    ctx["planets"]["Mars"]["aspects_receives"] = [{"from_planet": "Saturn", "aspect_type": "7"}]
    assert _aspects(ctx, "Saturn", "Mars") is True
    assert _aspects(ctx, "Mars", "Saturn") is False


def test_parivartana_detects_sign_exchange():
    # Mars in Venus's sign (Libra) and Venus in Mars's sign (Aries) -> exchange.
    ctx = _ctx({"Mars": {"house": 1, "sign": "Libra"}, "Venus": {"house": 7, "sign": "Aries"}})
    assert _parivartana(ctx, "Mars", "Venus") is True
    ctx2 = _ctx({"Mars": {"house": 1, "sign": "Libra"}, "Venus": {"house": 7, "sign": "Taurus"}})
    assert _parivartana(ctx2, "Mars", "Venus") is False


def test_associated_conjunction_aspect_exchange():
    # Conjunction (same house)
    ctx = _ctx({"Mars": {"house": 5}, "Venus": {"house": 5}})
    assert _associated(ctx, "Mars", "Venus") is True
    # Mutual aspect
    ctx2 = _ctx({"Mars": {"house": 1}, "Venus": {"house": 7}})
    ctx2["planets"]["Mars"]["aspects_receives"] = [{"from_planet": "Venus"}]
    ctx2["planets"]["Venus"]["aspects_receives"] = [{"from_planet": "Mars"}]
    assert _associated(ctx2, "Mars", "Venus") is True
    # One-sided aspect only -> not associated
    ctx3 = _ctx({"Mars": {"house": 1}, "Venus": {"house": 7}})
    ctx3["planets"]["Mars"]["aspects_receives"] = [{"from_planet": "Venus"}]
    assert _associated(ctx3, "Mars", "Venus") is False
    # Same planet -> never self-associated
    assert _associated(ctx, "Mars", "Mars") is False


def test_raja_fires_when_kendra_and_trikona_lords_conjoin():
    # lords: 10 (kendra) = Mars, 9 (trikona) = Jupiter; both in H5 -> conjunction.
    ctx = _ctx({"Mars": {"house": 5}, "Jupiter": {"house": 5}},
               lords={1: "Saturn", 4: "Venus", 7: "Sun", 10: "Mars",
                      5: "Mercury", 9: "Jupiter"})
    assert _raja_kendra_trikona(ctx) is True


def test_raja_absent_when_no_association():
    ctx = _ctx({"Mars": {"house": 5}, "Jupiter": {"house": 8}},
               lords={1: "Saturn", 4: "Venus", 7: "Sun", 10: "Mars",
                      5: "Mercury", 9: "Jupiter"})
    assert _raja_kendra_trikona(ctx) is False


def test_raja_ignores_shared_lord_pair():
    # If the only kendra/trikona lord overlap is the same planet (lagna lord), no yoga from self-pair.
    ctx = _ctx({"Saturn": {"house": 1}},
               lords={1: "Saturn", 4: "Saturn", 7: "Saturn", 10: "Saturn",
                      5: "Saturn", 9: "Saturn"})
    assert _raja_kendra_trikona(ctx) is False


def test_viparita_harsha_6th_lord_in_dusthana():
    # 6th lord (Mars) sits in a dusthana (H8) -> Harsha.
    ctx = _ctx({"Mars": {"house": 8}}, lords={6: "Mars"})
    assert _viparita(ctx, 6) is True


def test_viparita_absent_when_lord_in_good_house():
    ctx = _ctx({"Mars": {"house": 10}}, lords={6: "Mars"})
    assert _viparita(ctx, 6) is False


def test_viparita_sarala_and_vimala():
    # 8th lord in H12 -> Sarala; 12th lord in H6 -> Vimala.
    ctx = _ctx({"Saturn": {"house": 12}, "Jupiter": {"house": 6}},
               lords={8: "Saturn", 12: "Jupiter"})
    assert _viparita(ctx, 8) is True
    assert _viparita(ctx, 12) is True
