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
from yogas import _neecha_bhanga, EXALTED_IN_SIGN
from yogas import _dhana
from yogas import _sankhya_count, _asraya, _dala, MOVABLE, FIXED, DUAL
from yogas import NATURAL_BENEFICS as NATURAL_BENEFICS_NAMES
from yogas import NATURAL_MALEFICS as NATURAL_MALEFICS_NAMES
from yogas import _classical_houses, _all_classical_in
from yogas import (_amala, _saraswati, _vasumati, _lagnadhi, _parvata,
                   _chamara, _kalanidhi, _kahala, _is_strong)


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


def test_registry_has_all_new_families():
    ids = {r["id"] for r in YOGA_RULES}
    assert {"raja_kendra_trikona", "viparita_harsha", "viparita_sarala",
            "viparita_vimala", "neecha_bhanga", "dhana_2_11"} <= ids
    nabhasa = {"nabhasa_vallaki", "nabhasa_damini", "nabhasa_pasa", "nabhasa_kedara",
               "nabhasa_soola", "nabhasa_yuga", "nabhasa_gola",
               "nabhasa_rajju", "nabhasa_musala", "nabhasa_nala",
               "nabhasa_mala", "nabhasa_sarpa"}
    assert nabhasa <= ids
    akriti = {"nabhasa_yupa", "nabhasa_ishu", "nabhasa_sakti", "nabhasa_danda",
              "nabhasa_nauka", "nabhasa_koota", "nabhasa_chatra", "nabhasa_chapa",
              "nabhasa_chakra", "nabhasa_samudra", "nabhasa_sakata", "nabhasa_vihaga",
              "nabhasa_sringataka", "nabhasa_kamala", "nabhasa_vapi",
              "nabhasa_gada", "nabhasa_hala", "nabhasa_ardha_chandra",
              "nabhasa_vajra", "nabhasa_yava"}
    assert akriti <= ids
    named = {"amala", "saraswati", "vasumati", "lagnadhi", "parvata",
             "chamara", "kalanidhi", "kahala"}
    assert named <= ids
    assert len(YOGA_RULES) == 65  # 37 prior + 20 Akriti + 8 named classical


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


def test_neecha_bhanga_via_dispositor_in_kendra_from_lagna():
    # Sun debilitated in Libra; dispositor of Libra is Venus; Venus in a kendra (H4) from lagna.
    ctx = _ctx({"Sun": {"house": 7, "sign": "Libra", "dignity": "debilitated"},
                "Venus": {"house": 4, "sign": "Cancer"}})
    assert _neecha_bhanga(ctx) is True


def test_neecha_bhanga_via_exaltation_lord_in_kendra():
    # Sun debilitated in Libra; the planet exalted in Libra is Saturn; Saturn in kendra (H10).
    ctx = _ctx({"Sun": {"house": 7, "sign": "Libra", "dignity": "debilitated"},
                "Venus": {"house": 3, "sign": "Gemini"},
                "Saturn": {"house": 10, "sign": "Capricorn"}})
    assert EXALTED_IN_SIGN["Libra"] == "Saturn"
    assert _neecha_bhanga(ctx) is True


def test_neecha_bhanga_absent_when_no_cancellation():
    # Sun debilitated in Libra; dispositor Venus and exalt-lord Saturn both in non-kendra, non-Moon-kendra houses.
    ctx = _ctx({"Sun": {"house": 7, "sign": "Libra", "dignity": "debilitated"},
                "Venus": {"house": 3, "sign": "Gemini"},
                "Saturn": {"house": 6, "sign": "Virgo"}})
    assert _neecha_bhanga(ctx) is False


def test_neecha_bhanga_absent_when_no_debilitated_planet():
    ctx = _ctx({"Sun": {"house": 1, "sign": "Aquarius", "dignity": "neutral"}})
    assert _neecha_bhanga(ctx) is False


def test_dhana_fires_when_2nd_and_11th_lords_associate():
    # 2nd lord (Jupiter) and 11th lord (Mars) conjoin in H1.
    ctx = _ctx({"Jupiter": {"house": 1}, "Mars": {"house": 1}},
               lords={2: "Jupiter", 11: "Mars"})
    assert _dhana(ctx) is True


def test_dhana_absent_when_no_association():
    ctx = _ctx({"Jupiter": {"house": 1}, "Mars": {"house": 6}},
               lords={2: "Jupiter", 11: "Mars"})
    assert _dhana(ctx) is False


def test_dhana_absent_when_same_lord():
    ctx = _ctx({"Jupiter": {"house": 1}}, lords={2: "Jupiter", 11: "Jupiter"})
    assert _dhana(ctx) is False


# --- Nabhasa: Sankhya (count of distinct signs the 7 classical planets occupy) ---

_SEVEN = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"]


def test_sankhya_yuga_two_signs():
    # Planets alternate between sign 0 and sign 1 -> exactly 2 distinct signs -> Yuga.
    ctx = _ctx({p: {"sign_idx": (0 if i % 2 == 0 else 1)} for i, p in enumerate(_SEVEN)})
    assert _sankhya_count(ctx) == 2


def test_sankhya_gola_one_sign():
    ctx = _ctx({p: {"sign_idx": 5} for p in _SEVEN})
    assert _sankhya_count(ctx) == 1


def test_sankhya_vallaki_seven_signs():
    ctx = _ctx({p: {"sign_idx": i} for i, p in enumerate(_SEVEN)})
    assert _sankhya_count(ctx) == 7


def test_sankhya_ignores_nodes_and_invalid_idx():
    # Rahu/Ketu and a planet with sign_idx -1 must not count.
    ctx = _ctx({"Sun": {"sign_idx": 0}, "Moon": {"sign_idx": 0},
                "Mars": {"sign_idx": -1}, "Rahu": {"sign_idx": 4}, "Ketu": {"sign_idx": 9}})
    assert _sankhya_count(ctx) == 1


def test_sankhya_yuga_via_compute(sarthak_chart):
    ctx = _ctx({p: {"sign_idx": (0 if i % 2 == 0 else 1), "house": 1} for i, p in enumerate(_SEVEN)})
    from yogas import YOGA_RULES as _RULES
    fired = {r["name"] for r in _RULES if r["category"].startswith("Nabhasa (Sankhya)") and r["detect"](ctx)}
    assert fired == {"Yuga"}


# --- Nabhasa: Asraya (all 7 classical planets in one modality) ---

def test_asraya_musala_all_fixed():
    # All seven in fixed signs (e.g. Taurus=1) -> Musala.
    ctx = _ctx({p: {"sign_idx": 1} for p in _SEVEN})
    assert _asraya(ctx, FIXED) is True
    assert _asraya(ctx, MOVABLE) is False
    assert _asraya(ctx, DUAL) is False


def test_asraya_rajju_all_movable():
    ctx = _ctx({p: {"sign_idx": 3} for p in _SEVEN})  # Cancer = movable
    assert _asraya(ctx, MOVABLE) is True


def test_asraya_false_when_no_planet():
    ctx = _ctx({})
    assert _asraya(ctx, FIXED) is False


def test_asraya_false_when_mixed():
    ctx = _ctx({"Sun": {"sign_idx": 1}, "Moon": {"sign_idx": 0}})  # fixed + movable
    assert _asraya(ctx, FIXED) is False


# --- Nabhasa: Dala (benefics/malefics in kendras) ---

def test_dala_mala_benefics_in_kendras():
    # Jupiter, Venus, Mercury, Moon each in a distinct kendra house -> Mala.
    ctx = _ctx({"Jupiter": {"house": 1}, "Venus": {"house": 4},
                "Mercury": {"house": 7}, "Moon": {"house": 10}})
    assert _dala(ctx, NATURAL_BENEFICS_NAMES) is True


def test_dala_mala_false_when_benefic_outside_kendra():
    ctx = _ctx({"Jupiter": {"house": 1}, "Venus": {"house": 4},
                "Mercury": {"house": 7}, "Moon": {"house": 3}})  # Moon not in kendra
    assert _dala(ctx, NATURAL_BENEFICS_NAMES) is False


def test_dala_mala_false_when_fewer_than_three_kendras():
    # Only two distinct kendra houses occupied.
    ctx = _ctx({"Jupiter": {"house": 1}, "Venus": {"house": 4}})
    assert _dala(ctx, NATURAL_BENEFICS_NAMES) is False


def test_dala_sarpa_malefics_in_kendras():
    ctx = _ctx({"Sun": {"house": 1}, "Mars": {"house": 4}, "Saturn": {"house": 7}})
    assert _dala(ctx, NATURAL_MALEFICS_NAMES) is True


def test_dala_false_when_no_planet():
    assert _dala(_ctx({}), NATURAL_BENEFICS_NAMES) is False


def test_dala_mala_via_compute():
    ctx = _ctx({"Jupiter": {"house": 1}, "Venus": {"house": 4},
                "Mercury": {"house": 7}, "Moon": {"house": 10}})
    fired = {r["name"] for r in YOGA_RULES if r["category"] == "Nabhasa (Dala)" and r["detect"](ctx)}
    assert fired == {"Maalaa"}


# --- Nabhasa: Akriti (shape by occupied houses, 7 classical planets only) ---

def _houses(mapping):
    """Build a ctx placing the 7 classical planets at the given houses (list, len 7)."""
    return _ctx({p: {"house": h} for p, h in zip(_SEVEN, mapping)})


def _akriti_fired(ctx):
    return {r["name"] for r in YOGA_RULES
            if r["category"] == "Nabhasa (Akriti)" and r["detect"](ctx)}


def test_classical_houses_helper():
    ctx = _houses([1, 1, 7, 7, 1, 7, 1])
    assert _classical_houses(ctx) == {1, 7}


def test_all_classical_in_helper():
    ctx = _houses([1, 7, 1, 7, 1, 7, 1])
    assert _all_classical_in(ctx, {1, 7}) is True
    assert _all_classical_in(ctx, {1, 4, 7, 10}) is True  # subset of kendras
    assert _all_classical_in(ctx, {1}) is False
    assert _all_classical_in(_ctx({}), {1, 7}) is False  # empty chart never fires


def test_akriti_sakata_all_in_1_and_7():
    ctx = _houses([1, 7, 1, 7, 1, 7, 1])
    assert "Sakata" in _akriti_fired(ctx)


def test_akriti_kamala_all_four_kendras():
    ctx = _houses([1, 4, 7, 10, 1, 4, 7])
    fired = _akriti_fired(ctx)
    assert "Kamala" in fired


def test_akriti_chakra_all_odd_houses():
    ctx = _houses([1, 3, 5, 7, 9, 11, 1])
    assert "Chakra" in _akriti_fired(ctx)


def test_akriti_samudra_all_even_houses():
    ctx = _houses([2, 4, 6, 8, 10, 12, 2])
    assert "Samudra" in _akriti_fired(ctx)


def test_akriti_vapi_no_kendra():
    ctx = _houses([2, 3, 5, 6, 8, 9, 11])
    fired = _akriti_fired(ctx)
    assert "Vapi" in fired
    # A planet in a kendra breaks Vapi.
    ctx2 = _houses([2, 3, 5, 6, 8, 9, 1])
    assert "Vapi" not in _akriti_fired(ctx2)


def test_akriti_yupa_first_four_houses():
    ctx = _houses([1, 2, 3, 4, 1, 2, 3])
    assert "Yupa" in _akriti_fired(ctx)


def test_akriti_sringataka_trikonas():
    ctx = _houses([1, 5, 9, 1, 5, 9, 1])
    assert "Sringataka" in _akriti_fired(ctx)


def test_akriti_vihaga_4_and_10():
    ctx = _houses([4, 10, 4, 10, 4, 10, 4])
    assert "Vihaga (Pakshi)" in _akriti_fired(ctx)


def test_akriti_gada_two_adjacent_kendras():
    # All in {1,4} -> Gada.
    ctx = _houses([1, 4, 1, 4, 1, 4, 1])
    assert "Gada" in _akriti_fired(ctx)
    # {1,7} are opposite kendras, not adjacent -> not Gada (but Sakata).
    ctx2 = _houses([1, 7, 1, 7, 1, 7, 1])
    assert "Gada" not in _akriti_fired(ctx2)


def test_akriti_hala_mutual_trine_not_from_lagna():
    # All in {2,6,10} -> Hala.
    ctx = _houses([2, 6, 10, 2, 6, 10, 2])
    assert "Hala" in _akriti_fired(ctx)
    # Trine from lagna {1,5,9} is Sringataka, NOT Hala.
    ctx2 = _houses([1, 5, 9, 1, 5, 9, 1])
    assert "Hala" not in _akriti_fired(ctx2)


def test_akriti_ardha_chandra_consecutive_not_starting_kendra():
    # 7 consecutive houses starting at H2 (not a kendra): {2,3,4,5,6,7,8}.
    ctx = _ctx({p: {"house": h} for p, h in zip(_SEVEN, [2, 3, 4, 5, 6, 7, 8])})
    assert "Ardha Chandra" in _akriti_fired(ctx)
    # 7 consecutive starting at a kendra (H1): {1..7} -> NOT Ardha Chandra.
    ctx2 = _ctx({p: {"house": h} for p, h in zip(_SEVEN, [1, 2, 3, 4, 5, 6, 7])})
    assert "Ardha Chandra" not in _akriti_fired(ctx2)


def test_akriti_vajra_benefics_1_7_malefics_4_10():
    # Benefics (Jup,Ven,Merc,Moon) in {1,7}; malefics (Sun,Mars,Sat) in {4,10}.
    ctx = _ctx({"Jupiter": {"house": 1}, "Venus": {"house": 7},
                "Mercury": {"house": 1}, "Moon": {"house": 7},
                "Sun": {"house": 4}, "Mars": {"house": 10}, "Saturn": {"house": 4}})
    assert "Vajra" in _akriti_fired(ctx)


def test_akriti_yava_malefics_1_7_benefics_4_10():
    ctx = _ctx({"Sun": {"house": 1}, "Mars": {"house": 7}, "Saturn": {"house": 1},
                "Jupiter": {"house": 4}, "Venus": {"house": 10},
                "Mercury": {"house": 4}, "Moon": {"house": 10}})
    assert "Yava" in _akriti_fired(ctx)


def test_akriti_all_false_on_empty_chart():
    assert _akriti_fired(_ctx({})) == set()


# --- Named classical yogas ---

def test_is_strong_helper():
    assert _is_strong({"dignity": "exalted"}) is True
    assert _is_strong({"dignity": "own"}) is True
    assert _is_strong({"dignity": "moolatrikona"}) is True
    assert _is_strong({"strength": "strong"}) is True
    assert _is_strong({"dignity": "neutral"}) is False
    assert _is_strong(None) is False


def test_amala_benefic_in_10th_from_lagna():
    ctx = _ctx({"Jupiter": {"house": 10}})
    assert _amala(ctx) is True


def test_amala_benefic_in_10th_from_moon():
    # Moon H3 -> 10th from Moon is H12. Venus at H12.
    ctx = _ctx({"Moon": {"house": 3}, "Venus": {"house": 12}})
    assert _amala(ctx) is True


def test_amala_absent_when_no_benefic_in_10th():
    ctx = _ctx({"Jupiter": {"house": 5}, "Moon": {"house": 1}})
    assert _amala(ctx) is False


def test_amala_absent_on_empty_chart():
    assert _amala(_ctx({})) is False


def test_saraswati_fires_three_benefics_in_good_houses_strong_jupiter():
    ctx = _ctx({"Mercury": {"house": 1}, "Jupiter": {"house": 5, "dignity": "exalted"},
                "Venus": {"house": 9}})
    assert _saraswati(ctx) is True


def test_saraswati_absent_when_jupiter_weak():
    ctx = _ctx({"Mercury": {"house": 1}, "Jupiter": {"house": 5, "dignity": "neutral"},
                "Venus": {"house": 9}})
    assert _saraswati(ctx) is False


def test_saraswati_absent_when_planet_in_bad_house():
    ctx = _ctx({"Mercury": {"house": 3}, "Jupiter": {"house": 5, "dignity": "exalted"},
                "Venus": {"house": 9}})
    assert _saraswati(ctx) is False


def test_saraswati_absent_when_planet_missing():
    ctx = _ctx({"Mercury": {"house": 1}, "Jupiter": {"house": 5, "dignity": "exalted"}})
    assert _saraswati(ctx) is False


def test_vasumati_two_benefics_in_upachaya():
    ctx = _ctx({"Mercury": {"house": 3}, "Jupiter": {"house": 11}})
    assert _vasumati(ctx) is True


def test_vasumati_absent_when_only_one_in_upachaya():
    ctx = _ctx({"Mercury": {"house": 3}, "Jupiter": {"house": 5}})
    assert _vasumati(ctx) is False


def test_lagnadhi_two_benefics_in_6_7_8():
    ctx = _ctx({"Mercury": {"house": 6}, "Jupiter": {"house": 7}})
    assert _lagnadhi(ctx) is True


def test_lagnadhi_absent_when_only_one():
    ctx = _ctx({"Mercury": {"house": 6}, "Jupiter": {"house": 2}})
    assert _lagnadhi(ctx) is False


def test_parvata_benefic_in_kendra_no_malefic_in_6_8():
    ctx = _ctx({"Jupiter": {"house": 1}, "Saturn": {"house": 3}})
    assert _parvata(ctx) is True


def test_parvata_absent_when_malefic_in_6():
    ctx = _ctx({"Jupiter": {"house": 1}, "Mars": {"house": 6}})
    assert _parvata(ctx) is False


def test_parvata_absent_when_no_benefic_in_kendra():
    ctx = _ctx({"Jupiter": {"house": 3}})
    assert _parvata(ctx) is False


def test_chamara_lagna_lord_exalted_kendra_aspected_by_jupiter():
    ctx = _ctx({"Saturn": {"house": 4, "dignity": "exalted"}, "Jupiter": {"house": 8}},
               lords={1: "Saturn"})
    ctx["planets"]["Saturn"]["aspects_receives"] = [{"from_planet": "Jupiter"}]
    assert _chamara(ctx) is True


def test_chamara_absent_when_not_aspected():
    ctx = _ctx({"Saturn": {"house": 4, "dignity": "exalted"}, "Jupiter": {"house": 8}},
               lords={1: "Saturn"})
    assert _chamara(ctx) is False


def test_chamara_absent_when_not_exalted():
    ctx = _ctx({"Saturn": {"house": 4, "dignity": "own"}, "Jupiter": {"house": 8}},
               lords={1: "Saturn"})
    ctx["planets"]["Saturn"]["aspects_receives"] = [{"from_planet": "Jupiter"}]
    assert _chamara(ctx) is False


def test_kalanidhi_jupiter_in_5th_conjunct_mercury_venus():
    ctx = _ctx({"Jupiter": {"house": 5}, "Mercury": {"house": 5}, "Venus": {"house": 5}})
    assert _kalanidhi(ctx) is True


def test_kalanidhi_via_aspect():
    ctx = _ctx({"Jupiter": {"house": 2}, "Mercury": {"house": 8}, "Venus": {"house": 6}})
    ctx["planets"]["Jupiter"]["aspects_receives"] = [
        {"from_planet": "Mercury"}, {"from_planet": "Venus"}]
    assert _kalanidhi(ctx) is True


def test_kalanidhi_absent_when_jupiter_in_wrong_house():
    ctx = _ctx({"Jupiter": {"house": 3}, "Mercury": {"house": 3}, "Venus": {"house": 3}})
    assert _kalanidhi(ctx) is False


def test_kalanidhi_absent_when_only_one_associates():
    ctx = _ctx({"Jupiter": {"house": 5}, "Mercury": {"house": 5}, "Venus": {"house": 8}})
    assert _kalanidhi(ctx) is False


def test_kahala_4th_9th_lords_mutual_kendra_strong_lagna_lord():
    # l4=Venus H1, l9=Jupiter H4 (house_distance 1->4 = 4, a kendra). l1=Saturn strong.
    ctx = _ctx({"Venus": {"house": 1}, "Jupiter": {"house": 4},
                "Saturn": {"house": 7, "dignity": "own"}},
               lords={1: "Saturn", 4: "Venus", 9: "Jupiter"})
    assert _kahala(ctx) is True


def test_kahala_absent_when_not_mutual_kendra():
    ctx = _ctx({"Venus": {"house": 1}, "Jupiter": {"house": 3},
                "Saturn": {"house": 7, "dignity": "own"}},
               lords={1: "Saturn", 4: "Venus", 9: "Jupiter"})
    assert _kahala(ctx) is False


def test_kahala_absent_when_lagna_lord_weak():
    ctx = _ctx({"Venus": {"house": 1}, "Jupiter": {"house": 4},
                "Saturn": {"house": 7, "dignity": "neutral"}},
               lords={1: "Saturn", 4: "Venus", 9: "Jupiter"})
    assert _kahala(ctx) is False


def test_kahala_absent_when_same_lord():
    ctx = _ctx({"Venus": {"house": 1}, "Saturn": {"house": 4, "dignity": "own"}},
               lords={1: "Saturn", 4: "Venus", 9: "Venus"})
    assert _kahala(ctx) is False


def test_named_yogas_guard_missing_lords():
    # No lords map -> lord-based rules return False, not KeyError.
    empty = _ctx({})
    assert _chamara(empty) is False
    assert _kahala(empty) is False
