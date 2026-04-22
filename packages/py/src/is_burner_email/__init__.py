"""Fast, offline burner / disposable email detection.

Public API:
    is_burner(email, mode='normal') -> bool
    check(email, mode='normal') -> CheckResult (TypedDict)
    add_to_blacklist(domain), add_to_whitelist(domain)
    remove_from_blacklist(domain), remove_from_whitelist(domain)
    get_list_sizes() -> dict
"""
from __future__ import annotations

from importlib.resources import files
from typing import Literal, Optional, Set, TypedDict

__all__ = [
    "Mode",
    "ListName",
    "CheckResult",
    "check",
    "is_burner",
    "add_to_blacklist",
    "add_to_whitelist",
    "remove_from_blacklist",
    "remove_from_whitelist",
    "get_list_sizes",
]

Mode = Literal["normal", "strict"]
ListName = Literal["blacklist", "whitelist", "graylist"]


class CheckResult(TypedDict):
    burner: bool
    domain: Optional[str]
    list: Optional[ListName]
    reason: str


def _parse_txt(text: str) -> Set[str]:
    s: Set[str] = set()
    for line in text.splitlines():
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        s.add(t.lower())
    return s


def _load(name: str) -> Set[str]:
    # data/ lives inside the package thanks to pyproject.toml's force-include.
    resource = files("is_burner_email.data").joinpath(name)
    return _parse_txt(resource.read_text(encoding="utf-8"))


_BLACKLIST: Set[str] = _load("blacklist.txt")
_WHITELIST: Set[str] = _load("whitelist.txt")
_GRAYLIST: Set[str] = _load("graylist.txt")

_runtime_blacklist: Set[str] = set()
_runtime_whitelist: Set[str] = set()


def _normalize(s: str) -> str:
    return s.strip().lower()


def _extract_domain(email: object) -> Optional[str]:
    if not isinstance(email, str):
        return None
    trimmed = email.strip()
    at = trimmed.rfind("@")
    if at <= 0 or at == len(trimmed) - 1:
        return None
    domain = trimmed[at + 1 :].lower()
    if "." not in domain:
        return None
    return domain


def check(email: str, mode: Mode = "normal") -> CheckResult:
    domain = _extract_domain(email)
    if domain is None:
        return {"burner": False, "domain": None, "list": None, "reason": "invalid-email"}

    if domain in _runtime_whitelist or domain in _WHITELIST:
        return {"burner": False, "domain": domain, "list": "whitelist", "reason": "whitelisted"}

    if domain in _runtime_blacklist or domain in _BLACKLIST:
        return {"burner": True, "domain": domain, "list": "blacklist", "reason": "blacklisted"}

    if domain in _GRAYLIST:
        if mode == "strict":
            return {
                "burner": True,
                "domain": domain,
                "list": "graylist",
                "reason": "graylisted-strict",
            }
        return {
            "burner": False,
            "domain": domain,
            "list": "graylist",
            "reason": "graylisted-normal",
        }

    return {"burner": False, "domain": domain, "list": None, "reason": "unknown"}


def is_burner(email: str, mode: Mode = "normal") -> bool:
    return check(email, mode)["burner"]


def add_to_blacklist(domain: str) -> None:
    _runtime_blacklist.add(_normalize(domain))


def add_to_whitelist(domain: str) -> None:
    _runtime_whitelist.add(_normalize(domain))


def remove_from_blacklist(domain: str) -> bool:
    d = _normalize(domain)
    if d in _runtime_blacklist:
        _runtime_blacklist.remove(d)
        return True
    return False


def remove_from_whitelist(domain: str) -> bool:
    d = _normalize(domain)
    if d in _runtime_whitelist:
        _runtime_whitelist.remove(d)
        return True
    return False


def get_list_sizes() -> dict:
    return {
        "blacklist": len(_BLACKLIST),
        "whitelist": len(_WHITELIST),
        "graylist": len(_GRAYLIST),
    }
