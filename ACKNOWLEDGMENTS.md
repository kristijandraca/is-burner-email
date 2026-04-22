# Acknowledgments

`is-burner-email` aggregates and builds on the work of several community-maintained projects. Please consider starring and supporting these upstream sources — this package is only as good as they are.

## Blacklist sources

Domains from the following lists are merged, deduplicated, and shipped as our blacklist:

- **[disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)** — widely-used CC0 community list
- **[ivolo/disposable-email-domains](https://github.com/ivolo/disposable-email-domains)** — JSON-formatted, very broad coverage
- **[FGRibreau/mailchecker](https://github.com/FGRibreau/mailchecker)** — cross-language disposable detector; we use the list portion
- **[7c/fakefilter](https://github.com/7c/fakefilter)** — fake-filter community project
- **[martenson/disposable-email-domains](https://github.com/martenson/disposable-email-domains)** — long-standing historical list

## Inspiration & discussion

- **[disposable/disposable](https://github.com/disposable/disposable)** — many specific whitelist decisions in this project trace back to discussion and evidence in that repository's issues

## Design choices

The graylist treatment of alias / forwarding services (SimpleLogin, DuckDuckGo Email Protection, Firefox Relay) is a design choice of this project. Upstream sources typically classify these as either disposable or legitimate; we classify them as a third category because their behavior warrants it.
