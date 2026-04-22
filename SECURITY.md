# Security Policy

## Supported versions

Only the latest published minor version receives security updates.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Do not file a public GitHub issue for security vulnerabilities.**

Please use GitHub's private vulnerability reporting:

→ https://github.com/kristijandraca/is-burner-email/security/advisories/new

You can expect:

- An acknowledgement within 72 hours
- A patch or mitigation plan within 14 days for confirmed issues
- Public disclosure coordinated with you after a fix is available

## Scope

**In scope**

- The published npm package `is-burner-email`
- The CI/CD workflows that produce the published artifacts (`update-lists.yml`, `publish.yml`)

**Out of scope** — please use a regular issue, not a security advisory:

- Missing or incorrect entries in the domain lists (not a security issue — use the appropriate issue template)
- Vulnerabilities in upstream domain-list sources (report to them directly)
- Vulnerabilities in dev-only dependencies that do not ship to consumers
