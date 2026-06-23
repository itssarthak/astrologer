"""Golden tests for the four Ashtakoota kootas that were rebuilt from sourced classical rules:
Varna, Graha Maitri, Gana, Bhakoot. Values come from the standard (BV Raman / BPHS) Ashtakoota
definitions confirmed against published methodology, NOT from the prior (buggy) lookup tables.

Sources for the rules encoded here:
- Gana 9/9/9 classification + Bhakoot dosha at 2/12, 5/9, 6/8 + Varna by moon sign:
  jagannathhora.com/ashtakoot-guna-milan-complete-guide, rashidarshan.com Ashtakoot guide.
- Graha Maitri sign-lord friendship scoring 5/4/3/1/0.5/0: same sources + BV Raman.
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from synastry import compute_guna_milan, NAK_GANA


def _k(nak_a, nak_b, sign_a, sign_b, gender_a="male", gender_b="female"):
    return compute_guna_milan(nak_a, gender_a, nak_b, gender_b, sign_a, sign_b)["breakdown"]


# ---------------- Bhakoot (rashi count: 2/12, 5/9, 6/8 are dosha -> 0; else 7) ----------------

def bhakoot(sign_a, sign_b):
    # Bhakoot is symmetric; nakshatra is irrelevant to it, so any nak works.
    return _k("Ashwini", "Ashwini", sign_a, sign_b)["bhakoot"]["score"]

def test_bhakoot_6_8_is_dosha():
    assert bhakoot("Aries", "Scorpio") == 0      # 6/8 (Shadashtak)

def test_bhakoot_2_12_is_dosha():
    assert bhakoot("Pisces", "Aquarius") == 0    # 2/12 (Dwirdwadash)

def test_bhakoot_5_9_is_dosha():
    assert bhakoot("Taurus", "Virgo") == 0       # 5/9 (Nav-Pancham)

def test_bhakoot_same_sign_is_full():
    assert bhakoot("Aries", "Aries") == 7        # 1/1

def test_bhakoot_opposite_sign_is_full():
    assert bhakoot("Aries", "Libra") == 7        # 1/7

def test_bhakoot_3_11_is_full():
    assert bhakoot("Aries", "Gemini") == 7       # 3/11

def test_bhakoot_is_symmetric():
    assert bhakoot("Scorpio", "Aries") == bhakoot("Aries", "Scorpio")


# ---------------- Gana (standard 9/9/9 classification) ----------------

def test_gana_table_is_nine_each():
    from collections import Counter
    assert dict(Counter(NAK_GANA)) == {0: 9, 1: 9, 2: 9}   # Deva / Manushya / Rakshasa

def test_gana_classification_anchors():
    # 0=Deva, 1=Manushya, 2=Rakshasa, indexed Ashwini..Revati.
    expected = {"Ashwini": 0, "Bharani": 1, "Krittika": 2, "Rohini": 1, "Ashlesha": 2,
                "Magha": 2, "Chitra": 2, "Vishakha": 2, "Moola": 2, "Dhanishtha": 2,
                "Shatabhisha": 2, "Revati": 0, "Swati": 0}
    from synastry import NAKSHATRA_INDEX
    for n, g in expected.items():
        assert NAK_GANA[NAKSHATRA_INDEX[n]] == g, n

def test_gana_same_deva_is_full():
    # Two Deva-gana nakshatras -> 6.
    assert _k("Ashwini", "Mrigashira", "Aries", "Taurus")["gana"]["score"] == 6


# ---------------- Varna (by moon sign: Brahmin>Kshatriya>Vaishya>Shudra; groom >= bride -> 1) ----

def varna(groom_sign, bride_sign):
    return _k("Ashwini", "Ashwini", groom_sign, bride_sign, "male", "female")["varna"]["score"]

def test_varna_groom_higher_scores_one():
    # Cancer = Brahmin (highest), Gemini = Shudra (lowest); groom higher -> 1.
    assert varna("Cancer", "Gemini") == 1

def test_varna_groom_lower_scores_zero():
    assert varna("Gemini", "Cancer") == 0

def test_varna_equal_scores_one():
    # Aries and Leo are both Kshatriya.
    assert varna("Aries", "Leo") == 1


# ---------------- Graha Maitri (moon-sign lords' friendship, 5/4/3/1/0.5/0) ----------------

def graha(sign_a, sign_b):
    return _k("Ashwini", "Ashwini", sign_a, sign_b)["graha_maitri"]["score"]

def test_graha_same_lord_is_five():
    # Aries and Scorpio are both ruled by Mars.
    assert graha("Aries", "Scorpio") == 5

def test_graha_mutual_friends_is_five():
    # Cancer (Moon) & Leo (Sun): Sun and Moon are mutual friends.
    assert graha("Cancer", "Leo") == 5

def test_graha_mutual_enemies_is_zero():
    # Leo (Sun) & Libra (Venus): Sun<->Venus mutual enemies.
    assert graha("Leo", "Libra") == 0

def test_graha_mutual_neutral_is_three():
    # Aries (Mars) & Taurus (Venus): Mars<->Venus neutral both ways.
    assert graha("Aries", "Taurus") == 3

def test_graha_friend_neutral_is_four():
    # Aries (Mars) & Cancer (Moon): Mars->Moon friend, Moon->Mars neutral.
    assert graha("Aries", "Cancer") == 4

def test_graha_neutral_enemy_is_half():
    # Cancer (Moon) & Capricorn (Saturn): Moon->Saturn neutral, Saturn->Moon enemy.
    assert graha("Cancer", "Capricorn") == 0.5

def test_graha_is_symmetric():
    assert graha("Capricorn", "Cancer") == graha("Cancer", "Capricorn")


# ---------------- Nakshatra name resolution (engine spellings must not default to Ashwini) -------

def test_engine_nakshatra_spellings_resolve():
    # jyotishganit emits "Mula"/"Dhanishta"; these must map to their real index, not 0 (Ashwini).
    from synastry import _nak_idx, NAKSHATRA_INDEX
    assert _nak_idx("Mula") == NAKSHATRA_INDEX["Moola"]
    assert _nak_idx("Dhanishta") == NAKSHATRA_INDEX["Dhanishtha"]
    assert _nak_idx("Mula") != 0 and _nak_idx("Dhanishta") != 0

def test_all_engine_nakshatra_names_resolve_distinctly():
    # Every nakshatra the chart engine can emit must resolve to a distinct, correct index — a guard
    # against a future spelling drift silently collapsing a nakshatra onto Ashwini.
    import random
    from chart import compute_chart
    from synastry import _nak_idx, _moon_nakshatra
    rng = random.Random(7)
    seen = {}
    for _ in range(120):
        y, m, d = rng.randint(1980, 2005), rng.randint(1, 12), rng.randint(1, 28)
        try:
            c = compute_chart("X", f"{y:04d}-{m:02d}-{d:02d}", f"{rng.randint(0,23):02d}:{rng.randint(0,59):02d}",
                              28.6, 77.2, 5.5, "Delhi")
        except Exception:
            continue  # jyotishganit occasionally fails to compute a chart for some inputs; not our concern here
        for h in c["d1Chart"]["houses"]:
            for o in h.get("occupants", []):
                n = o.get("nakshatra", "")
                if n:
                    seen[n] = _nak_idx(n)
    assert len(seen) >= 20, f"too few nakshatras sampled ({len(seen)}) to be meaningful"
    # Only Ashwini itself may map to 0.
    zeros = [n for n, i in seen.items() if i == 0 and n.lower() != "ashwini"]
    assert not zeros, f"these engine nakshatra names silently default to Ashwini: {zeros}"


# ---------------- Sample-set fixture: Bhakoot expectations must match the engine ----------------

def test_sample_set_bhakoot_matches_expected():
    path = os.path.join(os.path.dirname(__file__), "fixtures/guna_milan_sample_set.json")
    with open(path) as f:
        doc = json.load(f)
    for p in doc["pairs"]:
        g, b = p["groom"], p["bride"]
        got = compute_guna_milan(g["moon_nakshatra"], "male", b["moon_nakshatra"], "female",
                                 g["moon_sign"], b["moon_sign"])["breakdown"]["bhakoot"]["score"]
        assert got == p["expected"]["bhakoot_score"], f"pair {p['id']}"


# ---------------- Per-person guna profiles (varna/vashya/yoni/sign-lord/gana/nadi) ----------------
def test_guna_milan_exposes_per_person_profiles():
    # Ashwini (gana Deva, yoni Horse, nadi Vata) moon in Aries (varna Kshatriya, lord Mars,
    # vashya Chatushpada) vs Bharani (Manushya, Elephant, Pitta) moon in Taurus.
    g = compute_guna_milan("Ashwini", "male", "Bharani", "female", "Aries", "Taurus")
    a, b = g["profiles"]["a"], g["profiles"]["b"]
    assert a["moon_sign"] == "Aries" and a["nakshatra"] == "Ashwini"
    assert a["varna"] == "Kshatriya"          # Aries is a fire sign -> Kshatriya
    assert a["yoni"] == "Horse"               # Ashwini -> Horse
    assert a["sign_lord"] == "Mars"           # Aries lord
    assert a["gana"] == "Deva"                # Ashwini -> Deva
    assert a["nadi"] == "Vata"                # Ashwini -> Vata
    assert a["vashya"] == "Chatushpada"       # Aries -> quadruped
    assert b["moon_sign"] == "Taurus" and b["nakshatra"] == "Bharani"
    assert b["gana"] == "Manushya"            # Bharani -> Manushya
    assert b["yoni"] == "Elephant"            # Bharani -> Elephant


def test_guna_profiles_have_all_keys():
    g = compute_guna_milan("Rohini", "female", "Magha", "male", "Taurus", "Leo")
    for side in ("a", "b"):
        for key in ("moon_sign", "nakshatra", "varna", "vashya", "yoni", "sign_lord", "gana", "nadi"):
            assert key in g["profiles"][side], f"missing {key} in {side}"
