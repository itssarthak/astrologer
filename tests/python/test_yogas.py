import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from yogas import _context, compute_yogas, YOGA_RULES
from yogas import _mahapurusha_present


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
