plugins {
    kotlin("jvm") version "2.1.21" apply false
    id("com.vanniktech.maven.publish") version "0.30.0" apply false
}

allprojects {
    group = "io.github.kristijandraca"
    version = "1.3.0"

    repositories {
        mavenCentral()
    }
}
