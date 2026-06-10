# AI Tutor Voice Trainer

AI Tutor Voice Trainer is a browser-based speaking practice app for language learning. It listens to short spoken turns, checks whether the answer is clear enough, and gives concise feedback only when it is useful.

Try the live app: [https://aitutor.lernspass.net/](https://aitutor.lernspass.net/)

## What It Does

- Practice speaking with your microphone directly in the browser.
- Choose a topic and speak short answers or questions.
- Get lightweight feedback for pronunciation, vocabulary, meaning, or grammar.
- Use the signal lamp to see how serious the feedback is:
  - Green: fine, no spoken correction needed.
  - Yellow: small improvement.
  - Orange: vocabulary or meaning issue.
  - Red: important correction.
- Turn free chat on when you want normal answers instead of correction-focused practice.
- Turn speaking on when you want the app to read useful correction feedback aloud.

## How To Use

1. Open [AI Tutor](https://aitutor.lernspass.net/).
2. Allow microphone access.
3. Pick a topic.
4. Enable listening.
5. Speak naturally.
6. Read the feedback in chat, or enable speaking for audible correction feedback.

When the result is green, the app keeps the answer as chat text and does not play correction audio.

## Run Locally

Requirements:

- Node.js
- npm

Start the app:

```bash
cd app
npm install
npm run dev
```

For AI features, provide an OpenAI API key in the local environment:

```bash
OPENAI_API_KEY=your_key_here npm run dev
```

Then open the local URL printed by the dev server.

## Build

```bash
cd app
npm run build
```

The production app is deployed at [aitutor.lernspass.net](https://aitutor.lernspass.net/).
