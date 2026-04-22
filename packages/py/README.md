# is-burner-email (Python)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists bundled inside the wheel. No network calls at runtime.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- **Typed** (ships `py.typed`). Python 3.9+.

## Install

```sh
pip install is-burner-email
```

## Usage

```python
from is_burner_email import is_burner, check

is_burner("user@mailinator.com")                # True
is_burner("user@gmail.com")                     # False
is_burner("user@duck.com")                      # False (normal mode)
is_burner("user@duck.com", mode="strict")       # True

check("user@duck.com", mode="strict")
# {
#   'burner': True,
#   'domain': 'duck.com',
#   'list': 'graylist',
#   'reason': 'graylisted-strict'
# }
```

### Runtime overrides

```python
from is_burner_email import add_to_blacklist, add_to_whitelist

add_to_blacklist("badactor.example")
add_to_whitelist("our-corporate-domain.example")
```

Whitelist always wins over blacklist.

## CLI

```sh
burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

burner user@duck.com --strict --json
# {"burner": true, "domain": "duck.com", "list": "graylist", "reason": "graylisted-strict", "mode": "strict"}

burner --stats
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## License

MIT
