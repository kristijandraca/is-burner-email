# is-burner-email (Kotlin / JVM)

Fast, offline detection of burner / disposable emails.

- **Offline.** Domain lists bundled as JVM resources, loaded via the classloader.
- **Zero runtime dependencies.**
- **Three lists.** `blacklist` (burners), `whitelist` (always allowed), `graylist` (email alias / forwarding services — blocked only in strict mode).
- JDK 17+. Usable from Kotlin and Java.

## Install

```kotlin
// build.gradle.kts
dependencies {
    implementation("io.github.kristijandraca:is-burner-email:1.3.7")
}
```

## Usage

```kotlin
import io.github.kristijandraca.isburneremail.IsBurnerEmail
import io.github.kristijandraca.isburneremail.Mode

IsBurnerEmail.isBurner("user@mailinator.com")                // true
IsBurnerEmail.isBurner("user@gmail.com")                     // false
IsBurnerEmail.isBurner("user@duck.com")                      // false (normal)
IsBurnerEmail.isBurner("user@duck.com", Mode.STRICT)         // true

val r = IsBurnerEmail.check("user@duck.com", Mode.STRICT)
// r.burner == true
// r.domain == "duck.com"
// r.list   == ListName.GRAYLIST
// r.reason == "graylisted-strict"
```

From Java:

```java
import io.github.kristijandraca.isburneremail.IsBurnerEmail;
import io.github.kristijandraca.isburneremail.Mode;

boolean burner = IsBurnerEmail.isBurner("user@duck.com", Mode.STRICT);
```

### Runtime overrides

```kotlin
IsBurnerEmail.addToBlacklist("badactor.example")
IsBurnerEmail.addToWhitelist("our-corporate-domain.example")
```

Whitelist always wins over blacklist. Runtime mutations are thread-safe.

## CLI

The CLI is packaged via the Gradle `application` plugin. From this directory:

```sh
./gradlew :cli:installDist
./cli/build/install/burner/bin/burner user@mailinator.com
# BURNER (blacklist): mailinator.com [blacklisted]

./cli/build/install/burner/bin/burner user@duck.com --strict --json

./cli/build/install/burner/bin/burner --stats
```

Exit codes: `0` clean, `1` burner, `2` invalid input.

## License

MIT
