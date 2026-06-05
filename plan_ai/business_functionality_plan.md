# French Voice Trainer AI - Business Functionality Plan

## Goal
[User input  ] language can change  it may even be a topic like history.

Build a French or other language topic voice training app that stays out of the user's way. The app listens, captures practice sentences, corrects French, and only speaks when the user explicitly asks.

The main difference from ChatGPT Voice is control: the trainer must not interrupt, over-answer, or start a conversation by itself.

## Core User Experience

The user practices speaking French. The app records/transcribes the speech and keeps a short conversation history. By default, the app stays silent.
[User input  ] the app can give viual feed back or text chant or a button that highlichts  ERROR  IMPROVMENT  for correction possibilities  these features can be activated in config

- [User input  ] Listen mode active  then it listens also when no answer now is active yet and records conversation as text if voice is anyway coming corrections  keep correction of last if it allready sent in voice.  corrections in voice must be short only the correction no bla, maybe a reason explaination minnimal hint  so i can ask for details.
The AI responds voice only when one of these triggers happens:

- The user presses an Answer Now button.
- The user says a keyword such as "computer".
- The user manually sends a typed message .
 
If none of those triggers happen, the app should only save the text and show that it captured the sentence silently. 

## Main Features

### 1. Chat

The main screen is a chat-style practice area.

It should show:

- What the user said.
- What the AI corrected.
- Whether the AI answered or stayed silent.
- The structured response used internally.

The chat should keep the last few turns so the AI can understand recent context without storing too much.

### 2. Voice Input

The user can speak French into the app.

Voice input modes:

- Manual listen: the app listens only after the user presses a button.
- Always listen: the app keeps listening continuously or repeatedly.

Always listen does not mean always answer. It only means always capture.

### 3. Silent By Default

This is the most important product rule.

The app must not speak or correct out loud unless:

- Answer Now is active.
- A keyword is detected.
- The user explicitly enables spoken output for the current interaction.

This prevents the trainer from disturbing the learning flow.

### 4. Voice Output

The app supports voice in, text plus optional voice out.

Default output:

- Text correction is shown in chat.
- Voice output is off unless requested.

Optional voice output:

- The AI reads the correction out loud.
- The user can stop the voice response immediately.

### 5. Structured AI Response

The AI should return structured data, not only natural language.

Initial structure:

```json
{
  "text": "original user sentence",
  "corrected": "corrected French sentence",
  "keywordSent": true,
  "shouldRespond": true,
  "trigger": "keyword",
  "notes": ["short correction explanation"]
}
```

Later this can expand with:

- grammar tags
- confidence score
- pronunciation notes
- CEFR level
- vocabulary suggestions
- repeat-after-me exercises

### 6. Provider Switching

The app should support multiple providers because cost, quality, latency, and privacy needs can change.

Provider examples:

- Browser demo mode
- OpenAI
- Deepgram plus ElevenLabs
- Azure Speech
- Google Cloud Speech

The user should be able to choose the provider in an Info or Settings tab.

### 7. Cost Tracking

The app should show estimated cost per provider.

Cost tracking should include:

- Number of turns.
- Estimated speech-to-text cost.
- Estimated AI correction cost.
- Estimated text-to-speech cost.
- Total per provider.

Early versions can use estimates. Later versions should use real token/minute usage returned by provider APIs.

### 8. Web App Installability

The product should work as a web app first and later be installable like an app.

Target behavior:

- Runs in the browser.
- Can be installed to desktop/mobile as a PWA.
- Keeps local settings.
- Works well with microphone permissions.

## MVP Scope

The first useful version should include:

- Chat screen.
- Voice input.
- Text corrections.
- Optional spoken correction.
- Answer Now button.
- Always listen toggle.
- Voice talk toggle.
- Provider selection UI.
- Cost estimate UI.
- Structured response display.

The MVP can use demo correction logic at first. Real provider calls can be added after the interaction model feels right.

## Important Product Decisions

The AI should be a trainer, not a general assistant.

It should prefer:

- short corrections
- direct grammar explanations
- no long lectures
- no unsolicited questions
- no automatic conversation takeover

The app should make the user feel in control of when feedback happens.
