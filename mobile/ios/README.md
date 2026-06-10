# AI Voice Trainer iOS

Native SwiftUI app for iPhone and iPad.

## Open

```bash
open mobile/ios/AITrainer.xcodeproj
```

The target is `AITrainer`.

## Backend

The app calls the existing server. The default backend is:

```text
https://aitutor.lernspass.net
```

Change it in the app debug/settings screen when testing a local or staging server.

The app never stores an OpenAI API key. It only calls:

```text
POST /api/voice-agent/text-chat
POST /api/voice-agent/realtime-client-secret
POST /api/voice-agent/audio-roundtrip
GET  /api/providers
```

## Native Notes

- SwiftUI UI, no `WKWebView`.
- iPhone and iPad support through `TARGETED_DEVICE_FAMILY = 1,2`.
- Microphone permission and audio session are native.
- Listen toggles only gate outgoing audio state in the app model.
- Speak toggles only gate playback.
- Green correction-mode responses are written to chat but are not auto-spoken.
- The WebRTC boundary is isolated in `RealtimeSession.swift`; add the chosen WebRTC iOS framework there to complete live peer audio.

