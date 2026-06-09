# Realtime WebRTC Stream Architecture

Date: 2026-06-09

## Goal

Build a browser-first realtime speech-to-speech proof for the voice trainer.

The proof should answer:

- Can the browser stream microphone audio live to AI?
- Can the AI stream spoken audio back?
- Can the app also receive text/transcript/events?
- Can prompts/settings be included?
- Can the app prevent the AI from reacting to its own playback?
- Is a server audio relay needed, or is browser-to-AI WebRTC better?

## Main Decision

Use browser WebRTC directly to the realtime AI provider for live audio.

```text
Browser microphone
  -> WebRTC realtime AI session
  -> AI audio stream back to browser speaker
  -> AI text/transcript/events back over data channel
```

The server should create the realtime session/client secret and set trusted instructions.

```text
Browser
  -> server: request realtime client secret
Server
  -> AI provider: create realtime session
  -> Browser: short-lived client secret
Browser
  -> AI provider: WebRTC audio/data connection
```

## Why Browser Direct WebRTC

Browser direct WebRTC is the best first serious proof because it avoids the old batch path:

```text
record chunk
convert audio
base64 encode
upload full blob
wait
receive answer
```

Realtime WebRTC is closer to a real voice app:

```text
open microphone once
stream audio continuously
receive low-latency audio response
receive text/events at the same time
```

Expected advantages:

- lower latency
- fewer conversion steps
- no repeated microphone open/close
- no base64 audio upload for each phrase
- provider can do realtime turn detection
- browser receives audio and text events during the session

## Can Audio And Prompt Be Combined?

Yes.

The realtime session can combine:

```text
live audio input
session instructions / prompt
topic settings
voice selection
optional data-channel messages
```

The AI can return:

```text
spoken audio
text deltas
transcript events
speech started/stopped events
response done/error events
```

This means the debug page can show:

- local microphone level
- whether local sound/voice is detected
- whether audio is currently sent to AI
- whether AI detected speech
- streamed text/transcript
- AI speaking state
- remote audio playback
- raw realtime events

## Prompt Strategy

There are two prompt layers.

### 1. Session Instructions

Created by the server when it mints the realtime client secret.

These are trusted app instructions:

- voice trainer role
- target language/topic
- keep answers short
- do not react to own playback
- do not mention debug/internal implementation
- correction style

### 2. Live Data-Channel Messages

Sent by the browser during the session when needed.

Examples:

- current UI mode
- `sendToAi` state
- user pressed Answer Now
- user changed topic
- short extra task instruction

The browser should not be the only owner of important safety/control rules. The server-created session instructions should include the core behavior.

## Silent-By-Default Rule

The voice trainer must still stay silent unless allowed.

Browser direct WebRTC does not remove this product rule.

Recommended app controls:

```text
LISTEN on:
  microphone stream exists
  local mic indicator runs

SEND TO AI off:
  outgoing WebRTC audio track disabled
  AI receives no microphone audio

SEND TO AI on:
  outgoing audio track enabled
  AI can hear user speech

AI speaking:
  outgoing mic track disabled if feedback suppression is on
```

This makes the difference visible:

- browser can monitor the microphone locally
- app only forwards audio to AI when allowed
- app blocks feedback during AI playback

## Speaker Feedback Problem

The app must not send AI speaker output back into the AI session as a new user turn.

Browser echo cancellation helps, but it is not enough to rely on alone.

Recommended controls:

- use browser audio constraints:
  - `echoCancellation: true`
  - `noiseSuppression: true`
  - `autoGainControl: true`
- track `aiSpeaking`
- disable outgoing microphone track while AI audio plays
- show this as a visible debug state:

```text
AI speaking: YES
mic sent to AI: NO
reason: speaker feedback suppression
```

This is stronger than comparing the transcript to the last assistant text.

## Should The Server Relay Live Audio?

Usually no for the first proof.

### Browser Direct WebRTC

```text
Browser -> AI provider
AI provider -> Browser
Server only creates session
```

Pros:

- fastest path
- fewer moving pieces
- less server CPU/memory
- less buffering
- simpler for browser realtime voice
- better latency for first proof

Cons:

- browser has active provider connection
- server sees fewer live audio details
- server cannot inspect every frame unless events are separately reported

### Server Audio Relay

```text
Browser -> server -> AI provider -> server -> browser
```

Pros:

- server can inspect/control every frame
- easier central logging
- easier provider abstraction
- possible custom VAD/transforms

Cons:

- extra network hop
- more latency
- more buffering risk
- more server complexity
- harder scaling
- more failure points

## Decision For This Project

For the next proof:

```text
browser direct WebRTC
server only creates client secret/session
```

Do not build server audio relay first.

Server relay can be reconsidered later if the app needs:

- custom server VAD
- recording/audit of raw audio
- provider switching behind one server protocol
- strict compliance controls
- frame-level server-side policy

## Required Reusable Module Methods

The debug page should not hide logic.

Create reusable methods:

```text
VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE
VOICE_AGENT_REALTIME_BROWSER_MONITOR_MIC_LEVEL
VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC
VOICE_AGENT_REALTIME_DECIDE_EVENT_STATE
VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET
VOICE_AGENT_REALTIME_CREATE_INSTRUCTIONS
VOICE_AGENT_REALTIME_NORMALIZE_VOICE
```

Each method should return:

```text
status
data/result
debug
error when relevant
```

The React page should only:

- render controls
- call methods
- display returned status/output/events
- show raw details

## Debug Page Requirements

The realtime proof page should show:

- endpoint for session/client secret
- mic permission result
- local RMS microphone level
- local voice/sound indicator
- send-to-AI toggle
- whether outgoing mic track is enabled
- speaker feedback suppression toggle
- AI speaking indicator
- WebRTC peer state
- data channel state
- realtime speech start/stop events
- streamed text/transcript events
- remote audio playback
- raw realtime events
- errors

It must clearly say when something is not wired:

```text
NOT WIRED - server route missing
NOT CONNECTED - missing OPENAI_API_KEY
NOT PROVEN - mobile browser not tested
```

## What This Proof Does Not Solve Yet

Mark these as not proven until tested:

- iPhone/iPad behavior
- Android behavior
- reliable speech-to-speech over poor networks
- perfect echo suppression
- cost tracking for realtime session
- structured correction JSON from realtime speech-to-speech
- production UI flow

## Open Question

Realtime speech-to-speech is good for natural voice.

But the product also needs computer-evaluable correction flags.

Possible solutions:

1. Use realtime events/text for user-facing voice, then run a separate lightweight text analysis for flags.
2. Ask the realtime model to send structured data-channel events in addition to audio.
3. Keep realtime proof simple first, then add structured decision events after latency and audio quality are proven.

Recommended first proof:

```text
prove voice quality and latency first
then add structured flags
```

## Final Recommendation

Proceed with a browser-first WebRTC realtime module.

Keep it separate from the current chunk recorder.

The old chunk recorder can remain as:

```text
debug / fallback / batch prototype
```

The new realtime module should become the serious voice path only after the proof page shows real low-latency browser speech-to-speech behavior.
