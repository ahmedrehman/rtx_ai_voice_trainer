# AI Tutor Voice Trainer

AI Tutor Voice Trainer is a browser-based speaking practice app for language learners. It listens to short spoken turns, checks whether the speech is clear and well structured, and gives concise feedback only when it is useful.

Live Cloudflare app: [https://aitutor.lernspass.net/](https://aitutor.lernspass.net/)

## Core Features

- Practice speaking directly in the browser with your microphone.
- Get short correction-focused feedback for pronunciation, vocabulary, meaning, grammar, and structure.
- Use normal free chat mode when you want answers instead of correction feedback.
- Choose whether the app should speak corrections aloud.
- Keep green results quiet: correct or clear answers stay in chat and do not trigger correction audio.
- Review correction feedback in chat, with audio playback links when a recorded spoken turn needs attention.
- Install the app from the browser as a PWA on supported devices.

## How To Use

1. Open [AI Tutor Voice Trainer](https://aitutor.lernspass.net/).
2. Allow microphone access when the browser asks.
3. Pick a topic.
4. Turn listening on.
5. Speak a short answer, question, or practice sentence.
6. Read the feedback in chat.
7. Turn speaking on only when you want the app to read correction feedback aloud.

Free chat mode is for normal conversation. Correction mode is for language practice and keeps feedback short.

## Local Installation

Requirements:

- Node.js
- npm
- An OpenAI API key for AI voice and chat features

Clone the repository and install dependencies:

```bash
git clone https://github.com/ahmedrehman/rtx_ai_voice_trainer.git
cd rtx_ai_voice_trainer/app
npm install
```

Create `app/.env` and add your API key:

```text
OPENAI_API_KEY=your_key_here
```

Do not set `VITE_BASE_PATH` for the normal local root URL. Set it only when you intentionally deploy the app under a subfolder.

Start the local app:

```bash
npm run dev
```

Then open the local URL printed by the dev server.

## Build

```bash
cd app
npm run build
```

The production build is used for the Cloudflare-hosted app at [aitutor.lernspass.net](https://aitutor.lernspass.net/).

## License

This project is licensed under the GNU General Public License v3.0.
See the [LICENSE](LICENSE) file for details.
