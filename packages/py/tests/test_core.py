"""Port of test/index.test.ts — keep in parity with JS suite."""
from __future__ import annotations

import pytest

from is_burner_email import (
    add_to_blacklist,
    add_to_whitelist,
    check,
    get_list_sizes,
    is_burner,
    remove_from_blacklist,
    remove_from_whitelist,
)


class TestExtractDomain:
    def test_non_string_returns_invalid(self):
        assert check(None)["reason"] == "invalid-email"  # type: ignore[arg-type]
        assert check(42)["reason"] == "invalid-email"  # type: ignore[arg-type]

    def test_missing_at(self):
        assert check("not-an-email")["reason"] == "invalid-email"

    def test_empty_local_or_domain(self):
        assert check("@example.com")["reason"] == "invalid-email"
        assert check("foo@")["reason"] == "invalid-email"

    def test_domain_without_dot(self):
        assert check("foo@localhost")["reason"] == "invalid-email"

    def test_lowercase_and_trim(self):
        assert check("  User@GMail.COM  ")["domain"] == "gmail.com"


class TestWhitelist:
    def test_gmail_whitelisted(self):
        r = check("user@gmail.com")
        assert r["burner"] is False
        assert r["list"] == "whitelist"
        assert r["reason"] == "whitelisted"

    def test_overrides_both_modes(self):
        assert is_burner("user@gmail.com", "normal") is False
        assert is_burner("user@gmail.com", "strict") is False


class TestGraylist:
    def test_allowed_normal(self):
        r = check("user@duck.com", "normal")
        assert r["burner"] is False
        assert r["list"] == "graylist"
        assert r["reason"] == "graylisted-normal"

    def test_blocked_strict(self):
        r = check("user@duck.com", "strict")
        assert r["burner"] is True
        assert r["list"] == "graylist"
        assert r["reason"] == "graylisted-strict"

    def test_normal_is_default(self):
        assert is_burner("user@mozmail.com") is False
        assert is_burner("user@mozmail.com", "strict") is True


class TestUnknown:
    def test_unknown_domain(self):
        r = check("user@definitely-not-in-any-list-xyz.example")
        assert r["burner"] is False
        assert r["list"] is None
        assert r["reason"] == "unknown"


class TestRuntimeOverrides:
    @pytest.fixture(autouse=True)
    def _cleanup(self):
        remove_from_blacklist("runtime-block.example")
        remove_from_whitelist("runtime-allow.example")
        remove_from_blacklist("gmail.com")
        remove_from_whitelist("simplelogin.com")
        yield
        remove_from_blacklist("runtime-block.example")
        remove_from_whitelist("runtime-allow.example")
        remove_from_blacklist("gmail.com")
        remove_from_whitelist("simplelogin.com")
        remove_from_blacklist("contested.example")
        remove_from_whitelist("contested.example")
        remove_from_blacklist("badguy.example")

    def test_add_to_blacklist(self):
        assert is_burner("user@runtime-block.example") is False
        add_to_blacklist("runtime-block.example")
        r = check("user@runtime-block.example")
        assert r["burner"] is True
        assert r["list"] == "blacklist"

    def test_whitelist_rescues_graylisted(self):
        assert is_burner("user@simplelogin.com", "strict") is True
        add_to_whitelist("simplelogin.com")
        assert is_burner("user@simplelogin.com", "strict") is False
        remove_from_whitelist("simplelogin.com")
        assert is_burner("user@simplelogin.com", "strict") is True

    def test_whitelist_wins_over_blacklist(self):
        add_to_blacklist("contested.example")
        add_to_whitelist("contested.example")
        assert is_burner("user@contested.example") is False

    def test_normalizes(self):
        add_to_blacklist("  BadGuy.EXAMPLE  ")
        assert is_burner("user@badguy.example") is True


class TestListSizes:
    def test_sizes_are_sensible(self):
        sizes = get_list_sizes()
        assert sizes["blacklist"] > 0
        assert sizes["whitelist"] > 0
        assert sizes["graylist"] > 0
