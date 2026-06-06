# Feasibility Test Plan

## Goal

Prove fast if the app can:

1. Listen to the user.
2. Transcribe voice to text.
3. Send text to AI.
4. Receive structured AI correction.
5. Generate an AI voice answer.
6. Play that AI voice in the browser.

Design cleanup comes later. This plan is only for making the core voice loop testable.

## Core Rule

The AI does not decide when to speak.

The app decides when speech output is allowed.

AI/provider may generate voice only when:

- `speak_enabled` is true, and
- `answer_allowed` is true.

## Main Labels

Use these short UI labels:

- `LISTEN`
- `SPEAK`
- `SEND`
- `STOP`
- `TEST LISTEN`
- `TEST SPEAK`
- `DEBUG`
- `SETTINGS`

## Main Screens

### Chat

Simple main screen:

- large chat window
- bottom text input
- `LISTEN` toggle
- `SPEAK` toggle
- `SEND` button
- top burger menu for navigation

### Debug

Debug must repeat the same test controls:

- `LISTEN`
- `SPEAK`
- `SEND`
- `TEST LISTEN`
- `TEST SPEAK`
- `STOP`

Debug must show:

- browser capability info
- microphone errors
- audio recording errors
- transcription request/result
- AI correction request/result
- AI voice request/result
- audio playback errors
- last 5 app events
- last 5 AI events

### Settings

Settings can be basic:

- correction provider
- transcription provider
- voice provider
- voice implementation:
  - `audio-ai`
  - `chained`
  - `dummy`
- language/topic
- keyword
- prompts

The selected voice implementation controls the normal `SPEAK` and `TEST SPEAK` path.
Debug still exposes separate buttons to test each implementation directly.

## Library Boundary

Reusable voice-trainer functionality lives in:

```text
app/src/voiceTrainer
```

This folder is shaped like an npm package boundary. It owns:

- public types
- voice implementation options
- request/response contracts
- browser audio helpers
- documentation

The UI and server are one implementation that consumes this library.

Later package move:

```text
packages/voice-trainer/src
```

The app should then import it as an npm-style package.

## State Names

Use these app state names:

```ts
type VoiceMode = {
  listen_enabled: boolean;
  speak_enabled: boolean;
  is_listening: boolean;
  is_transcribing: boolean;
  is_correcting: boolean;
  is_generating_voice: boolean;
  is_playing_voice: boolean;
};
```

## Request Fields

### Correction Request

Use this shape from app to server:

```json
{
  "provider_id": "openai",
  "text": "je suis aller au marche",
  "answer_allowed": true,
  "speak_enabled": true,
  "trigger": "button",
  "history": [],
  "settings": {
    "language_name": "French",
    "recognition_lang": "fr-FR",
    "topic": "daily conversation",
    "keyword": "computer"
  }
}
```

### Correction Response

Use this shape from server to app:

```json
{
  "text_original": "je suis aller au marche",
  "text_clean": "je suis aller au marche",
  "text_corrected": "je suis alle au marche",
  "message": "Je suis alle au marche. Use alle after etre.",
  "hint": "Use the past participle after etre.",
  "keyword_on_sent": false,
  "keyword_off_sent": false,
  "answer_allowed": true,
  "speak_allowed": true,
  "trigger": "button",
  "signal": "improvement",
  "notes": ["Use the past participle after etre."]
}
```

## Fixed Values

### `trigger`

Allowed values:

- `silent`
- `button`
- `keyword_on`
- `keyword_off`
- `manual_text`

### `signal`

Allowed values:

- `none`
- `improvement`
- `error`

### `provider_id`

Allowed values:

- `browser-demo`
- `openai`
- `deepgram-elevenlabs`
- `azure`
- `google`

## Voice Request

AI voice is provider-generated audio, not browser text-to-speech.

Use this shape from app/server correction flow to server voice endpoint:

```json
{
  "provider_id": "openai",
  "text": "Je suis alle au marche. Use alle after etre.",
  "voice": "coral",
  "language_name": "French",
  "style": "short correction, calm teacher"
}
```

The server returns an audio file, for example MP3.

The browser plays the returned audio.

## Dummy Options

Dummy/browser options are allowed only for testing.

They must be clearly labeled:

- `browser-demo`
- `dummy listen`
- `dummy speak`

Dummy speak can use browser speech synthesis, but it is not the real product voice.

## Fast Test Order

### Test 1: Browser Capability

Show on Debug:

- secure context yes/no
- microphone API yes/no
- media recorder yes/no
- speech recognition yes/no
- audio playback yes/no

### Test 2: Speak Only

Press `TEST SPEAK`.

Expected:

- server calls voice provider
- server returns audio
- browser plays audio
- Debug shows success or exact error

### Test 3: Listen Only

Press `TEST LISTEN`.

Expected:

- browser asks microphone permission
- records short audio
- server transcribes audio
- Debug shows transcript or exact error

### Test 4: Chat Text

Type a bad French sentence and press `SEND`.

Expected:

- server returns structured correction JSON
- chat shows corrected text
- Debug shows full request and response

### Test 5: Full Voice Loop

Turn on:

- `LISTEN`
- `SPEAK`

Speak:

```text
computer je suis aller au marche
```

Expected:

- audio is recorded
- speech is transcribed
- keyword is detected
- correction JSON is returned
- AI voice audio is generated
- browser plays the AI voice answer

## Implementation Steps

1. Repair current partial SPEAK implementation so browser speech synthesis is not the main voice path.
2. Add `POST /api/speak`.
3. Add OpenAI voice generation on the server.
4. Add browser audio playback from returned audio blob.
5. Add `TEST SPEAK` to Debug.
6. Add `TEST LISTEN` to Debug.
7. Log all technical errors to Debug.
8. Keep old UI mostly intact until feasibility is proven.
9. Redesign the app after the voice loop works.

## Success Definition

Feasibility is proven when:

- typed text correction works
- microphone transcription works on at least one desktop browser
- AI voice audio generation works
- browser playback works
- failures on iOS/Android show exact Debug errors
