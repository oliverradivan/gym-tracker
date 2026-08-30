import pytest

from main import normalize_username


def test_normalize_username_strips_and_lowercases():
    assert normalize_username("  Alex Smith  ") == "alexsmith"


def test_normalize_username_strips_non_alphanumeric():
    assert normalize_username("alex_smith-99!") == "alexsmith99"


def test_normalize_username_too_short_raises():
    with pytest.raises(ValueError):
        normalize_username("ab")


def test_normalize_username_too_long_raises():
    with pytest.raises(ValueError):
        normalize_username("a" * 25)


def test_normalize_username_empty_raises():
    with pytest.raises(ValueError):
        normalize_username("   ")