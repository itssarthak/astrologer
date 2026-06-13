# tests/python/conftest.py
import sys, os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/lib/pyodide/scripts'))
from chart import compute_chart  # noqa: E402


@pytest.fixture(scope="session")
def sarthak_chart():
    # Aquarius-lagna reference used across the suite.
    return compute_chart("Sarthak", "1996-11-22", "13:06", 28.6139, 77.2090, 5.5, "Delhi")


@pytest.fixture(scope="session")
def tanya_chart():
    # Smoke anchor from the WhatsApp skill: DOB 11 Jul 1998 19:10 IST, Agra.
    return compute_chart("Tanya", "1998-07-11", "19:10", 27.1767, 78.0081, 5.5, "Agra, India")
