# Debug Page Quality Standard

## Purpose

- Let a human understand exactly what one method did.
- Show real inputs and real outputs.
- Show all prompts and instructions that are sent.
- Show business-relevant steps with colored status.
- Show errors and technical logs without hiding them.
- Never fake JSON, fake business objects, or fake readiness.
- Reusable standard for any app/project, not only this voice trainer.

## General Rule For Any Project

- A debug page is a business-method proof page.
- It must answer:
  - What business task was attempted?
  - What exact method/endpoint was called?
  - What exact inputs were used?
  - What decisions were made?
  - Who/what made each decision?
  - What was skipped and why?
  - What exact output came back?
  - What error happened, if any?
- Method output and UI explanation are separate.
- Business decisions must be readable without opening raw JSON.
- Raw JSON must still be available for verification.
- The page must make false readiness impossible.

## Required Test Module Structure

- Tests are their own visible modules.
- Do not hide tests inside the production module folder.
- Test module folder name must be:
  - production module name
  - plus `_test`
- Examples:
  - `lib_client_voice_system` -> `lib_client_voice_system_test`
  - `lib_server_ai_voice` -> `lib_server_ai_voice_test`
  - `lib_data_store` -> `lib_data_store_test`
  - `voice_agent frontend/debug UI` -> `voice_agent_frontend_test`
  - `voice_agent backend/programmatic calls` -> `voice_agent_backend_test`
- The app debug menu must show these test module names.
- The debug page `module` label must be the test module name.
- Frontend/client debug components live in their frontend test module.
- Backend/server programmatic tests live in their backend test module.
- A mixed `voice_agent_test` bucket is not allowed when frontend and backend responsibilities can be separated.
- A backend test module may have no debug pages if its proof is programmatic `.test.ts` files only.

## Required Test Module Files

- One debug page = one file.
- Debug page file name:
  - `<method_or_page_id>.debug.ts`
- One programmatic unit/business test case = one file.
- Test file name:
  - `<method_or_case>.test.ts`
- Shared helpers are allowed only in clearly named helper files.
- Index file only aggregates exports.
- Index file must not contain page definitions.
- Index file must not contain test cases.

Example:

```text
voice_agent_frontend_test/
  index.ts
  voice_agent_text_chat.debug.ts
  voice_agent_stream_text_chat.debug.ts
  voice_agent_full_app.debug.ts
  pages.tsx

voice_agent_backend_test/
  index.ts
  create_settings.test.ts
  text_chat_missing_typed_text.test.ts
  text_chat_missing_openai_config.test.ts
  text_chat_real_answer.test.ts
  text_chat_real_grammar_correction.test.ts
  text_chat_real_latest_message.test.ts
  text_chat_real_keyword_off.test.ts
  stream_text_chat_missing_typed_text.test.ts
  stream_text_chat_missing_openai_config.test.ts
  stream_text_chat_real_answer.test.ts
  test_env.ts
```

## Forbidden Test Structure

- Do not use `module/_test` as the final structure.
- Do not put all debug pages into one giant `index.ts`.
- Do not put all unit tests into one giant `index.test.ts`.
- Do not label a debug menu group with the production module name when it is a test module.
- Do not make a debug page that has no matching visible file.
- Do not make a test case that has no matching visible `.test.ts` file when programmatic testing is possible.

## Required Method Contract

Each tested method must have a visible contract:

- method name
- business role
- owner module/library
- implementation/provider if relevant
- required inputs
- optional inputs
- prompts/instructions if relevant
- expected output shape
- status object shape
- error behavior
- side effects
- persistence writes, if any
- external calls, if any

If any contract part is unknown, show:

```text
UNKNOWN - NOT VERIFIED
```

## Business Oversight Rule

- Every business-relevant decision must be visible as a step.
- Every step must show:
  - action
  - decision/result
  - reason
  - actor
- Actor examples:
  - browser
  - client library
  - server library
  - provider API
  - database
  - UI interpretation
- If a step is skipped, show `SKIPPED` and the reason.
- If a feature is missing, show `NOT IMPLEMENTED - SKIP`.
- Do not hide business logic inside technical logs.

## Prompt Rule

- Prompts are business inputs.
- Prompts must be shown and editable when the method accepts them.
- Default prompts must come from the owning module/library when they are core business behavior.
- The debug page may display and edit prompts, but it must not secretly invent core prompt defaults.
- Show:
  - system prompt
  - task prompt
  - how-to-respond prompt
  - response JSON format
  - any provider-specific instruction field
- If prompts are not used, show:

```text
prompts: none
```

## Decision vs Error

- `error` means the method failed or could not run.
- A valid `NO` is not an error.
- Missing required input is an error.
- Missing config/API key is an error.
- `NO SPEECH`, `NO TEXT`, `NO CORRECTION`, or `NOT USEFUL` can be valid done results.
- The label must make the business result obvious:
  - `Business decision: useful chunk? YES`
  - `Business decision: useful chunk? NO`
  - `Business decision: correction needed? YES`
  - `Business decision: correction needed? NO`

## Evidence Rule

- Every visible claim must have evidence.
- Evidence can be:
  - real request/input object
  - real response/output object
  - status object
  - provider response
  - browser capability result
  - database result
  - technical log item
- Do not show explanatory JSON as if it is method output.
- If UI creates interpretation, label it `UI interpretation`.

## Programmatic Test Rule

- Every debug page should have a matching programmatic test when possible.
- The programmatic test must do the same business test as the UI debug page.
- It may skip the UI button/click.
- It may call the method/function/endpoint directly.
- It may use a fixed sample audio file instead of a live microphone.
- It may use a local test database instead of a visual page.
- It must not mock away the actual target being proven.

## What Must Not Be Mocked

- Do not mock the provider API when the test claims provider success.
- Do not mock OpenAI when the test claims OpenAI works.
- Do not mock Cloudflare D1 when the test claims D1 works.
- Do not mock browser microphone APIs when the test claims browser microphone works.
- Do not mock browser speech recognition when the test claims browser speech recognition works.
- Do not mock browser audio playback when the test claims browser playback works.
- Do not mock the function under test.
- Do not mock the request body builder if the test claims request-body correctness.

## Allowed Test Substitutions

- UI click can be replaced by direct method/function/endpoint call.
- Live microphone can be replaced by a real audio file input.
- Full audio bytes can be summarized in logs/assertions.
- Missing config can be tested without calling the provider.
- Missing required input can be tested without calling the provider.
- Local-memory data store can be tested directly as its own implementation.
- Provider-contract tests may inspect the real request body before sending, but must not claim provider success.

## Test Levels

- Unit/business-method test:
  - calls the public method directly
  - uses real method code
  - uses real input objects
  - checks status, output, errors, and business decisions
  - does not mock the method under test

- Request-contract test:
  - builds the exact provider/database/browser request
  - checks provider-required formats and fields
  - example: `audio/wav` must become `wav` before OpenAI audio call
  - does not claim the provider accepted it unless the provider is actually called

- Integration test:
  - calls the actual external target
  - uses real OpenAI/API/browser/database when available
  - requires real config such as API key or browser capability
  - can be skipped only with explicit `NOT RUN - MISSING CONFIG`

## Programmatic Test Output

- Test output must say what was really tested.
- Test name must include the method name.
- Test failure must show the real error.
- Success test must assert:
  - method/endpoint called
  - real input used
  - real request shape when external target exists
  - real output shape
  - status object
  - business decision fields
  - error behavior for failure cases
- If a test uses a fake target, it must be named as fake and must not count as proving the real target.

## Core Rule

- One debug page tests one public method or one real server endpoint.
- The page calls the real method or real endpoint.
- If it cannot call it, the page must say `NOT CALLABLE` and explain the missing endpoint/config.
- UI does not invent hidden business output.
- UI may show a colored sequence, but real `input`, `output`, `status`, and `error` must stay inspectable.
- Shared debug UI must reset state per method.
- One method page must not display inputs, outputs, or logs from another method page.
- A page is not ready until the run button calls the real method and the result is inspectable.

## Required Page Sections

- `Business target`
  - What user/business task this method supports.
  - Example: `LISTENING TO VOICE`, `AI AUDIO ANALYSIS`, `DATA STORE SAVE COST`.

- `Method contract`
  - Method/endpoint name.
  - Owning module/library.
  - Real implementation/provider.
  - Inputs accepted by this method only.
  - Output shape.
  - Status shape.

- `Inputs`
  - Every method input.
  - Provider choice if provider exists.
  - Audio/text/history/config fields if method accepts them.
  - All prompts/instructions if the call can use prompts.
  - JSON response format editor if AI must return JSON.
  - Clear note when a method has `prompts: none`.
  - Default values must show their source if they matter to business logic.

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
    - actor/source when relevant
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

- `Result summary`
  - Plain-language final state.
  - Example: `DONE - useful chunk sent to AI`.
  - Example: `DONE - no speech detected, AI skipped`.
  - Example: `ERROR - missing API key`.

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
  - browser/API/endpoint returned an actual error
  - config is missing
  - exception occurred

- Normal `NO` decision
  - must not use `error`
  - use `done`
  - label must include `YES` or `NO`
  - examples:
    - `Business decision: useful chunk? NO`
    - `Decide sound: NO`
    - `Business decision: text detected? NO`
  - reason explains why the valid result is `NO`

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
- Do not mark a valid `NO` decision as `error`.
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
- Shared debug components must reset by method id.
- Do not reuse state from another method page.
- Real input/request must be method-specific.
- Do not show fields that this method does not send.
- Audio input preview must be labeled selected input audio.
- Do not label input audio as output audio.
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
- Key/reset every shared debug component by method id.
- Add editors for every prompt/instruction/JSON format.
- Add audio/text/history/provider/config fields when accepted.
- Remove fields that the method does not accept.
- Make the run button call the real method/endpoint.
- Show colored business sequence.
- Use `error` only for real failures, not for valid `NO`.
- Show real request/input.
- Show real response/output.
- Show status and errors.
- Build.
- Do not push unrelated dirty files.

## General Project Checklist

- Identify the real public methods first.
- For each method, write the method contract before building UI.
- Decide which outputs are real method outputs and which are UI interpretation.
- Add one debug page per method.
- Add all required inputs, not only convenient inputs.
- Add prompt editors only when the method uses prompts.
- Store core default prompts in the owning module/library.
- Show business sequence with actors and decisions.
- Show raw request and raw response.
- Show status object and error object.
- Mark unimplemented parts loudly.
- Test negative paths:
  - missing required input
  - missing config
  - provider error
  - valid `NO` result
  - empty output
- Check state isolation between pages.
- Check mobile and wide layout.
- Build before claiming ready.

## Ready Means

- The page calls the real method.
- All method inputs are visible.
- All prompts sent are visible.
- Real request is visible.
- Real response is visible.
- Status is visible.
- Errors are visible.
- Business decisions are highlighted.
- Skipped steps are explicit.
- No state is reused from another page.
- A user can explain what happened without reading source code.
