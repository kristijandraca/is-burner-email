# is-burner-email

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists are bundled at build time. No network calls at runtime.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services like SimpleLogin, DuckDuckGo, Firefox Relay — blocked only in strict mode).
- **TypeScript.** Ships both ESM and CJS with types. Node 20+.
- **Auto-updated weekly** via GitHub Actions, aggregating multiple upstream sources.

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

## Sources

The blacklist aggregates and deduplicates domains from:

- [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
- [tompec/disposable-email-domains](https://github.com/tompec/disposable-email-domains)
- [FGRibreau/mailchecker](https://github.com/FGRibreau/mailchecker)
- [7c/fakefilter](https://github.com/7c/fakefilter)
- [martenson/disposable-email-domains](https://github.com/martenson/disposable-email-domains)

Whitelist and graylist are manually curated in [`data/`](./data).

## Community

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — dev setup, how to add domains, PR process
- [`SECURITY.md`](./SECURITY.md) — reporting vulnerabilities
- [`ACKNOWLEDGMENTS.md`](./ACKNOWLEDGMENTS.md) — upstream list credits

## License

MIT
