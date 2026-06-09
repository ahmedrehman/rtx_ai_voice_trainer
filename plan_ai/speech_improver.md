# Speech Improver App Idea

Date: 2026-06-09

## Goal

Create a simple browser app that listens to the user speaking and updates a list of improvement events.

This is simpler than the full voice trainer.

The app does not need to chat much.
It mainly listens and reports:

- mistakes
- improvements
- repeated habits
- pronunciation hints
- grammar hints
- vocabulary hints
- clarity hints

## Core Idea

The user speaks naturally.

The app listens and asks AI to return structured events.

Example:

```json
{
  "events": [
    {
      "type": "grammar_mistake",
      "severity": "medium",
      "flag": "wrong_verb_form",
      "text": "Je suis aller",
      "suggestion": "Je suis allé",
      "hint": "Use the past participle with être."
    },
    {
      "type": "improvement",
      "severity": "low",
      "flag": "clearer_pronunciation",
      "text": "bonjour",
      "suggestion": "",
      "hint": "The opening sound was clearer than before."
    }
  ]
}
```

## User Experience

The screen can be very simple:

- Listen on/off
- Topic/language setting
- Live status:
  - listening
  - voice detected
  - analysing
  - no speech
- Event list
- Current flags
- Hints

No normal chat is required for the first version.

## Event List

The app keeps a short list of recent events.

Possible event types:

- `grammar_mistake`
- `pronunciation_mistake`
- `accent_hint`
- `vocabulary_mistake`
- `meaning_unclear`
- `fluency_pause`
- `improvement`
- `good_sentence`

Possible severity:

- `low`
- `medium`
- `high`

Possible flags:

- `wrong_verb_form`
- `wrong_gender`
- `wrong_article`
- `missing_liaison`
- `unclear_word`
- `too_long_pause`
- `better_than_previous`
- `repeated_mistake`

## Prompt Shape

The prompt should be strict and simple:

```text
You are a speech improvement event detector.

Listen to the user's speech.
Return only structured JSON events.
Do not chat with the user.
Do not ask questions.
Do not give long explanations.

For each useful observation, return:
- type
- severity
- flag
- original text if available
- suggested improvement if available
- one short hint

If there is no useful event, return an empty events array.
```

## Output Contract

```ts
type SpeechImproverEvent = {
  type:
    | "grammar_mistake"
    | "pronunciation_mistake"
    | "accent_hint"
    | "vocabulary_mistake"
    | "meaning_unclear"
    | "fluency_pause"
    | "improvement"
    | "good_sentence";
  severity: "low" | "medium" | "high";
  flag: string;
  originalText: string;
  suggestion: string;
  hint: string;
};

type SpeechImproverOutput = {
  events: SpeechImproverEvent[];
};
```

## Realtime Version

Best future path:

```text
browser mic
-> realtime AI session
-> AI sends structured event messages over data channel
-> UI updates event list
```

The AI can speak back later, but first version should be silent/list-only.

## Cost Control

Use the same idea as realtime voice trainer:

- mic can stay open locally
- local VAD detects speech
- AI session starts only when speech starts
- pre-buffer preserves first words
- AI session closes after silence
- no long silence sent to AI

## Difference From Voice Trainer

Voice trainer:

- chat plus corrections
- optional spoken answer
- keyword/button controls
- may answer questions

Speech improver:

- mostly listen-only
- updates flags/events
- minimal or no spoken response
- less conversational
- easier to test

## First Proof

Create a debug page that:

- starts microphone
- detects voice
- sends speech to AI
- receives structured events
- shows event list
- shows raw event JSON
- shows usage/cost if available

## Decision

This is a good second app idea.

It should probably be a separate module:

```text
app/src/speech_improver/
app/src/speech_improver_test/
```

Do not mix it into the current voice trainer until the module contract is clear.
