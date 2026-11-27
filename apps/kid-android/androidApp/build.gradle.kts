import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}

dependencies {
    implementation(project(":shared"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.work.runtime)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.compose.runtime)
    implementation(libs.compose.uiToolingPreview)
    debugImplementation(libs.compose.uiTooling)
}

// Release builds talk to the deployed API (override with -Pbwl.apiUrl=https://... or BWL_API_URL env).
val releaseApiUrl: String = (findProperty("bwl.apiUrl") as String?)?.takeIf { it.isNotBlank() }
    ?: System.getenv("BWL_API_URL")?.takeIf { it.isNotBlank() }
    ?: "https://birthday-wish-list-api.vercel.app"

android {
    namespace = "com.guykadosh22.kids_birth_day_gift_list"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.guykadosh22.kids_birth_day_gift_list"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "/META-INF/INDEX.LIST"
        }
    }
    buildTypes {
        debug {
            // the emulator reaches the PC's localhost through 10.0.2.2
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:4000\"")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiUrl\"")
            isMinifyEnabled = false
            // Unsigned-by-default release is signed with the debug key so CI can produce an installable APK.
            // Replace with a real upload key before publishing to Google Play.
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}
