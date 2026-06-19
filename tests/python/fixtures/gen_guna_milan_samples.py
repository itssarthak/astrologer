"""Regenerate the reproducible Guna Milan sample set used to compare our engine vs AstroTalk.

Run:  .venv-test/bin/python tests/python/fixtures/gen_guna_milan_samples.py
Writes: tests/python/fixtures/guna_milan_sample_set.json  (deterministic, random.seed(42))

current_engine = our output at capture time (contains the known koota bugs).
expected.bhakoot_* = the bug-free classical RASHI rule and is the only field verified correct so
far; use the set as the seed for golden tests once the kootas are fixed.
"""
import sys, os, random, json

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "../../../src/lib/pyodide/scripts"))
from chart import compute_chart
from synastry import compute_guna_milan, _moon_nakshatra, SIGN_INDEX

SEED = 42
CITIES = [
    ("Delhi", 28.6139, 77.2090), ("Mumbai", 19.0760, 72.8777), ("Kolkata", 22.5726, 88.3639),
    ("Chennai", 13.0827, 80.2707), ("Bengaluru", 12.9716, 77.5946), ("Hyderabad", 17.3850, 78.4867),
    ("Pune", 18.5204, 73.8567), ("Jaipur", 26.9124, 75.7873), ("Lucknow", 26.8467, 80.9462),
    ("Ahmedabad", 23.0225, 72.5714),
]


def rand_person(rng):
    y, m, d = rng.randint(1985, 2000), rng.randint(1, 12), rng.randint(1, 28)
    hh, mm = rng.randint(0, 23), rng.randint(0, 59)
    city, lat, lon = rng.choice(CITIES)
    return {"dob": f"{y:04d}-{m:02d}-{d:02d}", "time": f"{hh:02d}:{mm:02d}",
            "city": city, "lat": lat, "lon": lon, "tz": 5.5}


def correct_bhakoot(sign_a, sign_b):
    """Classical RASHI Bhakoot: dosha (0) when moon signs are 2/12, 5/9 or 6/8 apart; else 7."""
    a, b = SIGN_INDEX[sign_a], SIGN_INDEX[sign_b]
    fwd, rev = ((b - a) % 12) + 1, ((a - b) % 12) + 1
    dosha = {fwd, rev} in ({2, 12}, {5, 9}, {6, 8})
    return (0 if dosha else 7), f"{min(fwd, rev)}/{max(fwd, rev)}", dosha


def main():
    rng = random.Random(SEED)
    pairs = []
    for i in range(1, 9):
        A, B = rand_person(rng), rand_person(rng)
        ca = compute_chart("A", A["dob"], A["time"], A["lat"], A["lon"], A["tz"], A["city"])
        cb = compute_chart("B", B["dob"], B["time"], B["lat"], B["lon"], B["tz"], B["city"])
        na, nb = _moon_nakshatra(ca), _moon_nakshatra(cb)
        A.update(moon_nakshatra=na[0], moon_sign=na[2], gender="male")
        B.update(moon_nakshatra=nb[0], moon_sign=nb[2], gender="female")
        gm = compute_guna_milan(na[0], "male", nb[0], "female", na[2], nb[2])
        score, rel, dosha = correct_bhakoot(na[2], nb[2])
        pairs.append({
            "id": i, "groom": A, "bride": B,
            "current_engine": {"breakdown": gm["breakdown"], "total": gm["total"], "verdict": gm["verdict"]},
            "expected": {"bhakoot_score": score, "bhakoot_relation": rel, "bhakoot_dosha": dosha},
        })

    doc = {
        "seed": SEED,
        "generated_by": ".venv-test/bin/python tests/python/fixtures/gen_guna_milan_samples.py",
        "tz_offset": 5.5,
        "note": ("Reproducible Guna Milan sample set for comparing our engine vs AstroTalk/AstroSage. "
                 "current_engine is the CORRECTED output (after the koota rebuild: rashi-based Bhakoot/"
                 "Varna/Graha-Maitri, standard 9/9/9 Gana, and the Mula/Dhanishta name-alias fix). "
                 "expected.bhakoot_* is the independent rashi-rule check. Cross-check totals against "
                 "AstroTalk; paste their per-koota breakdown here to lock as golden values."),
        "pairs": pairs,
    }
    out = os.path.join(HERE, "guna_milan_sample_set.json")
    with open(out, "w") as f:
        json.dump(doc, f, indent=2, default=str)
    print(f"wrote {out}")
    print("Bhakoot-dosha pairs (we wrongly output 7):",
          [p["id"] for p in pairs if p["expected"]["bhakoot_dosha"]])


if __name__ == "__main__":
    main()
