# mod_ai_calls

Server-side AI call module.

## Public Methods

- `callOpenAiCorrectionJson(config, request)`
  - Calls OpenAI Responses API.
  - Returns `{ rawText, rawResponse }`.
  - Used for structured correction JSON.

- `callOpenAiTranscription(config, body, contentType?)`
  - Calls OpenAI audio transcription.
  - Input is multipart/form-data body.
  - Returns `{ text }`.

- `callOpenAiSpeech(config, request)`
  - Calls OpenAI speech/audio output.
  - Input is text.
  - Returns `{ body, contentType }` audio stream.

- `callOpenAiAudioTurn(config, request)`
  - Calls audio-in/audio-out model.
  - Input is base64 audio.
  - Returns `{ model, text, audioBase64, audioFormat }`.

- `extractResponsesText(data)`
  - Extracts text from Responses API payload.

## Config

```ts
type AiCallConfig = {
  openAiApiKey?: string;
};
```

## Requests

```ts
type AiCorrectionRequest = {
  model?: string;
  systemPrompt: string;
  userPayload: unknown;
};
```

```ts
type AiSpeechRequest = {
  text: string;
  voice?: string;
  languageName?: string;
  style?: string;
};
```

```ts
type AiAudioTurnRequest = {
  audioBase64: string;
  audioFormat?: string;
  voice?: string;
  prompt: string;
};
```

## Used By

- `src/server/providerModules.ts`
- `src/server/http.ts`
- `src/localServer.ts`

## Rule

No browser code imports this module.

