# lib_client_voice_system

- client-side only
- browser APIs only
- no API keys
- no OpenAI calls
- every method returns `status`
- caller evaluates `status`
- caller writes debug item

## status

- `method`
- `ok`
- `phase`
- `startedAt`
- `finishedAt`
- `error`

## `SYSTEM_MICRO_TO_AUDIO`

- does: client microphone -> audio file
- input: `durationMs`
- output: `{ audio, mimeType, durationMs }`
- logs: start, done, error

## `SYSTEM_MEANINGFUL_AUDIO_CHUNK`

- does: client microphone -> useful audio chunk
- input: `maxDurationMs`, `silenceMs`
- output: `{ audio, mimeType, durationMs, chunkReason, browserSpeechText }`
- uses browser speech checker: yes, if available
- if browser speech checker exists:
  - stops on final speech
  - or stops after silence
- if browser speech checker is missing:
  - records until max duration
  - output reason: `no_speech_checker`
- note: no AI, no prompt, no correction

## `SYSTEM_AUDIO_TO_SPEAKER`

- does: audio file -> client speaker
- input: `{ audio }`
- output: `{ played }`
- logs: start, done, error

## `SYSTEM_TEXT_TO_AUDIO`

- does: text -> browser dummy speech
- input: `{ text, lang }`
- output: `{ spoken }`
- logs: start, error
- note: dummy browser speech only

## `SYSTEM_AUDIO_TO_TEXT`

- does: browser speech recognition -> text
- input: `{ lang }`
- output: `{ text }`
- logs: start, error
- note: browser speech recognition only

## config

```ts
type ClientVoiceConfig = {
  logger?: (event) => void;
};
```
