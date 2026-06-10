# AI Voice Trainer Android

Native Android app for AI Voice Trainer.

## Design Direction

- Kotlin
- Jetpack Compose
- Material 3
- Light native Android look
- No WebView for the main app
- No OpenAI API key in the app

## Backend

The app is prepared to call the additive Android backend routes:

```text
GET  /api/androidservice/health
POST /api/androidservice/text-chat
POST /api/androidservice/realtime-client-secret
POST /api/androidservice/audio-roundtrip
```

Build variants choose the backend URL:

- `localDebug` uses `http://10.0.2.2:5173` for Android emulator testing.
- `prodDebug` and `prodRelease` use `https://aitutor.lernspass.net`.

For testing on a physical phone against a local server, change the `local` flavor `BACKEND_BASE_URL` in `app/build.gradle.kts` to the LAN URL printed by the local server.

## Store

See `STORE_READINESS.md` for release signing, Play artifact, metadata, and privacy notes.
