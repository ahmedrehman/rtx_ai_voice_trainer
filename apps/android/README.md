# AI Voice Trainer Android

Native Android app for AI Voice Trainer.

## Status

- Native Kotlin app
- Jetpack Compose UI
- Material 3 light Android look
- No WebView for the main trainer app
- No OpenAI API key in the app
- Shared backend API with the web/PWA and iOS apps

Play package id:

```text
rtx.apps.rehmani.aivoicetrainer
```

## Project Layout

```text
apps/android/
  app/                         # Android app module
  fastlane/metadata/android/   # Play Store metadata and image assets
  gradle/wrapper/              # Gradle wrapper
  STORE_READINESS.md           # Play release checklist
  PRIVACY_POLICY_DRAFT.md      # Draft text for a public privacy policy
```

## Requirements

- Android Studio
- Android SDK Platform 35
- Android SDK Build Tools 35
- JDK 17 or newer

This machine is currently configured with:

```text
Android SDK: C:\Users\ahmed\AppData\Local\Android\Sdk
JDK:         C:\Program Files\Android\Android Studio\jbr
```

If Android Studio asks for the SDK path, select:

```text
C:\Users\ahmed\AppData\Local\Android\Sdk
```

## Build Variants

- `localDebug`
  - Debug build for emulator or local development.
  - Backend URL: `http://10.0.2.2:5173`
  - App id suffixes: `.local.debug`

- `prodDebug`
  - Debug build pointed at production backend.
  - Backend URL: `https://aitutor.lernspass.net`

- `prodRelease`
  - Release build for Google Play internal/preview testing.
  - Backend URL: `https://aitutor.lernspass.net`

The backend URLs are defined in:

```text
apps/android/app/build.gradle.kts
```

## Local Backend

Start the existing web/backend app:

```bash
cd C:\dev\rtx_ai_voice_trainer\app
npm run dev
```

The local Android emulator can reach the PC backend through:

```text
http://10.0.2.2:5173
```

For a physical phone on the same Wi-Fi network, use the LAN URL printed by the local server, for example:

```text
http://192.168.x.x:5173
```

Then temporarily change the `local` flavor `BACKEND_BASE_URL` in `apps/android/app/build.gradle.kts`.

## Backend Contract

The Android app uses additive Android routes so the existing web/PWA routes stay untouched:

```text
GET  /api/androidservice/health
POST /api/androidservice/text-chat
POST /api/androidservice/realtime-client-secret
POST /api/androidservice/audio-roundtrip
```

The app must never receive or store provider API keys. The server owns `OPENAI_API_KEY`.

## Build Commands

From this directory:

```bash
cd C:\dev\rtx_ai_voice_trainer\apps\android
```

Build local debug APK:

```bash
.\gradlew.bat :app:assembleLocalDebug
```

Output:

```text
apps/android/app/build/outputs/apk/local/debug/app-local-debug.apk
```

Build production release bundle:

```bash
.\gradlew.bat :app:bundleProdRelease
```

Output:

```text
apps/android/app/build/outputs/bundle/prodRelease/app-prod-release.aab
```

## Phone Testing

For direct USB testing:

1. Enable Developer Options on the phone.
2. Enable USB debugging.
3. Connect the phone to the PC.
4. Accept the USB debugging prompt on the phone.
5. In Android Studio, choose the phone as the target device.
6. Select `localDebug` or `prodDebug`.
7. Press Run.

For local backend testing on a real phone, use the PC LAN URL, not `10.0.2.2`.

## Google Play Preview Testing

Use Google Play Console internal testing for store-style preview installs.

1. Create the app in Play Console with package id:

   ```text
   rtx.apps.rehmani.aivoicetrainer
   ```

2. Generate a signed `prodRelease` Android App Bundle in Android Studio:

   ```text
   Build > Generate Signed App Bundle / APK > Android App Bundle > prodRelease
   ```

3. Upload the signed `.aab` to:

   ```text
   Testing > Internal testing > Create release
   ```

4. Add tester Google accounts.
5. Complete the required Play Console forms.
6. Roll out to internal testing.
7. Open the opt-in link on the Android phone and install from Google Play.

## Release Signing

Do not commit upload keys, keystores, or passwords.

Release signing can be configured with environment variables:

```text
AI_VOICE_TRAINER_UPLOAD_STORE_FILE=C:\path\to\upload-keystore.jks
AI_VOICE_TRAINER_UPLOAD_STORE_PASSWORD=...
AI_VOICE_TRAINER_UPLOAD_KEY_ALIAS=...
AI_VOICE_TRAINER_UPLOAD_KEY_PASSWORD=...
```

Without signing configuration, Gradle can produce an unsigned release bundle, but Google Play will not accept it.

## Store Assets

Play metadata and preview assets are stored under:

```text
apps/android/fastlane/metadata/android/en-US
```

Included:

- title
- short description
- full description
- version 1 changelog
- 512 x 512 icon
- 1024 x 500 feature graphic
- phone screenshots

## Privacy

The app requests microphone permission for speech practice.

The Android app sends typed text, selected practice settings, and microphone audio samples to the configured backend when the user uses trainer or debug features.

The app does not include advertising SDKs or third-party analytics SDKs.

Before Play submission, host the privacy policy text from:

```text
apps/android/PRIVACY_POLICY_DRAFT.md
```

at a public URL and enter that URL in Play Console.

## Related Docs

- `apps/android/STORE_READINESS.md`
- `apps/android/PRIVACY_POLICY_DRAFT.md`
- `plan/native_mobile_apps.md`
