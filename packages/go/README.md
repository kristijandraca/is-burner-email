# is-burner-email (Go)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists embedded at compile time via `go:embed`.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- Go 1.22+.

## Install

```sh
go get github.com/kristijandraca/is-burner-email/packages/go
```

## Usage

```go
package main

import (
    "fmt"

    burner "github.com/kristijandraca/is-burner-email/packages/go"
)

func main() {
    fmt.Println(burner.IsBurner("user@mailinator.com", burner.ModeNormal)) // true
    fmt.Println(burner.IsBurner("user@gmail.com", burner.ModeNormal))     // false
    fmt.Println(burner.IsBurner("user@duck.com", burner.ModeNormal))      // false
    fmt.Println(burner.IsBurner("user@duck.com", burner.ModeStrict))      // true

    r := burner.Check("user@duck.com", burner.ModeStrict)
    fmt.Printf("%+v\n", r)
    // {Burner:true Domain:duck.com List:graylist Reason:graylisted-strict}
}
```

### Runtime overrides

```go
burner.AddToBlacklist("badactor.example")
burner.AddToWhitelist("our-corporate-domain.example")
```

Whitelist always wins over blacklist. Runtime mutations use a package-level `sync.RWMutex` for thread safety.

## CLI

```sh
go install github.com/kristijandraca/is-burner-email/packages/go/cmd/burner@latest

burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

burner user@duck.com --strict --json
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## License

MIT
