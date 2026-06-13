import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from yogas import _context, compute_yogas, YOGA_RULES
from yogas import _mahapurusha_present
from yogas import (_gaja_kesari, _sunapha, _anapha, _durudhara, _kemadruma)


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
