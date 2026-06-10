# Native iOS and Android App Plan

This document describes what the native Android and iOS apps must implement so they behave like the web app strategy, without using a WebView.

## Goal

Build native iOS and Android apps for AI Voice Trainer with:

- native UI on each platform
- one shared backend API
- no OpenAI API key inside the app
- persistent realtime audio for live conversation
- a native debug page for microphone, speaker, WebRTC, and server roundtrip testing
- the same app rules for free chat, correction mode, signal levels, listen, and speak

## Repository Layout

Keep web, backend, and native apps in one GitHub repository so prompts, app rules, and API contracts do not drift apart.

Recommended layout:

```text
app/                  # existing web app and Cloudflare backend
mobile/
  android/            # native Android app
  ios/                # native iOS app
  contracts/          # copied API contracts, event names, signal rules
plan/
  native_mobile_apps.md
```

Do not put native API keys in `mobile/`. The apps only call the server.

## Shared Communication Strategy

### Live AI Mode

Use the same strategy as the WebRTC reference:

1. Native app opens the microphone once.
2. Native app calls backend:
   `POST /api/voice-agent/realtime-client-secret`
3. Backend uses `OPENAI_API_KEY` and returns a short-lived realtime client secret.
4. Native app creates a WebRTC peer connection to OpenAI Realtime.
5. Native app sends microphone audio through the WebRTC audio track.
6. Native app receives AI audio as the remote audio track.
7. Listen on/off must only enable or disable the outgoing audio track.
8. Do not stop and restart the microphone for every turn.

Equivalent rule:

```text
listen off -> microphone stays open if session is active, outgoing track disabled
listen on  -> outgoing track enabled
AI speaking -> outgoing track disabled to avoid feedback
```

### Debug Roundtrip Mode

The debug page also needs a server audio roundtrip:

1. Record a short microphone sample locally.
2. Send it to:
   `POST /api/voice-agent/audio-roundtrip`
3. Server returns the same audio.
4. Native app plays returned audio immediately.

This mode is only for checking whether microphone recording and playback are broken. It is not the correction flow.

## Shared App Rules

These are app rules, not AI responsibilities:

- Chat text is always written.
- Speak off means no automatic audio.
- Speak on means audio is allowed only by level.
- Green must not be spoken in correction mode.
- Below selected speak level must not be spoken.
- Free chat uses a normal chat prompt and answers questions.
- Correction mode corrects or confirms, it must not answer/translate the practice phrase.
- Pronunciation/accent can be at most low severity.
- Slight understandable pronunciation should be treated as OK.
- Red is only for real grammar mistakes or severe meaning mistakes.

Correction mode signal mapping:

```text
green  -> OK / no useful correction
yellow -> small pronunciation/accent clarity improvement
orange -> vocabulary or meaning problem
red    -> real grammar mistake or severe meaning mistake
```

Speak gate:

```text
if speakOff -> do not play AI audio
if freeChatOn and speakOn -> play AI audio
if correctionMode and signal green -> do not play AI audio
if correctionMode and signal level < selectedSpeakLevel -> do not play AI audio
if correctionMode and signal level >= selectedSpeakLevel -> play AI audio
```

## Android Native App

### Technology

Use:

- Kotlin
- Jetpack Compose
- Material 3
- Android WebRTC library
- OkHttp for backend calls
- Kotlin coroutines / Flow for state

Avoid:

- WebView for the main app
- restarting microphone between listen/speak changes
- storing OpenAI API keys in the app

### Android Permissions

Required:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

Runtime permission:

```text
RECORD_AUDIO
```

### Android Audio Session

On app start or first listen action:

- request microphone permission
- set communication audio mode while realtime is active
- prefer speaker output unless headset/Bluetooth is connected
- keep one audio capture pipeline alive during the session

Important Android behavior:

```text
Use one WebRTC audio track.
Toggle audioTrack.setEnabled(true/false).
Do not recreate AudioRecord or PeerConnection on every listen/speak switch.
```

### Android Main Screen

Native look with Compose:

- top app bar: AI Voice Trainer
- topic picker
- segmented/toggle controls:
  - Listen
  - Speak
  - Free chat
- speak level picker shown only when Speak is on
- chat list
- small signal lamp in correction mode
- input text field
- send button

Do not show instructional text in the app. The screen should be usable, not explanatory.

### Android Debug Page

Create a native debug screen with these panels:

- Backend
  - button: test backend reachable
  - button: request realtime client secret
  - show redacted response
- Microphone
  - button: request mic permission
  - button: start mic level monitor
  - live RMS meter
  - voice/no voice indicator
- Speaker
  - button: play local test tone
  - show playback success/error
- WebRTC AI
  - button: connect realtime
  - button: disconnect
  - toggle: outgoing mic track enabled
  - show peer state
  - show data channel state
  - show remote audio state
  - show realtime event log
- Server Roundtrip
  - button: record sample
  - button: send to server roundtrip
  - button: play returned audio
  - show request size, response size, content type

## iOS Native App

### Technology

Use:

- Swift
- SwiftUI
- native navigation
- WebRTC iOS framework
- URLSession for backend calls
- async/await or Combine for state

Avoid:

- WKWebView for the main app
- restarting microphone between listen/speak changes
- storing OpenAI API keys in the app

### iOS Permissions

Add to `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>AI Voice Trainer needs microphone access for speech practice.</string>
```

If recording files for debug:

```xml
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition is optional for debug transcription tests.</string>
```

Only add speech recognition permission if the native app actually uses Apple speech recognition. The main realtime path should not depend on it.

### iOS Audio Session

Before starting realtime:

```text
AVAudioSession category: playAndRecord
mode: voiceChat
options: defaultToSpeaker, allowBluetooth, allowBluetoothA2DP
activate session
```

Handle:

- interruption begin/end
- route changes
- microphone permission denied
- app background/foreground

Important iOS behavior:

```text
Use one WebRTC audio track.
Toggle audioTrack.isEnabled true/false.
Do not recreate AVAudioSession or PeerConnection on every listen/speak switch.
```

### iOS Main Screen

Native look with SwiftUI:

- `NavigationStack`
- native toolbar/title
- `Picker` for topic
- `Toggle` for Listen
- `Toggle` for Speak
- `Toggle` for Free chat
- `Picker` for speak level when Speak is on
- `List` or scroll view for chat messages
- small signal indicator in correction mode
- text input and send button

Use iOS-native spacing, typography, toggles, and pickers.

### iOS Debug Page

Create a native debug screen with sections:

- Backend
  - request realtime client secret
  - show redacted JSON
- Microphone
  - request permission
  - start mic monitor
  - show RMS meter
  - show route/input device
- Speaker
  - play local tone
  - show route/output device
- WebRTC AI
  - connect realtime
  - disconnect
  - toggle outgoing mic track
  - show peer state
  - show remote audio active/inactive
  - show realtime events
- Server Roundtrip
  - record sample
  - upload to server roundtrip
  - play returned audio
  - show content type and byte sizes

## Native State Model

Both apps should keep the same state names:

```text
listenOn
speakOn
freeChatOn
speakLevel
signal
sessionState
peerState
dataChannelState
outgoingMicEnabled
outgoingMicReason
micLevel
micVoiceDetected
aiSpeaking
remoteAudioMuted
```

Recommended session states:

```text
idle
starting
connected
listening
playing
error
```

Outgoing mic reasons:

```text
listen_off
speak_feedback
enabled
```

## Backend Contract

The native apps should use these existing endpoints:

```text
POST /api/voice-agent/realtime-client-secret
POST /api/voice-agent/audio-roundtrip
POST /api/voice-agent/text-chat
```

Realtime client secret request:

```json
{
  "model": "gpt-realtime",
  "voice": "marin",
  "instructions": "..."
}
```

The server must create the client secret using `OPENAI_API_KEY`. The native app must never receive the real API key.

## Debug Success Checklist

A native debug page is ready when:

- microphone permission can be requested and displayed
- mic RMS meter moves when speaking
- local speaker test plays
- server roundtrip records, uploads, downloads, and plays audio
- realtime client secret request succeeds
- WebRTC peer connects
- outgoing mic track can be toggled without reopening microphone
- remote AI audio plays
- event log shows realtime events
- app does not beep or restart audio on listen/speak switches

## Main App Success Checklist

The native app is ready when:

- app starts directly into the trainer UI
- no WebView is used
- user can type and receive chat text
- user can start realtime voice
- microphone is opened once per active session
- listen toggle only controls outgoing track enabled state
- speak toggle only controls playback gate
- green correction writes chat but does not speak
- selected speak level controls only audio playback
- free chat answers questions normally
- correction mode corrects briefly and does not translate/answer practice phrases
- API key remains server-side

## First Implementation Order

1. Build native shell and navigation.
2. Add backend config and health/client-secret call.
3. Add microphone permission and mic level monitor.
4. Add local speaker test.
5. Add server audio roundtrip debug.
6. Add WebRTC connect/disconnect.
7. Add outgoing mic track enable/disable.
8. Add remote audio playback.
9. Add main chat UI.
10. Add app speak-level gate.
11. Add event log and error display.
12. Test on real iPhone and real Android phone over HTTPS.

## Do Not Do

- Do not put the OpenAI API key in mobile apps.
- Do not use WebView as the native app.
- Do not create separate prompt copies for iOS and Android.
- Do not let iOS, Android, and web drift into different signal rules.
- Do not restart microphone every time Listen changes.
- Do not use debug roundtrip as the correction flow.
- Do not let AI decide app playback rules.
