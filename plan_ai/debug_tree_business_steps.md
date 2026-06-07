# Debug Tree Business Steps

## Purpose

- Show what the app decided.
- Show why it decided that.
- Separate business logic from technical logs.
- Never hide missing functionality.
- Never call something useful just because audio bytes exist.

## Display Order

- Business target.
- Current recording state.
- Business decision.
- Business-relevant checks.
- Next action.
- Recording end reason.
- Expandable raw request/response/log details.

## Required Tree Shape

```text
BUSINESS TARGET: LISTENING TO VOICE
  RECORDING
    STATE: ACTIVE | ENDED | ERROR
    CHUNK LOOP: 5000ms chunks repeating until user stops

  BUSINESS DECISION: USEFUL CHUNK?
    RESULT: YES | NO
    REASON: exact human reason
    SEND TO AI: YES | NO | SKIPPED

  CHECKING SILENCE
    RESULT: AUDIO ENERGY CHECK | NOT AVAILABLE | ERROR
    DETAILS: RMS energy threshold result

  CHECKING VOICE ACTIVITY
    RESULT: NOT IMPLEMENTED - SKIP
    DETAILS: no real VAD

  CHECKING BROWSER SPEECH TO TEXT
    REQUEST: language/config
    RESULT: HAS TEXT | NO TEXT | NOT AVAILABLE | ERROR
    DETAILS: expandable JSON

  CHUNK SENT TO AI FUNCTION
    RESULT: SENT | SKIPPED
    REASON: useful chunk yes/no, AI function available yes/no
    REQUEST: expandable full request without huge audio bytes
    RESPONSE: expandable full response

  RECORDING ENDED
    REASON: user stopped | max duration | browser final text | error
```

## Business Rules

- `audio_blob_exists`
  - Means browser recorded audio bytes.
  - Does not mean speech.
  - Does not mean useful chunk.

- `browser_speech_text_exists`
  - Means browser SpeechRecognition returned text.
  - It is a helper only.
  - It is not real VAD.

- `real_silence_detection`
  - NOT IMPLEMENTED.

- `SYSTEM_AUDIO_ENERGY_CHECK`
  - Implemented as a public client library method.
  - Measures microphone RMS energy.
  - Helps skip silence before AI calls.
  - Does not prove human speech.
  - Can be fooled by loud noise.

- `real_voice_activity_detection`
  - NOT IMPLEMENTED.

- `USEFUL_CHUNK`
  - Depends on selected decision mode.
  - `browser_speech_text`: YES when audio exists and browser speech text exists.
  - `audio_energy`: YES when audio exists and energy threshold was crossed long enough.
  - `auto`: browser speech text if available, else audio energy.
  - NO when no audio exists.

- `SEND_TO_AI`
  - NO when `USEFUL_CHUNK = NO`.
  - NO when AI function is not implemented on that page.
  - YES only when useful chunk exists and the page really calls the AI method.

## Required Highlights

- `BUSINESS DECISION: USEFUL CHUNK = YES/NO`
  - Must be visible before raw logs.
  - Must use strong color.

- `SEND TO AI`
  - Must be visible beside the useful chunk decision.

- `NOT IMPLEMENTED`
  - Must be red.
  - Must say `NOT IMPLEMENTED - SKIP`.

- `NO TEXT`
  - Must not say `use chunk anyway`.
  - Must say `NO TEXT - SKIP CHUNK`.

- Technical logs
  - Must be below business flow.
  - Must be expandable.
  - Must not be the main explanation.

## Required Output Object

```json
{
  "BUSINESS_DECISION_USEFUL_CHUNK": "YES|NO",
  "business_decision": "USEFUL_CHUNK|NOT_USEFUL_CHUNK",
  "business_reason": "human readable exact reason",
  "send_to_ai": "YES|NO_SKIP_NOT_USEFUL|NO_NOT_IMPLEMENTED_ON_THIS_PAGE",
  "audio_blob_exists": true,
  "browser_speech_text_exists": false,
  "audio_energy_has_sound": false,
  "real_silence_detection_implemented": false,
  "real_voice_activity_detection_implemented": false,
  "chunk_sent_to_ai": false
}
```
