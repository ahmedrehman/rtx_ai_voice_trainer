# Debug Page Quality Standard

## Purpose

- Let a human understand exactly what one method did.
- Show real inputs and real outputs.
- Show all prompts and instructions that are sent.
- Show business-relevant steps with colored status.
- Show errors and technical logs without hiding them.
- Never fake JSON, fake business objects, or fake readiness.

## Core Rule

- One debug page tests one public method or one real server endpoint.
- The page calls the real method or real endpoint.
- If it cannot call it, the page must say `NOT CALLABLE` and explain the missing endpoint/config.
- UI does not invent hidden business output.
- UI may show a colored sequence, but real `input`, `output`, `status`, and `error` must stay inspectable.

## Required Page Sections

- `Business target`
  - What user/business task this method supports.
  - Example: `LISTENING TO VOICE`, `AI AUDIO ANALYSIS`, `DATA STORE SAVE COST`.

- `Inputs`
  - Every method input.
  - Provider choice if provider exists.
  - Audio/text/history/config fields if method accepts them.
  - All prompts/instructions if the call can use prompts.
  - JSON response format editor if AI must return JSON.
  - Clear note when a method has `prompts: none`.

- `Run button`
  - Calls the real method or real endpoint.
  - Button label says what happens.
  - Disabled/running state visible.

- `Business sequence`
  - Colored step list.
  - Each step has:
    - step name
    - status
    - short result/reason
  - This is a visual explanation, not fake method output.

- `Real input / request`
  - Expandable JSON.
  - Shows the exact request object.
  - Large audio bytes must be summarized as size/type/base64 length.

- `Real output / response`
  - Expandable JSON.
  - Shows the exact method/endpoint response.
  - Includes `status`.
  - Includes error object if failed.

- `Technical log items`
  - Expandable array/list.
  - Below business sequence.
  - Start/done/error events.

## Required Inputs By Method Type

## Client Audio Methods

- `SYSTEM_MICRO_TO_AUDIO`
  - `durationMs`
  - `mimeType`
  - browser requirements
  - prompts: none
  - output: audio blob metadata, status

- `SYSTEM_AUDIO_ENERGY_CHECK`
  - `durationMs`
  - `threshold`
  - `minActiveMs`
  - `sampleEveryMs`
  - prompts: none
  - output: `hasSound`, `activeMs`, `maxRms`, `averageRms`, status

- `SYSTEM_AUDIO_TO_TEXT`
  - `lang`
  - `timeoutMs`
  - browser requirements
  - prompts: none
  - output: `{ status, text, note }`
  - must never listen forever

- `SYSTEM_TEXT_TO_AUDIO`
  - `text`
  - `lang`
  - prompts: none
  - output: `{ status, spoken, note }`
  - note must say browser dummy TTS, not AI voice

- `SYSTEM_AUDIO_TO_SPEAKER`
  - `audio`
  - prompts: none
  - output: `{ status, played }`

## Server AI Methods

- Every server AI debug page must show:
  - `provider`
  - `voice` if voice output exists
  - `systemPrompt`
  - `additionalInstructions`
  - `history`
  - real endpoint path
  - real request JSON/form data summary
  - real response JSON/audio metadata

- `PRIMITIVE_TEXT_TO_AUDIO`
  - input:
    - provider
    - systemPrompt
    - additionalInstructions
    - text
    - history
    - voice
  - output:
    - audio
    - content type
    - status/error
  - note:
    - text -> audio
    - no microphone audio
    - no pronunciation judgement

- `PRIMITIVE_AUDIO_TO_TEXT`
  - input:
    - provider
    - systemPrompt
    - additionalInstructions
    - textChat
    - audio
    - history
  - output:
    - JSON text
    - hint
    - status/error
  - note:
    - transcription only unless explicitly implemented otherwise

- `AUDIO_TO_AI_TEXT_AND_AUDIO`
  - input:
    - provider
    - original audio
    - systemPrompt
    - additionalInstructions
    - systemTask
    - howToRespond
    - responseJsonFormat
    - voice
  - output:
    - text
    - audio
    - model
    - status/error
  - note:
    - AI hears original audio
    - can judge pronunciation if model supports it

- `AUDIO_ANALYSER`
  - input:
    - provider
    - SYSTEM Prompt
      - task
      - howToRespond
      - responseJsonFormat
    - textUserChat
    - original audio
    - history5LastTextChats
    - voice
  - output:
    - JSON flags
      - keyword_on_sent
      - keyword_off_sent
      - has_corrections
      - is_chat_answer_or_correction
    - chat_text_to_user
    - text_corrected
    - hint
    - audio
    - status/error
  - note:
    - this is the real method for audio analysis
    - does not run primitive transcription first

## Data Store Methods

- Every data-store debug page must show:
  - implementation
  - local-memory or cloudflare-d1
  - exact input filter/payload
  - exact stored/listed/reset output
  - status/error

- If page uses local-memory, it must say:
  - `DATA STORE IMPLEMENTATION: local-memory`
  - `Cloudflare D1 is not called from this browser page`

## Colored Business Sequence

Use colored step rows for business-relevant status.

- Green / `done`
  - step succeeded
  - useful result found
  - output exists

- Red / `error`
  - method failed
  - required input missing
  - no useful result
  - endpoint returned error

- Blue / `running`
  - method is active
  - listening/recording/request in progress

- Red / `not_implemented`
  - feature does not exist
  - must say `NOT IMPLEMENTED - SKIP`

- Yellow / `pending`
  - waiting for result
  - not decided yet

## Business Sequence Examples

```text
Business sequence
  Request microphone
    done
    Microphone stream opened with audio only.

  Start energy check
    done
    RMS energy samples collected.

  Decide sound
    done
    Audio energy crossed the configured RMS threshold long enough.
```

```text
Business sequence
  Build request
    done
    Browser prepared request for /api/audio-analyser.

  Call server endpoint
    error
    OPENAI_API_KEY is not configured.

  Show real response
    done
    Response JSON is expandable below.
```

## What Must Not Happen

- Do not show fake JSON as if it came from the method.
- Do not label debug-page interpretation as method output.
- Do not hide prompts.
- Do not hide request bodies.
- Do not hide response bodies.
- Do not say a function is ready if the run button does not call it.
- Do not say VAD exists if only energy check exists.
- Do not say speech exists because an audio blob exists.
- Do not send useless chunks to AI silently.
- Do not put core logic only in UI.

## Real Output Rule

- Visible output must be real.
- If UI adds interpretation, label it as UI interpretation.
- Preferred display:
  - colored sequence for human status
  - expandable `Real input / request`
  - expandable `Real output / response`
  - expandable `Raw item JSON`

## Missing Functionality Label

Use exact words:

```text
NOT IMPLEMENTED - SKIP
```

or:

```text
NOT CALLABLE - MISSING ENDPOINT
```

or:

```text
NOT CONFIGURED - MISSING API KEY
```

## Future Task Checklist

- Read the method type.
- List every input from the method signature and plan.
- Add editors for every prompt/instruction/JSON format.
- Add audio/text/history/provider/config fields when accepted.
- Make the run button call the real method/endpoint.
- Show colored business sequence.
- Show real request/input.
- Show real response/output.
- Show status and errors.
- Build.
- Do not push unrelated dirty files.
