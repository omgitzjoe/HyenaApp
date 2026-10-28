import java.net.URI

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val apiBaseUrl = providers.gradleProperty("HYENA_API_BASE_URL")
    .orElse("https://hyena-api-np3j.onrender.com/").get()
val apiUri = URI(apiBaseUrl)
require(apiUri.scheme in listOf("http", "https") && apiUri.host != null &&
    apiUri.userInfo == null && apiUri.query == null && apiUri.fragment == null && apiBaseUrl.endsWith("/")) {
    "HYENA_API_BASE_URL must be an HTTP(S) base URL ending in / without credentials, query, or fragment."
}
val quotedApiBaseUrl = "\"" + apiBaseUrl.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

android {
    namespace = "com.example.hyenaapp"
    compileSdk {
        version = release(37) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        buildConfigField("String", "API_BASE_URL", quotedApiBaseUrl)
        applicationId = "com.example.hyenaapp"
        minSdk = 28
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
        buildConfig = true
        compose = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    implementation(libs.retrofit.core)
    implementation(libs.retrofit.gson)
}