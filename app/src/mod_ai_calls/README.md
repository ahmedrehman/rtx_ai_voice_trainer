# mod_ai_calls

- server-side AI calls only
- no browser imports
- API keys stay server-side

## methods

- `callOpenAiTranscription(config, body, contentType?)`
  - input: browser microphone audio upload
  - body: `multipart/form-data`
  - output: `{ text }`
  - note: audio -> text

- `callOpenAiCorrectionJson(config, request)`
  - input: transcript text
  - input: `systemPrompt`
  - input: `taskPrompt`
  - input: `userPayload`
  - output: `{ rawText, rawResponse }`
  - output: `providerDebug.requestBody`
  - output: `providerDebug.responseJson`
  - note: text -> correction JSON

- `callOpenAiSpeech(config, request)`
  - input: correction/answer text
  - output: `{ body, contentType }`
  - note: text -> AI voice audio stream

- `callOpenAiAudioTurn(config, request)`
  - input: base64 microphone audio
  - output: `{ model, text, audioBase64, audioFormat }`
  - note: audio -> AI text + AI voice audio

- `extractResponsesText(data)`
  - input: Responses API JSON
  - output: text string
  - note: provider response -> raw text

## config

```ts
type AiCallConfig = {
  openAiApiKey?: string;
};
```

## request types

```ts
type AiCorrectionRequest = {
  model?: string;
  systemPrompt: string;
  taskPrompt: string;
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
