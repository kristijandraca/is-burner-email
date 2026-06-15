# Contributing

Thanks for considering a contribution. This project is a monorepo that ships the same library to seven language registries. Please read this page before opening a large PR.

## Layout

```
/
├── data/                               # canonical domain lists (source of truth)
├── packages/
│   ├── js/                             # npm package
│   ├── py/                             # PyPI package
│   ├── go/                             # Go module
│   ├── php/                            # Composer package
│   ├── csharp/                         # NuGet package
│   ├── kotlin/                         # Maven Central package
│   └── rust/                           # crates.io package
├── scripts/build-lists.ts              # fetches upstream sources, rebuilds blacklist, syncs to packages
└── .github/workflows/                  # CI + release
```

All seven packages read the same `data/` files. `build-lists.ts` syncs copies into the language packages that need local data (Go for `go:embed`, PHP for runtime reads, Python for editable installs, C# for `EmbeddedResource`, Kotlin for JVM classpath resources, Rust for `include_str!`).

## Quick start

The root has minimal tooling for the shared data pipeline. Every language package is standalone — install and test from within its own directory.

```sh
git clone https://github.com/kristijandraca/is-burner-email.git
cd is-burner-email

# Root tooling (needed only for refreshing the blacklist from upstream sources):
npm install
npm run build:lists

# Then work in whichever language package you care about:
cd packages/js      && npm install && npm test
cd packages/py      && python -m pip install -e '.[test]' && python -m pytest
cd packages/go      && go test ./...
cd packages/rust    && cargo test
cd packages/csharp  && dotnet test
cd packages/kotlin  && ./gradlew test
composer install && composer test  # composer.json lives at the repo root (Packagist requirement)
```

## Useful scripts

**Root** — just the shared data pipeline:

| Command | What it does |
| --- | --- |
| `npm run build:lists` | Fetch upstream sources, rebuild `data/blacklist.txt`, sync copies into language packages |

**`packages/js/`:**

| Command | What it does |
| --- | --- |
| `npm test` | Run the vitest suite |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run build` | Build ESM + CJS + `.d.ts` into `packages/js/dist/` |

## Adding a domain to the whitelist

`data/whitelist.txt` is the source of truth. Add a domain when:

- It's a real webmail provider, ISP, company, or service
- It's being mis-flagged by one or more upstream disposable-email lists

Place it in the group that fits (alphabetical within each group). If no group fits, add it under **"Company / brand domains"** or propose a new group in your PR description.

After editing: run `npm run build:lists && npm test`. The build script subtracts the whitelist from the aggregated blacklist and re-syncs the copies.

## Adding a domain to the graylist

The graylist is narrowly defined: **email alias / forwarding services that let users mint unlimited revocable aliases** (SimpleLogin, DuckDuckGo Email Protection, Firefox Relay). Please do not add general privacy-focused providers (Proton, Tutanota) — those belong in the whitelist.

Edit `data/graylist.txt`, then `npm run build:lists && npm test`.

## Adding a domain to the blacklist manually

**Do not edit `data/blacklist.txt` — it's auto-generated and your changes will be wiped on the next `npm run build:lists`.**

If upstream sources haven't picked up a burner domain yet, add it to **`data/extra-blacklist.txt`** instead. The build script merges this list with upstream sources before the final blacklist is written.

Whitelist precedence still applies: if you accidentally add a legitimate domain here, the whitelist will neutralize it.

After editing: `npm run build:lists && npm test`.

## Adding a source to the blacklist fetcher

Sources live in `scripts/build-lists.ts`. Each source needs:

- A stable raw URL (prefer `raw.githubusercontent.com`)
- A parser — either the built-in `parseLines` (text, `#` comments) or `parseJsonArray`
- A short, recognizable `name`

Link the upstream repo in your PR description so reviewers can assess quality and license.

## Keeping languages in parity

When you touch a language package, consider whether the change should propagate to the others. Parity principles:

- Same public API surface: `check`, `isBurner`, `addToBlacklist`, `addToWhitelist`, `removeFromBlacklist`, `removeFromWhitelist`, `getListSizes`
- Same `CheckResult` fields: `burner`, `domain`, `list`, `reason`
- Same `mode` values (`normal`, `strict`) and `reason` strings (`invalid-email`, `whitelisted`, `blacklisted`, `graylisted-normal`, `graylisted-strict`, `unknown`)
- Same CLI: `burner <email> [--strict] [--json] [--stats] [--help]` with exit codes `0/1/2`

Tests in each package cover the same cases — if you add a test in one language, add the equivalent in the others.

## Reporting a false positive or false negative

You do **not** need to open a PR for list changes. Open an issue with the **False positive** or **False negative** template — a maintainer will update the lists. This keeps the curation history in one place.

## Pull requests

- One logical change per PR
- Tests must pass in every language you touched
- Do **not** commit `packages/js/dist/`, `packages/php/vendor/`, `packages/py/.pytest_cache/`, `__pycache__/`, or similar build artifacts
- Do **not** hand-edit `data/blacklist.txt` — it's auto-generated
- Do **not** hand-edit `version` fields in `packages/js/package.json` or `packages/py/pyproject.toml` — every package shares a single version. See the [maintainer notes](#maintainer-notes) below.

## Commit style

Lowercase, imperative, prefixed where it adds clarity:

```
fix(js/whitelist): re-add live.com
feat(py/cli): support --json output
chore(data): refresh disposable domain lists
docs: clarify graylist semantics
```

No strict enforcement — readable beats rigid.

## Maintainer notes

If you're releasing, not contributing: two workflows are involved.

- [`.github/workflows/refresh-lists.yml`](./.github/workflows/refresh-lists.yml) runs weekly (and on manual dispatch). It rebuilds the blacklist from upstream sources and, if the data changed, opens or updates a PR on the `data/refresh` branch. No publish happens here — this is the supply-chain gate.
- [`.github/workflows/release.yml`](./.github/workflows/release.yml) is manual-only (`workflow_dispatch`). It bumps the shared version, builds, and publishes to all seven registries.

**Typical release flow:**
1. Monday cron opens/updates the `data/refresh` PR. Review the churn summary in the PR description (added / removed counts, per-source counts, `high-churn` label if anomalous).
2. Merge the PR. This moves the refreshed data onto `main` but publishes nothing.
3. Go to Actions → Release → Run workflow → pick `patch` (or `minor`/`major`) → run.

**One version, one truth.** `VERSION` at the repo root is the single source. `scripts/sync-version.ts` propagates it into every package manifest and the Gradle coordinate snippets in READMEs. Go and PHP have no version files — they take their version from git tags.

**All seven languages advance together.** Every release bumps everything. There is no "JS hotfix without a Python bump" path. If you think you need one, reconsider — version drift across languages is exactly what the model avoids.

**Per-registry status:**

| Registry | State |
|---|---|
| npm (JS) | ✅ automated via OIDC + Trusted Publishing |
| PyPI (Python) | ✅ automated via OIDC + Trusted Publishing |
| Go | ⚠️ no-op publish — the `packages/go/vX.Y.Z` tag *is* the release; `go get @vX.Y.Z` works once pushed |
| Packagist (PHP) | ✅ automated via GitHub webhook (Packagist pulls on tag push) |
| NuGet (C#) | ✅ automated via OIDC + Trusted Publishing (requires `NUGET_USER` repo secret with the nuget.org profile name) |
| Maven Central (Kotlin) | ✅ automated via `vanniktech/gradle-maven-publish-plugin` (requires `MAVEN_CENTRAL_USERNAME`, `MAVEN_CENTRAL_PASSWORD`, `SIGNING_KEY`, `SIGNING_KEY_ID`, `SIGNING_PASSWORD` repo secrets) |
| crates.io (Rust) | ✅ automated via OIDC Trusted Publishing (`rust-lang/crates-io-auth-action`). One-time setup: the crate must exist (first publish manual with an API token), then add a GitHub Actions Trusted Publisher on crates.io pointing at this repo + `release.yml` |

Setup notes for Maven Central / Kotlin live as a `TODO:` comment next to its build step in [`release.yml`](./.github/workflows/release.yml).

**Out-of-band release** (rare, usually wrong): edit `VERSION`, run `npm run version:sync`, commit, tag, push. Use the Release workflow's manual dispatch unless you have a specific reason not to.
