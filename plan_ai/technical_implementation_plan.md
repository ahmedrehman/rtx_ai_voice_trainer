# French Voice Trainer AI - Technical Implementation Plan

## Project Structure

```text
C:\dev\rtx_ai_voice_trainer
  app\
    src\
    index.html
    package.json
    tsconfig.json
  plan_ai\
    business_functionality_plan.md
    technical_implementation_plan.md
  plan\
  plan_user_input.md
```

All application code should live inside `app`.

Planning and product documents should live inside `plan_ai` or `plan`.

Do not modify files outside `C:\dev\rtx_ai_voice_trainer`.

## Application Stack

Initial app:

- Node.js
- TypeScript
- React
- Vite
- Browser SpeechRecognition for local prototype speech-to-text
- Browser SpeechSynthesis for local prototype text-to-speech

Later production app:

- Cloudflare Pages for frontend hosting
- Cloudflare Workers for secure provider API calls
- Cloudflare KV, D1, or Durable Objects for usage/cost storage if needed
- PWA manifest and service worker for installable web app behavior

## Architecture

The app should keep four responsibilities separate:

1. Listen
2. Decide whether to answer
3. Correct French
4. Speak output

This separation protects the silent-by-default rule.

## Data Flow

```text
Microphone
  -> speech-to-text
  -> transcript
  -> trigger detector
  -> correction provider
  -> structured response
  -> chat history
  -> optional text-to-speech
```

The AI should not decide by itself whether to speak. The app decides based on user settings and trigger state.

## Trigger Logic

Inputs:

- transcript text
- Answer Now button state
- keyword list
- voice output toggle
- always listen toggle

Rules:

- Always listen may capture text.
- Always listen must not force a response.
- Answer Now forces a response for the next input.
- Keyword detection allows a response.
- Optional voice controls whether the response is spoken.

Example logic:

```ts
const keywordSent = transcript.toLowerCase().includes("computer");
const shouldRespond = answerNow || keywordSent;
const shouldSpeak = shouldRespond && optionalVoice;
```

## Structured Response Contract

Initial correction response:

```ts
type StructuredCorrection = {
  text: string;
  corrected: string;
  keywordSent: boolean;
  shouldRespond: boolean;
  trigger: "keyword" | "button" | "manual-text" | "silent";
  notes: string[];
};
```

Provider implementations should return this shape.

If a provider returns unstructured text, the app should normalize it into this shape before storing it in chat history.

## Provider Adapter Design

Create a provider interface:

```ts
type VoiceTrainerProvider = {
  id: string;
  name: string;
  transcribe?: (audio: Blob) => Promise<string>;
  correct: (input: CorrectionInput) => Promise<StructuredCorrection>;
  speak?: (text: string) => Promise<Blob>;
  estimateCost: (usage: ProviderUsage) => number;
};
```

Suggested adapters:

- `browserDemoProvider`
- `openAiProvider`
- `deepgramElevenLabsProvider`
- `azureSpeechProvider`

Keep provider-specific pricing, request formats, and usage parsing inside each adapter.

## Cost Tracking

MVP:

- Store estimated costs in localStorage.
- Count turns per provider.
- Estimate based on characters or minutes.

Production:

- Track actual provider usage returned by APIs.
- Store usage events in Cloudflare D1 or KV.
- Show totals by provider, date, and session.

Suggested event shape:

```ts
type UsageEvent = {
  providerId: string;
  feature: "stt" | "correction" | "tts" | "realtime";
  inputUnits: number;
  outputUnits: number;
  estimatedCostUsd: number;
  createdAt: string;
};
```

## Cloudflare Deployment Plan

### Phase 1: Cloudflare Pages

Deploy the Vite frontend from `app`.

Build command:

```bash
npm run build
```

Build output:

```text
dist
```

Root directory:

```text
app
```

Base path:

```text
VITE_BASE_PATH=/
```

For a mounted path such as `/apps/aitutor`, set:

```text
VITE_BASE_PATH=/apps/aitutor/
```

This keeps built asset URLs, service worker registration, and install metadata aligned with the deployed path.

### Phase 2: Cloudflare Worker API

Add a Worker to hide API keys and call paid providers.

Endpoints:

- `POST /api/correct`
- `POST /api/transcribe`
- `POST /api/speak`
- `GET /api/providers`
- `GET /api/usage`

The browser should never contain provider API keys.

### Phase 3: Storage

Add storage only when needed.

Options:

- KV for simple settings and totals.
- D1 for structured usage history.
- Durable Objects for live session coordination.

## PWA Plan

Add:

- `public/manifest.webmanifest`
- app icons
- service worker
- install prompt support
- offline fallback screen

PWA settings:

- Display mode: standalone
- Start URL: `/`
- Theme color should match the app UI
- Microphone permission remains browser-controlled

The app should still work as a normal website if the user does not install it.

## Security Notes

- Never expose paid provider API keys in frontend code.
- Put API keys in Cloudflare Worker environment secrets.
- Validate request sizes before sending audio to providers.
- Limit stored conversation history.
- Let users clear local history and costs.

## Implementation Phases

### Phase 1: Local Prototype

- Build chat UI.
- Add toggles.
- Add browser voice capture.
- Add optional browser voice output.
- Add structured demo correction.
- Add provider and cost info tabs.

### Phase 2: Real Provider Integration

- Add OpenAI correction endpoint through Cloudflare Worker or local dev API.
- Add real structured JSON response.
- Add real speech-to-text provider.
- Add real text-to-speech provider.

### Phase 3: Cloudflare Release

- Prepare Cloudflare Pages config.
- Add Worker API.
- Add environment secrets.
- Add production cost logging.

### Phase 4: Installable App

- Add PWA manifest.
- Add service worker.
- Add icons.
- Test install behavior on desktop and mobile.

## Current Recommendation

Keep the first version simple:

- Browser speech for prototype.
- OpenAI as first real provider.
- Text corrections by default.
- Voice output only on explicit request.

This proves the product behavior before spending time on complex voice infrastructure.
