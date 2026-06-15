# AGENTS.md

This file provides guidance to coding agents working in this repository.

## What this is

A monorepo that ships **the same** burner / disposable-email detector to **seven** language registries (JS/npm, Python/PyPI, Go, PHP/Packagist, C#/NuGet, Kotlin/Maven Central, Rust/crates.io). Every package reads the same canonical domain lists in `data/` and exposes the same API shape, CLI, list model, and `reason` strings. The defining constraint of this repo is **parity** — a behavior change in one language is expected to land in all of them.

## Architecture

### Data is the single source of truth
`data/` holds the canonical lists; everything else is derived:

| File | Role | Edited by |
|---|---|---|
| `data/blacklist.txt` | Aggregated burner domains | **auto-generated — never hand-edit** |
| `data/whitelist.txt` | Always-allowed (overrides everything) | humans |
| `data/graylist.txt` | Alias/forwarding services (blocked only in strict mode) | humans |
| `data/extra-blacklist.txt` | Manual blacklist additions merged in at build time | humans |

`scripts/build-lists.ts` (`npm run build:lists`) fetches 5 upstream sources, merges them with `extra-blacklist.txt`, subtracts whitelist + graylist, writes `data/blacklist.txt`, then **copies all four files into each package that needs a local copy** (`SYNC_TARGETS`). Each language embeds data differently: Go `go:embed`, Rust `include_str!`, C# `EmbeddedResource`, Kotlin JVM classpath resources (`src/main/resources`), Python package data, PHP runtime reads. JS reads root `data/` directly via tsup's text loader. **When you add/change a sync target or a package's data path, update `SYNC_TARGETS` in `build-lists.ts`** (and the change-detection path list in `refresh-lists.yml`).

### Classification logic (identical across all languages)
Priority order in `check(email, mode)`: runtime whitelist → static whitelist → runtime blacklist → static blacklist → graylist (strict ⇒ burner `graylisted-strict`, normal ⇒ not-burner `graylisted-normal`) → `unknown`. Domain extraction: trim → last `@` → lowercase the part after it → require a `.` else `invalid-email`. The Go package (`packages/go/burner.go`) is the cleanest reference implementation when porting.

### Versioning is centralized
`VERSION` at the repo root is the **only** source of truth. `scripts/bump-version.ts <patch|minor|major>` bumps it and calls `scripts/sync-version.ts`, which rewrites the version field in every package manifest (`package.json`, `pyproject.toml`, `.csproj`, `build.gradle.kts`, `Cargo.toml`) and the literal Maven coordinate in READMEs. Go and PHP have no version file — they take their version from git tags. **Never hand-edit a package's version field.** All languages always release together; there is no per-language hotfix path.

### Two-workflow release model (supply-chain gate)
- `.github/workflows/refresh-lists.yml` — weekly cron + manual. Rebuilds data, and if it changed, opens/updates a PR on the `data/refresh` branch (labels `high-churn` if churn > 1000). **Publishes nothing** — a human must review and merge.
- `.github/workflows/release.yml` — manual `workflow_dispatch` only. Bumps the shared version, builds, tags per-language (`js/vX`, `py/vX`, `packages/go/vX`, `rust/vX`, …), and publishes to all registries (npm/PyPI/NuGet/crates.io via OIDC Trusted Publishing; Go/PHP via tag push).
- `.github/workflows/ci.yml` — runs on push/PR, per-language version matrices.

## Commands

Root tooling is only for the shared data pipeline; **each package is standalone — install and test from inside its own directory.**

```sh
# Data pipeline (root)
npm install
npm run build:lists                 # fetch upstream, rebuild blacklist, sync to all packages
npm run version:bump -- patch       # bump VERSION + sync into every manifest

# Per language (cd into the package first)
cd packages/js     && npm install && npm test          # vitest; npm run typecheck; npm run build
cd packages/py     && pip install -e '.[test]' && python -m pytest
cd packages/go     && go test ./...                    # go build ./cmd/burner
cd packages/rust   && cargo test                       # cargo build --release --bin burner
cd packages/csharp && dotnet test
cd packages/kotlin && ./gradlew test
composer install && composer test                      # PHP — composer.json is at repo ROOT (Packagist requirement)

# Single test examples
cd packages/js   && npx vitest run -t "graylist"
cd packages/py   && python -m pytest -k graylist
cd packages/go   && go test -run TestGraylistStrict ./...
cd packages/rust && cargo test graylist_strict
```

## Editing domains

- **Whitelist / graylist:** edit `data/whitelist.txt` or `data/graylist.txt`, then `npm run build:lists && (cd packages/js && npm test)`. Graylist is narrow — only alias/forwarding services that mint revocable aliases (SimpleLogin, DuckDuckGo, Firefox Relay); privacy providers like Proton go in the whitelist.
- **Blacklist:** never edit `data/blacklist.txt`. Add manual entries to `data/extra-blacklist.txt`; the build merges them. Whitelist still overrides.
- **New upstream source:** add to `SOURCES` in `scripts/build-lists.ts` with a raw URL and `parseLines` or `parseJsonArray`.

## When changing behavior, preserve parity

Keep these identical across every package (see `CONTRIBUTING.md` "Keeping languages in parity"):
- API surface: `check`, `isBurner`, `addToBlacklist`, `addToWhitelist`, `removeFromBlacklist`, `removeFromWhitelist`, `getListSizes`
- `CheckResult` fields: `burner`, `domain`, `list`, `reason`
- `mode` values (`normal`, `strict`) and `reason` strings (`invalid-email`, `whitelisted`, `blacklisted`, `graylisted-normal`, `graylisted-strict`, `unknown`)
- CLI: `burner <email> [--strict] [--json] [--stats] [--help]`, exit codes `0` clean / `1` burner / `2` invalid
- Test cases mirror each other — add the equivalent test in every language you touch.
