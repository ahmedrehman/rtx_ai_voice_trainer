# Voice Trainer Server Implementation Contract

The reusable library defines contracts. A server implementation provides provider access, persistence, and management.

## Responsibilities

Server implementation owns:

- API keys and provider secrets
- transcription calls
- correction calls
- provider voice generation
- direct audio AI turns
- cost logging
- user/session persistence
- debug event persistence

UI owns:

- controls
- rendering
- browser microphone capture
- audio playback
- showing debug state

## Required Routes

### `POST /api/transcribe`

Input:

`multipart/form-data` with audio file.

Output:

```json
{ "text": "transcribed text" }
```

### `POST /api/correct`

Input:

Correction request.

Output:

Structured correction JSON plus debug data.

### `POST /api/speak`

Input:

```json
{
  "providerId": "openai",
  "text": "short answer",
  "voice": "coral",
  "languageName": "French",
  "style": "short correction, calm teacher"
}
```

Output:

Audio file response.

### `POST /api/audio-turn`

Input:

```json
{
  "providerId": "openai",
  "audioBase64": "...",
  "audioFormat": "wav",
  "voice": "coral",
  "settings": {}
}
```

Output:

```json
{
  "model": "gpt-audio",
  "text": "{...}",
  "audioBase64": "...",
  "audioFormat": "wav"
}
```

