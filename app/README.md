# French Voice Trainer App

Node + TypeScript web app prototype for a French voice trainer that stays silent unless triggered.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Build For A Mounted Path

For the Cloudflare mounted path:

```bash
VITE_BASE_PATH=/apps/aitutor/ npm run build
```

For a root deployment:

```bash
VITE_BASE_PATH=/ npm run build
```

## Cloudflare Worker From GitHub

This app deploys as a Cloudflare Worker with static assets, not Cloudflare Pages.

Use Cloudflare Workers Builds with the GitHub repository:

```text
https://github.com/ahmedrehman/rtx_ai_voice_trainer
```

Build settings:

```text
Production branch: master
Root directory: app
Build command: npm run build
Deploy command: npm run deploy:cloudflare
```

The production build defaults to `/`. Set `VITE_BASE_PATH=/apps/aitutor/`
only when deploying the same build under that mounted path.

Before the first deploy, create the D1 database in Cloudflare and replace
`replace-with-cloudflare-d1-database-id` in `wrangler.toml`.

The Worker runtime variable is already set in `wrangler.toml`:

```text
APP_BASE_PATH=/apps/aitutor/
```

Runtime provider keys belong in Worker variables and secrets, not Vite browser variables.

See `plan_ai/cloudflare_github_setup.md` for the full GitHub-connected Worker setup.
