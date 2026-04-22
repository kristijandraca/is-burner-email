# is-burner-email (C# / .NET)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists embedded at compile time via `EmbeddedResource`.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- Targets `netstandard2.0` (works on .NET Framework 4.6.1+ / .NET Core 2.0+ / .NET 5+) and `net8.0`.

## Install

```sh
dotnet add package Kristijandraca.IsBurnerEmail
```

## Usage

```csharp
using Kristijandraca.IsBurnerEmail;

IsBurnerEmail.IsBurner("user@mailinator.com");                              // true
IsBurnerEmail.IsBurner("user@gmail.com");                                   // false
IsBurnerEmail.IsBurner("user@duck.com");                                    // false (normal)
IsBurnerEmail.IsBurner("user@duck.com", IsBurnerEmail.ModeStrict);          // true

var r = IsBurnerEmail.Check("user@duck.com", IsBurnerEmail.ModeStrict);
// r.Burner == true
// r.Domain == "duck.com"
// r.List   == "graylist"
// r.Reason == "graylisted-strict"
```

### Runtime overrides

```csharp
IsBurnerEmail.AddToBlacklist("badactor.example");
IsBurnerEmail.AddToWhitelist("our-corporate-domain.example");
```

Whitelist always wins over blacklist. Runtime mutations are thread-safe.

## CLI

```sh
dotnet tool install --global Kristijandraca.IsBurnerEmail.Cli

burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

burner user@duck.com --strict --json

burner --stats
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## License

MIT
