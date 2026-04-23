# is-burner-email (JavaScript / TypeScript)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists bundled at build time into the `dist/`. No network calls at runtime.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- **TypeScript.** Ships ESM + CJS + types. Node 20+.
- **Refreshed weekly, reviewed before release** — a cron aggregates multiple upstream sources and opens a PR; every published update passes through a maintainer review.

## Install

```sh
npm install is-burner-email
```

## Usage

```ts
import { isBurner, check } from 'is-burner-email';

isBurner('user@mailinator.com');                  // true
isBurner('user@gmail.com');                       // false
isBurner('user@duck.com');                        // false (normal mode)
isBurner('user@duck.com', { mode: 'strict' });    // true

check('user@duck.com', { mode: 'strict' });
// {
//   burner: true,
//   domain: 'duck.com',
//   list: 'graylist',
//   reason: 'graylisted-strict'
// }
```

### Runtime overrides

```ts
import { addToBlacklist, addToWhitelist } from 'is-burner-email';

addToBlacklist('badactor.example');
addToWhitelist('our-corporate-domain.example');
```

Whitelist always wins over blacklist.

## CLI

The package installs a `burner` command:

```sh
npx is-burner-email user@mailinator.com
# or, after global install (`npm i -g is-burner-email`):
burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

burner user@duck.com --strict --json
# {"burner":true,"domain":"duck.com","list":"graylist","reason":"graylisted-strict","mode":"strict"}

burner --stats
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## Modes

| Mode     | blacklist | graylist | whitelist |
| -------- | --------- | -------- | --------- |
| `normal` | blocked   | allowed  | allowed   |
| `strict` | blocked   | blocked  | allowed   |

The **graylist** contains email alias / forwarding services (SimpleLogin, DuckDuckGo Email Protection, Firefox Relay) — services that let users mint unlimited revocable aliases. Treat these as burners only if your use case requires strong user accountability.

## Other languages

Same API, same data, same versions across four ecosystems:

| Language | Registry | Install |
|---|---|---|
| JavaScript / TypeScript (you are here) | [npm](https://www.npmjs.com/package/is-burner-email) | `npm install is-burner-email` |
| Python | [PyPI](https://pypi.org/project/is-burner-email/) | `pip install is-burner-email` |
| Go | go.dev | `go get github.com/kristijandraca/is-burner-email/packages/go` |
| PHP | [Packagist](https://packagist.org/packages/kristijandraca/is-burner-email) | `composer require kristijandraca/is-burner-email` |

See the [monorepo README](https://github.com/kristijandraca/is-burner-email) for the full overview.

## License

MIT
