# Audio Capture And Streaming Report

Date: 2026-06-08

## Summary

The current audio capture and streaming strategy is too simple for a steady voice trainer app.

The app behaves like a batch recorder:

```text
record phrase/chunk
convert audio
base64 encode
send full audio to server
wait for AI
optionally receive streamed answer
repeat
```

This is not real microphone streaming. It is response streaming after a full audio upload.

For the product goal, this is too slow and too unreliable. It explains why the app barely understands two sentences and feels unusable for real practice.

## Current Implementation Problems

### 1. Microphone Stream Is Reopened Per Chunk

`SYSTEM_MEANINGFUL_AUDIO_CHUNK` calls `getUserMedia` for each chunk and stops all tracks when the chunk ends.

This is not a stable voice-app pattern.

Problems:

- repeated browser permission/audio stack setup
- more chance of mobile browser failure
- gaps between chunks
- unstable timing
- harder echo control
- harder cancellation

A voice app should keep one microphone stream open while `LISTEN` is active.

### 2. Listen Loop Waits For AI

The current app loop is sequential:

```text
record chunk
decide useful chunk
send to AI
wait for AI response
sleep briefly
record next chunk
```

While AI is processing, the app is not steadily listening. This can lose speech and makes the app feel slow.

A steady app needs separate responsibilities:

- capture audio continuously
- detect speech boundaries continuously
- send completed turns to processing queue
- process AI independently
- keep UI state stable

### 3. Browser SpeechRecognition Is Used Too Heavily

Browser `SpeechRecognition` / `webkitSpeechRecognition` is currently used as a speech boundary helper.

This is too weak for the product.

Problems:

- unreliable on mobile
- unreliable on iOS
- unreliable for accented learner speech
- language hint is not real multilingual detection
- can stop too early on interim text
- can miss second sentences
- can behave differently per browser

Browser SpeechRecognition can stay as a demo mode, but it should not be the main production recognition or boundary strategy.

### 4. No Real VAD

The current audio energy check is useful but not enough.

Energy detection answers:

```text
is there sound?
```

It does not answer:

```text
is there human speech?
did speech start?
did speech end?
is this background noise?
is this the app speaker?
```

Without real VAD, chunks are cut badly or sent when they should be skipped.

### 5. Chunk Decision Mode Is Not A Real Strategy

The input exposes:

```ts
chunkDecisionMode: "auto" | "browser_speech_text" | "audio_energy"
```

But the useful-chunk decision effectively accepts either browser speech text or energy.

That makes the setting misleading. A debug page may say one strategy, but the real method does not strictly execute that strategy.

This violates the project rule that debug output must show the real business decision.

### 6. Audio Conversion Is Slow And Fragile

Browser audio is often recorded as `audio/webm`.

The app then:

- decodes browser audio with `AudioContext`
- encodes WAV in the browser
- base64-encodes the WAV
- sends it inside JSON

Problems:

- slow
- memory-heavy
- bigger payload than compressed audio
- base64 overhead
- browser decode failures
- mobile instability

This is especially bad if done repeatedly during listen mode.

### 7. Recognition And Tutoring Are Mixed Too Early

The current audio analyser asks the AI to do many jobs in one step:

- hear original audio
- infer transcript
- detect keyword control
- decide whether to correct
- produce structured JSON
- sometimes produce spoken audio

This is too much for reliable speech recognition.

For accuracy, the first business step should be transcription. Correction and control decisions should run after a reliable transcript exists.

### 8. Response Streaming Does Not Fix Input Latency

`VOICE_AGENT_STREAM_VOICE_TURN` streams output events, but the input audio is still uploaded as a complete base64 blob first.

So the user does not get true realtime voice behavior.

This can improve answer playback timing after the server starts, but it does not solve:

- slow phrase capture
- slow conversion
- slow upload
- poor chunk boundaries
- lost speech between chunks

### 9. React State Is Too Loose For Voice

The current app uses many separate state variables and refs for voice flow.

Examples:

- listen enabled
- running
- speaking ref
- stop listen ref
- listen run id
- last assistant text
- last correction text
- speak enabled ref

This is fragile for audio because audio is a state-machine problem.

The app needs one explicit state model:

```text
idle
listening
speech_detected
recording_turn
processing_turn
speaking
stopping
error
```

Without this, stale AI results, speak toggles, stopped listening, and playback feedback can race each other.

### 10. Speaker Feedback Protection Is Too Weak

The app tries to avoid feedback by comparing recognized text against the last assistant/correction text.

That is not enough.

A robust system needs:

- app state: never send audio while speaker playback is active
- audio output cancellation
- optional echo cancellation constraints
- clear cooldown after playback
- VAD gated by app state

## Why Voice Recognition Is Extremely Bad

The bad recognition is probably caused by multiple problems together:

- speech chunks start/stop at poor times
- second sentence is cut off or merged badly
- browser SpeechRecognition boundary helper is unreliable
- no real VAD
- listen pauses while AI is processing
- repeated microphone open/close creates gaps
- audio conversion adds delay and failure risk
- audio model is asked to analyse/correct JSON instead of first transcribing cleanly
- mobile browser APIs behave inconsistently

This is not a small tuning issue. The capture architecture itself is too weak.

## Better Target Architecture

### Production-Grade Listen Flow

```text
LISTEN on
  -> open one microphone stream
  -> AudioWorklet reads PCM frames
  -> real VAD detects speech start/end
  -> rolling pre-buffer preserves first words
  -> completed utterance is sent to STT/realtime service
  -> transcript returned
  -> server decides keyword/control/correction
  -> UI shows text/lamp
  -> if speak allowed, server creates short speech
  -> playback runs while capture is gated
```

### Separate Business Methods

Recommended method split:

```text
CLIENT_AUDIO_SESSION_START
CLIENT_AUDIO_SESSION_STOP
CLIENT_AUDIO_FRAME_STREAM
CLIENT_VAD_DECIDE_SPEECH_SEGMENT
SERVER_TRANSCRIBE_AUDIO_TURN
SERVER_DECIDE_VOICE_AGENT_ACTION
SERVER_CORRECT_OR_ANSWER_TEXT
SERVER_TEXT_TO_SPEECH
```

Each method should return status, debug, and business steps.

### Recognition Strategy

Better default:

1. Real STT first.
2. Correction/keyword decision second.
3. Optional TTS third.

Do not use the audio analysis model as the main transcription engine until the transcription path is proven.

### Streaming Strategy

Use one of these real approaches:

- OpenAI realtime session / WebRTC-style realtime voice path.
- WebSocket from browser to server with PCM frames.
- Dedicated STT provider streaming endpoint.
- Local browser demo mode only as clearly marked fallback.

Do not call full-blob upload "streaming".

## What Should Be Marked Not Implemented

These should be marked clearly until proven:

- real realtime microphone input streaming
- real VAD
- production-ready mobile listen mode
- iOS reliable listen/speak loop
- Android reliable listen/speak loop
- two-sentence continuous recognition
- speaker echo suppression
- low-latency voice turn

## Recommended Next Work

1. Stop treating the current chunk loop as production voice.
2. Add a real architecture plan for continuous microphone session + VAD + STT.
3. Create a proof page that measures:
   - time to start microphone
   - time to detect speech
   - time to speech end
   - time to transcript
   - time to correction decision
   - time to first spoken audio
4. Test with fixed audio samples first.
5. Then test Chrome desktop microphone.
6. Then test Android.
7. Then test iPhone/iPad.

## Decision

The current capture and streaming strategy should not be patched further as the main voice path.

It can remain as:

```text
browser demo / debug prototype
```

The real app needs a new voice pipeline built around continuous capture, real VAD, real STT, and a strict server-side decision step.
