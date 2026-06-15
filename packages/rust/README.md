# is-burner-email (Rust)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists embedded at compile time via `include_str!`.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- Rust 1.70+.

## Install

```sh
cargo add is-burner-email
```

## Usage

```rust
use is_burner_email::{check, is_burner, Mode};

fn main() {
    println!("{}", is_burner("user@mailinator.com", Mode::Normal)); // true
    println!("{}", is_burner("user@gmail.com", Mode::Normal));      // false
    println!("{}", is_burner("user@duck.com", Mode::Normal));       // false
    println!("{}", is_burner("user@duck.com", Mode::Strict));       // true

    let r = check("user@duck.com", Mode::Strict);
    println!("{:?}", r);
    // CheckResult { burner: true, domain: Some("duck.com"), list: Some(Graylist), reason: "graylisted-strict" }
}
```

### Runtime overrides

```rust
use is_burner_email::{add_to_blacklist, add_to_whitelist};

add_to_blacklist("badactor.example");
add_to_whitelist("our-corporate-domain.example");
```

Whitelist always wins over blacklist. Runtime mutations are guarded by a
package-level `Mutex` for thread safety.

## CLI

```sh
cargo install is-burner-email

burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

burner user@duck.com --strict --json
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## License

MIT
