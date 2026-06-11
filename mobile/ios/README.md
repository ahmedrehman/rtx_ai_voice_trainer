# AI Voice Trainer iOS

Native SwiftUI app for iPhone and iPad.

This app is the native iOS/iPadOS client for the existing AI Voice Trainer backend. It does not use a WebView and it does not contain provider API keys.

## Open

```bash
open mobile/ios/AITrainer.xcodeproj
```

The target is `AITrainer`.

## TestFlight Build

Use Xcode:

1. Open `mobile/ios/AITrainer.xcodeproj`.
2. Select the `AITrainer` target.
3. In `Signing & Capabilities`, select the paid Apple Developer team.
4. Keep the bundle identifier:

```text
ch.rehman.rtx-ai-voicetrainer
```

5. Increase the build number in `General -> Identity`.
6. Run `Product -> Clean Build Folder`.
7. Run `Product -> Archive`.
8. In Organizer, use `Distribute App -> TestFlight` or `Distribute App -> App Store Connect -> Upload`.

The TestFlight app record currently uses:

```text
App name: LingoCorrect silent AI
Bundle ID: ch.rehman.rtx-ai-voicetrainer
SKU: ch.rehman.rtx-ai-voicetrainer
```

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

The voice path follows the web V2 strategy:

```text
native WAV voice pack -> /api/voice-agent/voice-turn-stream -> SSE text/audio events -> native playback gate
```

The debug screen also has an exact app-audio diagnostic:

1. Record the exact native voice pack.
2. Play the exact bytes locally.
3. Send the exact bytes through `/api/voice-agent/audio-roundtrip`.
4. Play the server echo.
5. Send the same bytes through `/api/voice-agent/voice-turn-stream`.
6. Play the returned AI audio.

## Native Notes

- SwiftUI UI, no `WKWebView`.
- iPhone and iPad support through `TARGETED_DEVICE_FAMILY = 1,2`.
- Microphone permission and audio session are native.
- Listen records one native voice pack; turning Listen off sends it to the V2 voice stream endpoint.
- Speak toggles only gate playback.
- Green correction-mode responses are written to chat but are not auto-spoken.
- The app follows the web V2 path: native audio pack -> `/api/voice-agent/voice-turn-stream` -> native playback gate.

## Manual Test Checklist

Use TestFlight or a local Xcode run:

1. Open the app and allow microphone access.
2. Open `Debug`.
3. Use the microphone meter and confirm it moves when speaking.
4. Use `Exact App Audio -> Record exact pack`, speak, then `Stop`.
5. Tap `Play exact pack` and confirm the captured voice is clear.
6. Tap `Send exact server echo`, then `Play server echo`.
7. Tap `Send exact AI stream`, then `Play exact AI response`.
8. In `Trainer`, turn `Listen` on, speak, turn `Listen` off, and confirm a response appears.

## Known Limitations

- Listening is currently manual: `Listen on` starts recording and `Listen off` sends the voice pack.
- The next improvement should mirror the web V2 auto voice-pack loop: detect voice, detect trailing silence, send automatically, then resume listening.
- Store release still needs production metadata such as privacy policy, screenshots, app privacy answers, and EU trader status.
