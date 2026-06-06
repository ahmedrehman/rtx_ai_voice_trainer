# Voice Trainer Library

Reusable core for a silent-first voice trainer.

This folder is the package boundary. The React app and server implementation should use these types and helpers instead of hard-coding voice trainer behavior in the UI.

## Purpose

The library defines:

- voice implementation choices
- shared settings
- correction request/response contracts
- audio turn request/response contracts
- browser audio helpers

It does not own UI design, persistence, or provider secrets.

## Voice Implementations

```ts
type VoiceImplementation = "audio-ai" | "chained" | "dummy";
```

### `audio-ai`

Direct speech/audio AI path:

```text
user audio -> audio-capable AI -> text + AI audio
```

Use this to test whether a voice model can listen and answer with audio in one provider call.

### `chained`

Controlled app path:

```text
user audio -> transcription -> correction JSON/text -> provider AI voice audio
```

This is the safest MVP path because the app decides exactly when to speak.

### `dummy`

Browser fallback path:

```text
text -> browser speechSynthesis
```

Use only for device/browser checks. This is not the real product voice.

## Server Contract

A consuming server should provide:

```text
POST /api/transcribe
POST /api/correct
POST /api/speak
POST /api/audio-turn
```

The current app implements those routes in:

```text
app/src/localServer.ts
app/src/server/http.ts
```

## Persistence

The library does not persist data.

The app/server decides how to store:

- settings
- recent chat history
- debug events
- provider cost events
- user/session records

## Public Helpers

```ts
voiceImplementationOptions
voiceImplementationLabel(id)
blobToBase64(blob)
base64ToAudioBlob(audioBase64, format)
```

## Next Package Step

To turn this into a real npm package later:

1. Move `src/voiceTrainer` to `packages/voice-trainer/src`.
2. Add `packages/voice-trainer/package.json`.
3. Export browser helpers and server contracts from `index.ts`.
4. Make the app import from `@rtx-ai/voice-trainer`.

