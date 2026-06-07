# Full Chat Requirement Audit

Status labels:

- `DONE`: implemented and verified.
- `PARTIAL`: some code exists, but not enough to claim finished.
- `MISSING`: not implemented.
- `WRONG`: implemented against the request incorrectly.
- `NEEDS VERIFY`: code exists, but it has not been proven by the required UI/debug/programmatic tests.

## Highest Priority Failures

- `DONE` Streaming fast text-chat method.
  - Requested: add a new fast streaming method in the modules, do not change existing methods, make a test page.
  - Current: `VOICE_AGENT_STREAM_TEXT_CHAT` exists, `/api/voice-agent/text-chat-stream` exists, `voice_agent_stream_text_chat.debug.ts` exists, and stream tests pass.

- `PARTIAL` Test modules.
  - Requested: test modules visible as module name plus `_test`, one file per debug page, one file per unit test.
  - Current: visible folders exist:
    - `lib_client_voice_system_test`
    - `lib_server_ai_voice_test`
    - `lib_data_store_test`
    - `voice_agent_frontend_test`
    - `voice_agent_backend_test`
  - Still missing: programmatic tests for some browser-only happy paths and full app loop cases.

- `PARTIAL` Debug pages for every method.
  - Requested: every method has a debug page showing all inputs, prompts, requests, responses, status, errors, and business steps.
  - Current: many debug-page definition files exist.
  - Missing: final per-method proof quality audit across all pages.

- `PARTIAL` Programmatic tests for every function.
  - Requested: each feature/method has programmatic tests that do what the UI test does, without mocking the target.
  - Current: data-store tests, voice-agent text-chat tests, voice-agent streaming tests, server AI voice tests, and client voice missing-browser/error tests exist.
  - Missing: browser-run happy-path tests for live microphone/speaker/SpeechRecognition and full app flow tests.

- `PARTIAL` Real app end-to-end testability.
  - Requested: quickly test whether it listens, speaks, chats, logs, and shows the whole flow.
  - Current: app page and debug pages exist, but end-to-end listen -> AI -> audio response is not proven.

## Original Planning / Reading Requests

- `DONE` Read the `plan` folder, not the repository.
  - Current: plan files were read earlier.

- `PARTIAL` Check `plan_ai`.
  - Current: no clear separate `plan_ai` folder/module was maintained. Some AI plans were written into plan files.

- `PARTIAL` Recreate/modify the plan with clear short names.
  - Current: some docs exist, especially `plan/debug_tree_business_steps.md`.
  - Missing: one consolidated authoritative implementation plan that maps every library/method/page/test.

## Core Product Direction

- `PARTIAL` Redesign as simple light fresh app.
  - Requested: very few controls, large chat window, top burger, dropdown navigation to settings/debug/future pages.
  - Current: app has a menu and cleaner UI than before.
  - Missing: full design audit, polished layout, clear app-first structure.

- `PARTIAL` Main app should be a plain beautiful chat.
  - Current: chat exists.
  - Issues: debug/status behavior has repeatedly leaked into app UX; needs final cleanup.

- `PARTIAL` Debug pages should be under Debug submenu.
  - Current: debug groups exist.
  - Needs verify: menu labels and grouping after `*_test` restructure.

- `PARTIAL` Config page for topic/prompts.
  - Current: `VOICE_AGENT_CONFIG` exists.
  - Missing: persistence in DB, per-client config, topic prompt selection proven end to end.

- `PARTIAL` Topic select should default to French.
  - Current: default settings use `french_for_german`.
  - Needs verify in deployed UI.

## Audio / Speech Understanding

- `PARTIAL` Correct understanding: audio/speech -> AI -> audio/speech answer, with optional text/json.
  - Current: server AI has audio methods and text methods.
  - Missing: clean proven app flow using original audio and returning AI audio plus JSON.

- `PARTIAL` Three implementation choices selectable in settings.
  - Requested:
    - speech/audio -> AI -> speech/audio answer
    - chained transcription/text/TTS method
    - dummy browser speech-to-text/speech
  - Current: pieces exist in libraries.
  - Missing: clean settings choice and proven routing for all three.

- `WRONG` TTS confusion.
  - Requested: AI voice answer is not just browser reading text.
  - What went wrong: TTS/browser dummy paths were mixed into explanation and testing.
  - Current: names like `DUMBB_TEXT_TO_SPEACH` exist for primitive TTS, but app flow still needs clarity.

- `PARTIAL` Dummy speech-to-text option.
  - Requested: dummy browser speech-to-text can be an option, clearly named primitive/dumb.
  - Current: browser speech checker exists.
  - Missing: final app setting and clear routing.

- `MISSING` Real VAD / WebRTC VAD.
  - Requested: second way to decide chunks with VAD-style speech/silence detection; default when browser speech reader is unavailable; saves money by skipping silence.
  - Current: only audio energy check and browser speech checker exist.
  - Missing: actual WebRTC VAD/Silero/etc. implementation.

- `PARTIAL` Audio energy check.
  - Current: `SYSTEM_AUDIO_ENERGY_CHECK` exists.
  - Missing: programmatic tests and final proof in chunk flow.

- `PARTIAL` Meaningful audio chunk creator.
  - Requested: endless 5000ms chunks while listening, clear chunk decision, skip silence/non-speech, clear sequence.
  - Current: `SYSTEM_MEANINGFUL_AUDIO_CHUNK` exists.
  - Missing: real VAD, clear app integration, full tests, and final verified sequence ordering.

- `WRONG` Chunk business decision unclear.
  - Requested: show clearly whether the chunk is useful or skipped.
  - What went wrong: `chunkReason: max_duration` did not say business result; valid `NO` showed as `error`.
  - Current: docs improved; UI needs verify.

- `PARTIAL` iOS Chrome camera/mic problem.
  - Requested: clicking listen on iOS Chrome should request microphone only, not camera.
  - Current: code says audio-only in places.
  - Missing: actual iOS Chrome verification.

- `PARTIAL` Windows Chrome no speech output.
  - Requested: speak on should actually speak.
  - Current: audio playback/TTS pieces exist.
  - Missing: verified working app flow.

- `PARTIAL` Audio format problem.
  - Observed error: OpenAI rejected `audio/webm;codecs=opus`, expected wav/mp3.
  - Current: some format normalization exists in server AI calls.
  - Missing: robust browser recording conversion or recording format strategy proven in tests.

## Server AI Library

- `PARTIAL` Server-side reusable library.
  - Requested: server-side library with provider API calls, logging hook, error handling, prompt configuration, reusable by other apps, no DB access, no app settings access, every method returns status.
  - Current: `lib_server_ai_voice` exists.
  - Missing: full method-by-method status/prompt/logging audit and tests.

- `PARTIAL` `PRIMITIVE_TEXT_TO_AUDIO`.
  - Requested input: provider choice, system prompt, additional instructions, text, history.
  - Requested output: audio, json analysis/flags.
  - Current: server AI and `/api/speak` path exist.
  - Missing: full debug proof, programmatic tests, real prompt/history handling audit.

- `PARTIAL` `PRIMITIVE_AUDIO_TO_TEXT`.
  - Requested input: provider choice, prompts/instructions, text chat, audio, history.
  - Requested output: audio/json text/hint/analysis.
  - Current: transcription primitive exists.
  - Missing: it is mostly transcript-only; prompt/text/history/audio output expectations are not fully satisfied.

- `PARTIAL` `AUDIO_TO_AI_TEXT_AND_AUDIO`.
  - Requested: original audio -> AI text + AI audio.
  - Current: audio turn method exists.
  - Missing: debug page/test proof and clarity about whether `text` is JSON or plain provider text.

- `PARTIAL` `AUDIO_ANALYSER`.
  - Requested real method: original audio + text chat + history + system/task/JSON prompts -> JSON flags/chat/correction/hint + audio.
  - Current: `AUDIO_ANALYSER` exists.
  - Missing: full app flow proof, programmatic tests, audio format handling, clear prompt display, verified pronunciation/accent judgment.

- `PARTIAL` Default prompts from module as core business part.
  - Current: default prompt files exist for audio analyser/audio turn and voice agent prompt builder.
  - Missing: complete per-method prompt visibility/editability and DB persistence.

- `PARTIAL` `ServerAiConfig`.
  - Requested: clear implementation/provider config, not vague.
  - Current: config type exists with provider/implementation/model fields.
  - Missing: docs/tests proving config routing and provider choices.

## Client Library

- `PARTIAL` Client reusable library.
  - Requested methods:
    - `SYSTEM_AUDIO_TO_TEXT`
    - `SYSTEM_TEXT_TO_AUDIO`
    - `SYSTEM_MICRO_TO_AUDIO`
    - `SYSTEM_AUDIO_TO_SPEAKER`
  - Current: `lib_client_voice_system` exists.
  - Missing: programmatic/browser tests and full debug proof for each.

- `PARTIAL` Client voice enabling documentation in frontend.
  - Requested: documentation in frontend explaining microphone/audio permissions/requirements.
  - Current: `VOICE_ENABLEMENT.md` and a microphone docs debug page exist.
  - Missing: verify it is visible enough in app/debug menu.

- `PARTIAL` Browser speech checker language explanation.
  - Requested: explain why `speechCheckLang` exists and how multilingual use works.
  - Current: docs/page text improved partly.
  - Missing: final clarity and maybe language selection strategy.

## Voice Agent Module

- `PARTIAL` `voice_agent` module using other libraries.
  - Requested: frontend/backend parts, app and test page use same module, config page, per-client topic prompts, server multi-client.
  - Current: `voice_agent` exists with frontend/backend exports.
  - Missing: streaming, DB-backed prompt config, full app flow, topic persistence, full tests.

- `DONE` Typed text chat method exists.
  - Current: `VOICE_AGENT_TEXT_CHAT` exists.
  - Tests: several real OpenAI tests exist.

- `PARTIAL` Text chat should answer latest message only.
  - Current: prompt and test added.
  - Needs verify in UI/deployed app.

- `PARTIAL` Text chat send button.
  - Current: chat UI has typed send path.
  - Needs verify in app.

- `DONE` Streaming text chat method.
  - Requested: new fast streaming method, test page, no change to existing methods.
  - Current: implemented as separate stream method and test page.

- `PARTIAL` Speak toggle should respond to last message immediately.
  - Requested: if listen is on and speak is switched on, correct/respond to last message, not wait for new message.
  - Current: not clearly implemented.

- `PARTIAL` Only lamp for improvement/error.
  - Requested: no status text block moving in chat; just lamp if improvement/error.
  - Current: partially changed.
  - Needs verify in UI.

## Data Store Library

- `PARTIAL` Separate storage library.
  - Requested: all payment/other data access goes through it; can switch local or Cloudflare DB.
  - Current: `lib_data_store` exists with local memory and tests.
  - Missing: Cloudflare DB implementation proof and all app data routed through it.

- `DONE` Data-store test module split.
  - Current: `lib_data_store_test` has separate debug files and separate event/cost test files.

## Debug Pages / Debug Tree

- `PARTIAL` Debug page for each function.
  - Current: many debug page definitions exist.
  - Missing: streaming debug page, and some actual UI components may still be centralized in `main.tsx`.

- `PARTIAL` Test pages live in `module_name_test`.
  - Current: debug definitions now live in sibling `*_test` modules.
  - Missing: actual React page components are still mostly in `main.tsx`, not one file per page component.

- `PARTIAL` Business sequence tree with expandable details.
  - Requested: clear tree:
    - business target
    - recording active
    - 5000ms chunks repeating
    - checking silence/voice/browser speech
    - skipped/not implemented
    - chunk sent to AI
    - request/response expandable
    - correction result
    - recording ended reason
  - Current: some stack/business sequence UI exists.
  - Missing: exact tree structure and per-step expandable detail for all flows.

- `PARTIAL` Logs show all technical errors, chat prompts, results, JSONs, history flow.
  - Current: debug stack exists.
  - Missing: all methods not consistently logging full request/response/prompts/errors.

- `WRONG` Fake business JSON.
  - What went wrong: UI showed artificial business objects as if method output.
  - Requested: real messages in/out, status, and clear UI interpretation labels.
  - Current: docs improved; UI needs audit.

- `PARTIAL` Valid business `NO` must not be error.
  - Current: docs updated.
  - Missing: audit every debug page output/status.

- `PARTIAL` State isolation between debug pages.
  - Requested: no reused results from other tests.
  - Current: shared stack patterns exist.
  - Missing: verify each page resets/isolates state.

## Programmatic Tests

- `PARTIAL` No mocked target when claiming real target.
  - Current: voice-agent text-chat real OpenAI tests exist; data store real local tests exist.
  - Missing: many methods not covered.

- `PARTIAL` Client audio method tests.
  - Current: Node-safe missing-browser/error tests exist for:
    - `SYSTEM_MEANINGFUL_AUDIO_CHUNK`
    - `SYSTEM_AUDIO_ENERGY_CHECK`
    - `SYSTEM_MICRO_TO_AUDIO`
    - `SYSTEM_AUDIO_TO_TEXT`
    - `SYSTEM_TEXT_TO_AUDIO`
    - `SYSTEM_AUDIO_TO_SPEAKER`
  - Missing: browser automation tests for successful microphone, browser speech recognition, speaker playback, and real chunking.

- `DONE` Server AI method tests.
  - Current: missing-config/missing-input tests and real OpenAI tests exist for:
    - `PRIMITIVE_TEXT_TO_AUDIO`
    - `PRIMITIVE_AUDIO_TO_TEXT`
    - `AUDIO_TO_AI_TEXT_AND_AUDIO`
    - `AUDIO_ANALYSER`

- `DONE` Voice agent streaming tests.
  - Current: separate tests exist for:
    - missing text
    - missing API key
    - real stream returns first delta quickly
  - Missing: extra keyword-specific stream test if stream should expose keyword flags. Current stream is plain text only.

- `PARTIAL` Example audio for tests.
  - Current: sample audio URL exists.
  - Missing: every audio debug/test page should default to it and allow replacing/removing.

## Documentation

- `DONE` Debug/test quality standard updated.
  - Current: `plan/debug_tree_business_steps.md` now says:
    - use `module_name_test`
    - one debug file per page
    - one test file per test
    - no final `module/_test`

- `PARTIAL` Server AI docs.
  - Current: README exists.
  - Missing: plain exact explanation of prompts, payloads, raw responses, and which methods hear original audio.

- `PARTIAL` Business-use docs.
  - Requested: short human-readable docs, bullet points, no blabla.
  - Current: docs exist but need audit for clarity and exactness.

## Deployment / Git

- `DONE` Pushed previous structural fixes.
  - Current pushed commits include:
    - `632285f Move voice agent tests into module`
    - `bbda93d Split debug tests into visible modules`

- `NEEDS VERIFY` Current audit file not pushed yet.
  - This file is local until committed/pushed.

## Concrete Next Work Order

1. Add browser automation tests for live browser-only client voice success paths.
2. Add full app flow tests:
   - typed text chat
   - streaming typed text chat
   - sample audio -> audio analyser
   - listen chunk -> audio analyser where browser microphone is available
3. Audit every debug page for:
   - all inputs
   - all prompts
   - real request
   - real response
   - status
   - error
   - business sequence
   - valid `NO` not shown as error
4. Fix app flow:
   - plain chat
   - topic select/default French
   - send button
   - listen toggle
   - speak toggle
   - lamp only for improvement/error
   - no debug junk in chat
5. Prove listen -> useful chunk -> audio analyser -> chat/audio answer with sample audio and, where possible, microphone.
