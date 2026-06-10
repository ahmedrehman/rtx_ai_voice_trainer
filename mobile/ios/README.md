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
POST /api/voice-agent/voice-turn-stream
POST /api/voice-agent/audio-roundtrip
GET  /api/providers
```

## Native Notes

- SwiftUI UI, no `WKWebView`.
- iPhone and iPad support through `TARGETED_DEVICE_FAMILY = 1,2`.
- Microphone permission and audio session are native.
- Listen records one native voice pack; turning Listen off sends it to the V2 voice stream endpoint.
- Speak toggles only gate playback.
- Green correction-mode responses are written to chat but are not auto-spoken.
- The app follows the web V2 path: native audio pack -> `/api/voice-agent/voice-turn-stream` -> native playback gate.
