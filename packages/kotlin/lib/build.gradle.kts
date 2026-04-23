import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.KotlinJvm
import com.vanniktech.maven.publish.SonatypeHost

plugins {
    kotlin("jvm")
    `java-library`
    id("com.vanniktech.maven.publish")
}

base {
    archivesName.set("is-burner-email")
}

kotlin {
    jvmToolchain(17)
    explicitApi()
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation(platform("org.junit:junit-bom:5.11.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}

// build-lists.ts copies all four data files into src/main/resources/, but
// extra-blacklist.txt is a source-control artifact — the library only reads
// blacklist/whitelist/graylist. Exclude it from the published JAR.
tasks.processResources {
    exclude("extra-blacklist.txt")
}

mavenPublishing {
    publishToMavenCentral(SonatypeHost.CENTRAL_PORTAL, automaticRelease = true)
    signAllPublications()

    coordinates(
        groupId = project.group.toString(),
        artifactId = "is-burner-email",
        version = project.version.toString(),
    )

    configure(KotlinJvm(javadocJar = JavadocJar.Empty(), sourcesJar = true))

    pom {
        name.set("is-burner-email")
        description.set("Fast, offline burner / disposable email detection with three-list (blacklist/whitelist/graylist) classification.")
        url.set("https://github.com/kristijandraca/is-burner-email")
        licenses {
            license {
                name.set("MIT")
                url.set("https://opensource.org/licenses/MIT")
            }
        }
        developers {
            developer {
                id.set("kristijandraca")
                name.set("kristijandraca")
            }
        }
        scm {
            url.set("https://github.com/kristijandraca/is-burner-email")
            connection.set("scm:git:https://github.com/kristijandraca/is-burner-email.git")
            developerConnection.set("scm:git:ssh://git@github.com/kristijandraca/is-burner-email.git")
        }
    }
}
