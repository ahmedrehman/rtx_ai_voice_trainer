# lib_server_ai_voice

- role: server AI voice methods
- server-side only
- no DB access
- no app settings access
- prompts are input values
- caller chooses provider/config
- every method returns `status`
- caller evaluates `status`
- caller writes debug item

## `status`

- `method`
- `ok`
- `phase`
- `startedAt`
- `finishedAt`
- `error`

## `ServerAiConfig`

- `provider`: `openai`
- `implementation`: `openai-audio` | `openai-transcribe` | `openai-tts`
- `openAiApiKey`: server secret
- `audioModel`: audio-in/audio-out model
- `transcriptionModel`: dumb transcription model
- `ttsModel`: text-to-speech model
- `voice`: provider voice
- `logger`: optional event hook

## `PRIMITIVE_TEXT_TO_AUDIO`

- role: text -> audio
- implementation: `openai-tts`
- input:
  - provider
  - systemPrompt
  - additionalInstructions
  - text
  - history
- prompt use:
  - systemPrompt/additionalInstructions become TTS instructions
- output:
  - status
  - audio stream
  - contentType
  - json flags/analysis
  - debug config/input/providerRequest
- does not hear microphone audio
- cannot judge pronunciation

## `PRIMITIVE_AUDIO_TO_TEXT`

- role: audio -> transcript text
- implementation: `openai-transcribe`
- input:
  - provider
  - audioBody
  - audioContentType
  - systemPrompt/additionalInstructions/textChat/history as debug context
- prompt use:
  - no correction prompt
  - no pronunciation prompt
- output:
  - status
  - json.text
  - json.hint
  - debug config/input/providerRequest
- hears original audio only for transcription
- does not judge pronunciation

## `AUDIO_TO_AI_TEXT_AND_AUDIO`

- role: original audio -> AI text + AI audio
- implementation: `openai-audio`
- default prompts:
  - source: `audioTurnPrompts.ts`
  - exported: `AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS`
  - raw provider-call test only
- input:
  - provider
  - audioBase64
  - audioFormat
  - systemPrompt
  - taskPrompt
  - responseJsonFormat
  - voice
- prompt sent:
  - systemPrompt
  - taskPrompt
  - responseJsonFormat
- output:
  - status
  - model
  - text
  - audioBase64
  - audioFormat
  - debug promptSent/inputWithoutAudio
- hears original audio
- can judge pronunciation/accent
- does not parse app business flags
- does not enforce keyword/correction contract
- use `AUDIO_ANALYSER` for the real app method

## `AUDIO_ANALYSER`

- role: real app method
- implementation: `openai-audio`
- default prompts:
  - source: `audioAnalyserPrompts.ts`
  - exported: `AUDIO_ANALYSER_DEFAULT_PROMPTS`
  - factory: `createAudioAnalyserDefaultPrompts(options)`
  - core business part, not UI decoration
- input:
  - systemPrompt.task
  - systemPrompt.howToRespond
  - systemPrompt.responseJsonFormat
  - textUserChat
  - audioUserAudio.audioBase64
  - audioUserAudio.audioFormat
  - history5LastTextChats
- prompt sent:
  - task + howToRespond
  - text chat
  - history
  - response JSON format
  - original microphone audio
- output:
  - status
  - json.flags
    - keyword_on_sent
    - keyword_off_sent
    - keyword_detected
    - keyword_exact_text
    - has_corrections
    - correction_type
    - is_chat_answer_or_correction
  - json.chat_text_to_user
  - json.text_corrected
  - json.hint
  - audio
  - debug promptSent/rawAiText/inputWithoutAudio
- does not call primitive transcription first
- original audio is the source for pronunciation/accent
