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

For local phone testing, set `backendBaseUrl` in `AppConfig.kt` to the LAN URL printed by the local server.
