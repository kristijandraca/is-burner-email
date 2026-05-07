# is-burner-email

Fast, offline burner / disposable email detection. Same three-list model (`blacklist` / `whitelist` / `graylist`) and two modes (`normal` / `strict`) across six languages.

## Packages

| Language | Registry | Install | Docs |
|---|---|---|---|
| **JavaScript / TypeScript** | [npm](https://www.npmjs.com/package/is-burner-email) | `npm install is-burner-email` | [`packages/js/`](./packages/js) |
| **Python** | [PyPI](https://pypi.org/project/is-burner-email/) | `pip install is-burner-email` | [`packages/py/`](./packages/py) |
| **Go** | go.dev | `go get github.com/kristijandraca/is-burner-email/packages/go` | [`packages/go/`](./packages/go) |
| **PHP** | [Packagist](https://packagist.org/packages/kristijandraca/is-burner-email) | `composer require kristijandraca/is-burner-email` | [`packages/php/`](./packages/php) |
| **C# / .NET** | [NuGet](https://www.nuget.org/packages/Kristijandraca.IsBurnerEmail) | `dotnet add package Kristijandraca.IsBurnerEmail` | [`packages/csharp/`](./packages/csharp) |
| **Kotlin / JVM** | [Maven Central](https://central.sonatype.com/artifact/io.github.kristijandraca/is-burner-email) | `implementation("io.github.kristijandraca:is-burner-email:1.3.2")` | [`packages/kotlin/`](./packages/kotlin) |

Every package ships the same bundled domain data and exposes the same API shape.

## Shared features

- **Offline.** Domain lists are bundled at package-build time. No network calls at runtime.
- **Zero runtime dependencies** in every language.
- **Three lists.**
  - `blacklist` — burners (always blocked)
  - `whitelist` — always allowed; overrides everything else
  - `graylist` — email alias / forwarding services (SimpleLogin, DuckDuckGo, Firefox Relay); blocked only in strict mode
- **Two modes.** `normal` (blacklist only) or `strict` (blacklist + graylist)
- **CLI in every language** — `burner <email>` with the same flags and exit codes
- **Refreshed weekly, reviewed before release** — a cron rebuilds the aggregated blacklist from upstream sources and opens a PR with the diff; a maintainer reviews and merges it, then cuts a patch release. No upstream change reaches a published package unattended.

## Data model

All four packages read the same canonical files in [`data/`](./data):

| File | Contents | Edited by |
|---|---|---|
| `blacklist.txt` | Aggregated from 5 upstream sources + `extra-blacklist.txt`, minus `whitelist` and `graylist` | auto-generated |
| `whitelist.txt` | Curated "always allow" list (major providers, companies, IANA test domains) | humans |
| `graylist.txt` | Curated alias / forwarding services | humans |
| `extra-blacklist.txt` | Manually-curated additions to the blacklist | humans |

`scripts/build-lists.ts` fetches, merges, and syncs these files into the language packages that need local copies (Go for `go:embed`, PHP for runtime reads, Python for editable installs, C# for `EmbeddedResource`, Kotlin for JVM classpath resources). The JS package reads root `data/` directly via tsup's text loader.

## Monorepo layout

```
/
├── data/                               # Canonical data (single source of truth)
├── packages/
│   ├── js/                             # npm package
│   ├── py/                             # PyPI package
│   ├── go/                             # Go module
│   ├── php/                            # Composer package
│   ├── csharp/                         # NuGet package
│   └── kotlin/                         # Maven Central package
├── scripts/
│   └── build-lists.ts                  # Fetches sources, rebuilds blacklist, syncs copies
└── .github/workflows/                  # CI + release pipelines
```

## Sources

The blacklist aggregates and deduplicates domains from:

- [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
- [tompec/disposable-email-domains](https://github.com/tompec/disposable-email-domains)
- [FGRibreau/mailchecker](https://github.com/FGRibreau/mailchecker)
- [7c/fakefilter](https://github.com/7c/fakefilter)
- [martenson/disposable-email-domains](https://github.com/martenson/disposable-email-domains)

## Community

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev setup, adding domains, PR process
- [`SECURITY.md`](./SECURITY.md) — reporting vulnerabilities
- [`ACKNOWLEDGMENTS.md`](./ACKNOWLEDGMENTS.md) — upstream list credits

## License

MIT
