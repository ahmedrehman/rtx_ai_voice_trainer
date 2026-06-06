# mod_ai_calls

- server-side only
- OpenAI calls only
- API key required
- no browser imports

## `DUMB_SPEACH_TO_TEXT_transcription`

- does: audio -> text
- input: microphone recording from browser
- input format: `multipart/form-data`
- output: `{ text }`
- prompts: none
- pronunciation feedback: no
- grammar correction: no
- meaning: dumb transcription only

## `PURE_TEXT_TO_TEXT_CORRECTION`

- does: text -> correction JSON
- input: transcript text
- input: settings
- input: recent text history
- input: system prompt
- input: task prompt
- output: correction JSON text
- hears original audio: no
- pronunciation feedback: no
- accent feedback: no
- meaning: text correction only

### system prompt

- file: `src/server/trainerLogic.ts`
- function: `buildSystemPrompt(settings)`
- contains:
  - trainer role
  - language/topic
  - JSON-only rule
  - output field names
  - allowed values
  - correction rules

### task prompt

- file: `src/server/providerModules.ts`
- function: `correctWithOpenAI`
- contains:
  - correct learner text
  - return JSON only
  - do not decide app state
  - do not add extra fields
  - keep notes short

## `DUMBB_TEXT_TO_SPEACH`

- does: text -> spoken AI audio
- input: correction/answer text
- output: audio stream
- prompt: none
- hears original audio: no
- pronunciation feedback: no
- meaning: dumb text-to-speech only

## `RAW_AUDIO_TO_AI_TEXT_AND_AUDIO`

- does: audio -> AI text + AI audio
- input: base64 microphone audio
- output: `{ model, text, audioBase64, audioFormat }`
- hears original audio: yes
- pronunciation feedback: possible
- accent feedback: possible
- meaning: only method here that can judge spoken audio

## `extractResponsesText`

- does: OpenAI response JSON -> text string
- input: raw Responses API JSON
- output: extracted text
- meaning: parser helper only
