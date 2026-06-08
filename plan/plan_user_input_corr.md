# Tech Stack

- Web app: Node, TypeScript, standard
- Multi-client / user server
- Logic and AI call decisions are on the server as main functionality, not API, not in the client web. State is in DB or cached files; server is stateless.
- important no hacks  standard setups standard libraries standard use
- Local standard Node deployment
- Cloudflare and https://www.lernspass.net/ https://aitutor.lernspass.net/ or other domains configured later   standard setup over    automatic deployement from git
- App runs from `/` root or `apps/aitutor/`
- Design: web and mobile, light Cloudflare style, icons and all that
- PWA
- Switch AI chat, listen, and voice providers
- Question: Can the onboard AI be used on iOS or Android?
- Test in different browsers and on Android, iPad, and iPhone

Build a French, other language, or topic like History voice training app that stays out of the user's way. The app listens, captures practice sentences, corrects French, and only speaks when the user explicitly asks.

Now the reason I want this is that GPT chat is not good enough. GPT chat cannot stay out of the way and stay silent.

Can you tell me briefly: is it possible to interrupt and stop responses or questions, except when, let’s say, I ask with the keyword "computer" or press a button, and then it responds?

We are in this folder. Do not change anything outside:

`C:\dev\rtx_ai_voice_trainer`

Can you build a chat app with voice listen and response?

## Requirements

1. I want a Chat.
2. I want a toggle to activate LISTEN.
3. I want a button toggle to activate SPEAK.
4. I need voice in, text + optional voice.

The idea is to collect the conversation text history of a few talks; delete older ones, do not pile up memory, files, or DB.

History should collect text from a few previous talks and correction texts.

AI listener should return:

{
  "text": "original",
  "text_corrected": "corrected",
  "keywordsent": true
}

Maybe more computer-readable info later, plus voice, so a structured response.

5. Important: our AI only speaks if asked by keyword or button. Otherwise, it stays silent. Once activated and the user asks a question to the AI directly, it can answer in chat style with full talk, then go silent/minimal again.

## Features Simple Use

2 toggle buttons:

- LISTEN
- SPEAK

## Settings

- Switch providers
- See/edit prompts about style of answer or topic
- See fixed system prompts like the instruction about JSON and general behavior rules, etc.
- Debug: see system errors, see entire listen request/answer activity with detailed messages and result
- Track costs over time with DB

## Listen

- When active, AI listens and sends notes about whether there is improvement or mistakes to correct.
- AI always sends JSON computer-evaluable response with exact fields/values for signaling whether there are corrections, etc.
- In that, a message text to the user is added and shown to the user.
- The signals "has improvement" or "mistakes" are signaled by a status color lamp or some nice way.
- Listen and debug keep track of the past 5 messages.
- If SPEAK is off, corrections just come in chat message.
- If SPEAK is on, voice corrects the user about the last 1 mistake.
- Also, a keyword "computer" activates, and "computer off" deactivates SPEAK. AI sends if keyword on/off is sent and ignores it in its corrections.
- Messages and voice are short, just the correction plus a short hint why, as short as possible.
- The user can ask for detailed info; then the AI can speak in more detailed chat.


## Requirements

1. I want a Chat.
2. I want a toggle to activate LISTEN.
3. I want a button toggle to activate SPEAK.
4. I need voice in, text + optional voice.

The idea is to collect the conversation text history of a few talks; delete older ones, do not pile up memory, files, or DB.

1. History collects text of a few previous talks and correction texts.
2. AI listener should return:

```json
{
  "text": "improvment: ...  why: ...",// chat message  short for user to read
  "text_corrected": "improved", "corrected" // important improvment or big mistake
  "keyword_on_sent": true,
  "keyword_off_sent": false,
  ... computer evaluated predefined fields and fixed values or numbers
}

the exact fiel names must be defined


ai  does not edit user_input  it creates a own plan in plan_ai folder