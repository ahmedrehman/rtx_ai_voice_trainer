# V2 Rules And Findings

This document records the V2 behavior rules discovered during testing. These are app rules, not guesses and not AI responsibility.

## Core Rule

Chat is always written.

Voice is optional and controlled only by:

- `Speak on/off`
- selected speak level
- detected signal level

The speak level must never suppress chat text. It only suppresses voice playback.

## Voice Output Rules

- `Speak off`: write correction/answer in chat. Do not auto-play voice.
- `Speak on`: write correction/answer in chat and play voice only when allowed by level.
- Green / level `0`: never speak.
- Yellow / level `1`: speak only when selected speak level is `1+`.
- Orange / level `2`: speak only when selected speak level is `1+` or `2+`.
- Red / level `3`: speak when selected speak level is `1+`, `2+`, or `3`.
- Below selected level: do not speak, but still write chat.

## Signal Codewords

Old words were too easy to confuse with normal AI text:

- `Exacte`
- `Mieux`
- `Correction`

Current signal codewords:

- `SignalVert` = green / level `0`
- `SignalJaune` = yellow / level `1`
- `SignalOrange` = orange / level `2`
- `SignalRouge` = red / level `3`

The app must treat only these codewords as level signals. Normal words like `correction`, `mistake`, or `mieux` must not by themselves force a level.

## Green Result

Green must not create spoken audio.

Expected behavior:

- show chat text
- if AI text is empty, show short app fallback text: `OK`
- no auto-play
- no voice output

## Free Chat

Free chat is normal chat.

Expected behavior:

- answer user questions
- do not translate unless asked
- do not correct unless asked for correction or feedback
- do not treat every target-language sentence as a correction exercise

## Small Pronunciation Issues

Small pronunciation or accent issues are not high-level mistakes.

Expected behavior:

- small pronunciation/accent improvement = `SignalJaune` / level `1`
- vocabulary or meaning problem = `SignalOrange` / level `2`
- real grammar or severe meaning mistake = `SignalRouge` / level `3`

## Playback Timing

Voice must not wait until chat rendering finishes.

Expected behavior:

- when stream audio chunks are available and level allows speech, playback starts from the stream
- if fallback final audio is used, playback starts before the chat write path waits
- chat is still written for every result

## API Key Flow

The OpenAI API key must never go to the browser.

Flow:

```text
Browser -> Cloudflare Worker/server -> OpenAI -> Worker/server -> Browser
```

The key is read server-side from `env.OPENAI_API_KEY` and sent to OpenAI as an Authorization bearer token.

## Audio Pack / Roundtrip Behavior

The app sends audio packs to the server. The debug page has a server audio roundtrip mode to verify that captured audio is not broken.

The main debug listen path must test the app behavior exactly:

```text
debug Listen button -> same AI path as normal app
```

Debug controls must not silently change the functional app test path. Any audio roundtrip behavior must stay a separate diagnostic action.

Roundtrip expected behavior:

```text
browser mic -> local threshold/silence pack -> server audio roundtrip -> returned audio autoplay
```

AI mode expected behavior:

```text
browser mic -> local threshold/silence pack -> AI voice turn stream -> chat and optional voice
```

## Known Testing Lesson

The rules above must be verified from the code path and the live app behavior. Do not answer from memory or assumptions.
