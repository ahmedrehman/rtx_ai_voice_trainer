# Android Store Readiness

## Build Variants

- Play package id: `rtx.apps.rehmani.aivoicetrainer`
- `localDebug`: emulator/local testing. Uses `http://10.0.2.2:5173`.
- `prodDebug`: production backend debug testing.
- `prodRelease`: Play Store build. Uses `https://aitutor.lernspass.net`.

## Release Signing

Do not commit keystores or passwords.

Set these environment variables before building `prodRelease`:

```text
AI_VOICE_TRAINER_UPLOAD_STORE_FILE=C:\path\to\upload-keystore.jks
AI_VOICE_TRAINER_UPLOAD_STORE_PASSWORD=...
AI_VOICE_TRAINER_UPLOAD_KEY_ALIAS=...
AI_VOICE_TRAINER_UPLOAD_KEY_PASSWORD=...
```

Build the Play artifact from Android Studio or with:

```bash
./gradlew :app:bundleProdRelease
```

This repository does not commit the upload keystore. The release build is only Play-uploadable after the signing environment variables are set.

## Play Console Assets

Metadata and listing image assets are under:

```text
apps/android/fastlane/metadata/android/en-US
```

Included:

- title
- short description
- full description
- changelog for version code 1
- 512 x 512 icon
- 1024 x 500 feature graphic
- phone screenshots

## Privacy And Data Safety

The Android app:

- requests microphone permission for speech practice
- sends microphone audio or typed text to the configured backend only when the user uses trainer actions
- does not store the OpenAI API key
- does not include advertising SDKs
- does not include third-party analytics SDKs

Publish a public privacy policy URL before submitting to Play.
