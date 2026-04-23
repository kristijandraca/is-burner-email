plugins {
    kotlin("jvm")
    application
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":lib"))
}

application {
    mainClass.set("io.github.kristijandraca.isburneremail.cli.MainKt")
    applicationName = "burner"
}
