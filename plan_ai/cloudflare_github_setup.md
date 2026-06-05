# Cloudflare Worker Setup Through GitHub

Use this for the standard Cloudflare Workers GitHub flow. The app is a Worker
that serves Vite static assets from `dist` and handles backend API routes under
`/api/*`.

Cloudflare's Workers Git integration connects a GitHub repository to a Worker
and automatically deploys on push. It also reports build status back to GitHub.

## Repository

```text
https://github.com/ahmedrehman/rtx_ai_voice_trainer
```

## One-Time Cloudflare Setup

1. Open the Cloudflare dashboard.
2. Go to **Workers & Pages**.
3. Create or select the Worker named:

```text
rtx-ai-voice-trainer
```

4. Go to **Settings > Builds**.
5. Connect GitHub with the **Cloudflare Workers and Pages** GitHub App.
6. Select the repository:

```text
rtx_ai_voice_trainer
```

## Build Settings

Use these settings for Workers Builds:

```text
Production branch: master
Root directory: app
Build command: npm run build
Deploy command: npm run deploy:cloudflare
```

The deploy command publishes the Worker:

```text
wrangler deploy
```

Run the remote D1 migration after the production D1 database ID is in
`app/wrangler.toml`.

## D1 Database

Create the production D1 database in Cloudflare:

```powershell
cd app
npx wrangler d1 create rtx_ai_voice_trainer_costs
```

Copy the returned `database_id` into `app/wrangler.toml`:

```toml
[[d1_databases]]
binding = "COST_DB"
database_name = "rtx_ai_voice_trainer_costs"
database_id = "your-cloudflare-d1-database-id"
```

The migration file is:

```text
app/migrations/0001_provider_costs.sql
```

## Build Variables

The app is already configured for the mounted path:

```text
VITE_BASE_PATH=/apps/aitutor/
```

Only set a different value if the deployment path changes. For root deployment:

```text
VITE_BASE_PATH=/
```

Only use `VITE_*` variables for values that are safe to expose to the browser.

The Worker runtime path is committed in `app/wrangler.toml`:

```text
APP_BASE_PATH=/apps/aitutor/
```

## Runtime Secrets

Provider API keys must be Worker runtime secrets or variables, not frontend
build variables:

```text
OPENAI_API_KEY
DEEPGRAM_API_KEY
ELEVENLABS_API_KEY
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
GOOGLE_CLOUD_API_KEY
```

Set secrets in **Worker > Settings > Variables and Secrets**, or with Wrangler:

```powershell
cd app
npx wrangler secret put OPENAI_API_KEY
```

## Local Commands

```powershell
cd app
npm install
npm run build
npm run dev:worker
```

Run local D1 migrations when testing locally:

```powershell
cd app
npm run db:migrate:local
```

## Deploy Flow

After the GitHub integration is saved, each push to `master` triggers a Worker
build and deploy from Cloudflare.

Normal local-to-GitHub flow:

```powershell
git status
git add .
git commit -m "Set up Cloudflare Worker GitHub deployment"
git push
```

## Notes

- `app/wrangler.toml` is the source of truth for Worker name, entrypoint,
  static assets, SPA fallback handling, and D1 binding.
- `app/src/worker.ts` is the Worker entrypoint.
- `app/src/server/http.ts` handles `/api/*` routes and delegates all other
  requests to `env.ASSETS`.
- Do not deploy this as Cloudflare Pages unless the Worker API is separated.
