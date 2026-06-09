# Realtime WebRTC TODO

Date: 2026-06-09

## Goal

Create a browser-first realtime speech-to-speech proof for the voice trainer.

The proof must show whether this approach feels better than the current chunk/blob recorder.

## Core Direction

- Use browser direct WebRTC for live voice.
- Server should create the realtime session/client secret.
- Do not route live audio through the server for the first proof.
- Keep the code modular with reusable methods.
- Do not hide voice logic inside the React page.

## First Proof: Simple Realtime Session

### Browser

- Open microphone once.
- Show local microphone level.
- Show local voice/sound indicator.
- Connect browser directly to AI provider with WebRTC.
- Receive remote AI audio and play it in the browser.
- Receive realtime text/transcript/events over data channel.
- Show raw realtime events.
- Show connection state.
- Show data channel state.

### Server

- Add a server method that creates a short-lived realtime client secret/session.
- Server sets trusted session instructions.
- Browser receives only temporary client secret.
- Browser never receives the permanent API key.

### Send-To-AI Gate

- Add a `sendToAi` control.
- When `sendToAi` is off:
  - microphone can stay open locally
  - local indicators still work
  - outgoing WebRTC mic track is disabled
- When `sendToAi` is on:
  - outgoing mic can be enabled only when speech/voice is detected

### Speaker Feedback Protection

- When AI audio is playing:
  - disable outgoing microphone track
  - show reason: `AI speaking - mic not sent`
- After AI audio stops:
  - wait a short cooldown
  - allow microphone sending again if `sendToAi` and speech are active

### Debug Indicators

Show:

- local voice detected: `YES/NO`
- mic sent to AI: `YES/NO`
- reason:
  - `sendToAi off`
  - `silence`
  - `voice detected`
  - `AI speaking`
  - `cooldown`
- AI detected speech started/stopped
- AI speaking started/stopped
- streamed text/transcript
- remote audio playback
- errors

## Events / Correction Signals

Test whether realtime can send structured events like:

```json
{
  "type": "trainer_event",
  "event": "bad_french_mistake",
  "severity": "high",
  "original": "Je suis aller au magasin",
  "corrected": "Je suis allé au magasin",
  "hint": "Use allé with être."
}
```

Desired event names:

- `bad_french_mistake`
- `minor_improvement`
- `good_sentence`
- `keyword_on`
- `keyword_off`
- `answer_allowed`
- `answer_blocked`

Show these as lamps/signals in debug.

For production, consider separate structured analysis after transcript for more reliable flags.

## Cost-Control Proof

The better cost-control version should avoid keeping an AI session open during silence.

Target:

```text
browser mic stays open locally
local VAD runs
rolling pre-buffer stores last 300-800ms audio
speech starts
  -> create realtime AI session
  -> send pre-buffer audio first
  -> stream live speech
speech stops + silence timeout
  -> stop sending
  -> close realtime AI session
```

Benefits:

- no AI session during silence
- less empty audio sent
- first word is preserved
- better cost control

Required methods:

- `CLIENT_MIC_SESSION_START`
- `CLIENT_MIC_SESSION_STOP`
- `CLIENT_VAD_MONITOR`
- `CLIENT_AUDIO_PREBUFFER_APPEND`
- `CLIENT_AUDIO_PREBUFFER_READ`
- `CLIENT_REALTIME_SESSION_START`
- `CLIENT_REALTIME_SESSION_SEND_PREBUFFER`
- `CLIENT_REALTIME_SESSION_STOP_AFTER_SILENCE`

## VAD / Speech Detection

First proof can use simple browser RMS/energy detection.

But this is not enough for production.

Later:

- add real VAD
- keep energy detection as fallback/debug only
- show clearly whether detection came from:
  - local energy
  - real VAD
  - provider speech event

## What Not To Do

- Do not call blob upload response streaming “realtime”.
- Do not keep reopening microphone per chunk.
- Do not rely on browser SpeechRecognition as production VAD.
- Do not send audio while AI is speaking.
- Do not send long silence to AI.
- Do not hide control decisions in UI code.
- Do not pretend mobile reliability is proven.

## Existing New Module

Created but not fully wired:

```text
app/src/voice_agent_realtime_webrtc_test/
```

Current files:

- `client.ts`
- `server.ts`
- `prompts.ts`
- `types.ts`
- `RealtimeWebrtcDebugPage.tsx`
- `realtime_webrtc.debug.ts`
- `index.ts`

These should become the basis for the proof page.

## Wiring TODO

When ready to wire:

- Add server route:
  - `/api/voice-agent/realtime-client-secret`
- Add debug page to debug menu.
- Add browser page rendering for `VOICE_AGENT_REALTIME_WEBRTC_TEST`.
- Run build.
- Open in browser.
- Test with microphone.
- Check:
  - no empty data is sent while silent
  - own AI playback is not sent back
  - text/events arrive
  - audio plays
  - errors are visible

## Test Order

1. Desktop Chrome with API key.
2. Desktop Chrome: silence cost behavior.
3. Desktop Chrome: one French mistake.
4. Desktop Chrome: two sentences.
5. Desktop Chrome: AI playback feedback.
6. Android Chrome.
7. iPhone/iPad Safari.
8. iOS Chrome only after Safari behavior is known.

## Decision

Build realtime WebRTC as a separate proof path.

Keep old chunk recorder as:

```text
debug / fallback / old prototype
```

Do not patch the old chunk recorder as the main voice strategy.
