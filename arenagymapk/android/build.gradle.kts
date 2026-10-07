allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Algunos plugins (flutter_image_compress_common, flutter_timezone) traen su
// propio build.gradle con compileOptions de Java y jvmTarget de Kotlin
// desalineados entre sí (ej. Java 11 vs Kotlin 1.8), lo que falla con
// versiones recientes de Gradle/Kotlin que validan esa consistencia. En vez
// de parchear cada plugin, se fuerza el mismo target (17, igual que
// android/app/build.gradle.kts) en todos los subproyectos después de que
// cada uno ya se evaluó.
subprojects {
    // :app ya fija su propio compileOptions/jvmTarget en build.gradle.kts
    // (y evaluationDependsOn(":app") de arriba fuerza que :app se evalúe
    // antes que el resto) -- para cuando este bloque llega a :app, ya está
    // evaluado, y afterEvaluate sobre un proyecto ya evaluado falla. No
    // hace falta de todas formas: el override es solo para los plugins.
    if (path == ":app") return@subprojects

    afterEvaluate {
        extensions.findByType<com.android.build.gradle.BaseExtension>()?.apply {
            compileOptions {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
            }
        }
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
