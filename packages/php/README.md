# is-burner-email (PHP)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists shipped with the package, read at runtime.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- PHP 8.1+.

## Install

```sh
composer require kristijandraca/is-burner-email
```

## Usage

```php
<?php
use Kristijandraca\IsBurnerEmail\IsBurnerEmail;

IsBurnerEmail::isBurner('user@mailinator.com');                              // true
IsBurnerEmail::isBurner('user@gmail.com');                                   // false
IsBurnerEmail::isBurner('user@duck.com');                                    // false (normal)
IsBurnerEmail::isBurner('user@duck.com', IsBurnerEmail::MODE_STRICT);        // true

$result = IsBurnerEmail::check('user@duck.com', IsBurnerEmail::MODE_STRICT);
// [
//   'burner' => true,
//   'domain' => 'duck.com',
//   'list' => 'graylist',
//   'reason' => 'graylisted-strict',
// ]
```

### Runtime overrides

```php
IsBurnerEmail::addToBlacklist('badactor.example');
IsBurnerEmail::addToWhitelist('our-corporate-domain.example');
```

Whitelist always wins over blacklist.

## CLI

```sh
vendor/bin/burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

vendor/bin/burner user@duck.com --strict --json

vendor/bin/burner --stats
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## License

MIT
