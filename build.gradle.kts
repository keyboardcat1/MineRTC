plugins {
    id("java")
}

group = "io.github.keyboardcat1.minertc"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    testImplementation(platform("org.junit:junit-bom:5.9.1"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    compileOnly("io.papermc.paper:paper-api:1.19.3-R0.1-SNAPSHOT")
    implementation("org.eclipse.jetty:jetty-server:11.0.14")
    implementation("org.eclipse.jetty.websocket:websocket-jetty-server:11.0.14")
    implementation("org.eclipse.jetty.websocket:websocket-jetty-api:11.0.14")

}

tasks.test {
    useJUnitPlatform()
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(17))
}