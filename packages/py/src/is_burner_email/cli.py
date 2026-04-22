"""CLI entry point — installed as `burner` via pyproject.toml scripts."""
from __future__ import annotations

import argparse
import json
import sys
from typing import cast

from . import Mode, check, get_list_sizes


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="burner",
        description="burner / disposable email detection",
    )
    parser.add_argument("email", nargs="?", help="email address to check")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Use strict mode (graylisted domains are treated as disposable)",
    )
    parser.add_argument("--json", action="store_true", dest="as_json", help="Output JSON")
    parser.add_argument("--stats", action="store_true", help="Print the sizes of the bundled lists")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.stats:
        sizes = get_list_sizes()
        if args.as_json:
            sys.stdout.write(json.dumps(sizes) + "\n")
        else:
            sys.stdout.write(
                f"blacklist: {sizes['blacklist']}\n"
                f"whitelist: {sizes['whitelist']}\n"
                f"graylist:  {sizes['graylist']}\n"
            )
        return 0

    if not args.email:
        parser.print_help(sys.stderr)
        return 2

    mode: Mode = cast(Mode, "strict" if args.strict else "normal")
    result = check(args.email, mode)

    if result["reason"] == "invalid-email":
        sys.stderr.write(f"Error: invalid email: {args.email}\n")
        return 2

    if args.as_json:
        sys.stdout.write(json.dumps({**result, "mode": mode}) + "\n")
    else:
        label = "BURNER" if result["burner"] else "OK"
        list_info = f" ({result['list']})" if result["list"] else ""
        sys.stdout.write(f"{label}{list_info}: {result['domain']} [{result['reason']}]\n")

    return 1 if result["burner"] else 0


if __name__ == "__main__":
    sys.exit(main())
