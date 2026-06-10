plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "net.lernspass.aivoicetrainer"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.lernspass.aivoicetrainer"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        create("release") {
            val storeFilePath = providers.environmentVariable("AI_VOICE_TRAINER_UPLOAD_STORE_FILE").orNull
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
            }
            storePassword = providers.environmentVariable("AI_VOICE_TRAINER_UPLOAD_STORE_PASSWORD").orNull
            keyAlias = providers.environmentVariable("AI_VOICE_TRAINER_UPLOAD_KEY_ALIAS").orNull
            keyPassword = providers.environmentVariable("AI_VOICE_TRAINER_UPLOAD_KEY_PASSWORD").orNull
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("local") {
            dimension = "environment"
            applicationIdSuffix = ".local"
            versionNameSuffix = "-local"
            buildConfigField("String", "BACKEND_BASE_URL", "\"http://10.0.2.2:5173\"")
            resValue("string", "app_name", "AI Voice Trainer Local")
        }

        create("prod") {
            dimension = "environment"
            buildConfigField("String", "BACKEND_BASE_URL", "\"https://aitutor.lernspass.net\"")
            resValue("string", "app_name", "AI Voice Trainer")
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }

        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releaseStoreFile = providers.environmentVariable("AI_VOICE_TRAINER_UPLOAD_STORE_FILE").orNull
            if (!releaseStoreFile.isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
