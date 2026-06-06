# Voice Enablement

## What Starts Microphone Access

- microphone starts only after direct user action
- example: user clicks `Run microphone chunk`
- browser permission dialog may appear
- request must be audio only
- request must not ask for camera

```ts
navigator.mediaDevices.getUserMedia({
  audio: true,
  video: false
});
```

## Required Browser Conditions

- HTTPS or localhost
- browser supports `navigator.mediaDevices.getUserMedia`
- browser supports `MediaRecorder`
- user allows microphone permission
- user does not block microphone at browser/site settings

## What `SYSTEM_MEANINGFUL_AUDIO_CHUNK` Does

- asks browser for microphone audio
- records with `MediaRecorder`
- optionally uses browser `SpeechRecognition` as speech boundary checker
- returns audio chunk
- returns `chunkReason`
- returns standard `status`

## If Browser SpeechRecognition Exists

- used only as helper
- detects final speech result if browser provides it
- helps stop recording after speech or silence
- not used as real AI pronunciation analysis
- not trusted as final trainer result

## If Browser SpeechRecognition Is Missing

- method still records microphone audio
- recording stops at `maxDurationMs`
- output shows:

```json
{
  "chunkReason": "no_speech_checker"
}
```

## iOS Notes

- iOS Chrome uses Apple WebKit
- SpeechRecognition can be missing or unreliable
- microphone must be started from user click
- audio playback can require user click
- installed PWA may behave differently than browser tab

## Output

```ts
{
  status,
  audio,
  mimeType,
  durationMs,
  chunkReason,
  browserSpeechText
}
```

## Status

```ts
{
  method,
  ok,
  phase,
  startedAt,
  finishedAt,
  error
}
```

## What This Does Not Do

- does not call OpenAI
- does not analyse pronunciation
- does not correct text
- does not fetch prompts
- does not read DB/settings
- does not start camera
