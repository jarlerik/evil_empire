# @evil-empire/peaktrack-api

PeakTrack backend — Hono on AWS Lambda Function URL, `RESPONSE_STREAM` invoke
mode, esbuild-bundled. Two clients call this service: the web app
(`@evil-empire/web-app`) and, after PR 7's mobile-adoption follow-up, the
mobile app. The actual security boundary is JWT verification; CORS is
browser hygiene only.

## Endpoints

- `GET /health` — liveness check, returns `{ ok: true, timestamp }`.
- `POST /api/coach/prompt` — placeholder. PR 1 ships only the JWT-required
  shell (`401` without a valid Supabase JWT, `501` with one). PR 7 adds the
  AI-provider call and SSE streaming.

## Local dev

```bash
cp .env.example .env.local
# fill in SUPABASE_URL at minimum (the JWKS URL is derived from it)
pnpm dev          # tsx watch src/server.ts on :3001
```

The dev server uses `@hono/node-server` for fast reload + accurate Hono
behaviour. `sam local start-invoke` is reserved for pre-deploy parity
testing of the actual Lambda packaging via `pnpm smoke`.

## Deploy

```bash
pnpm deploy:staging   # → stack peaktrack-api-staging
pnpm deploy:prod      # → stack peaktrack-api-prod
```

Each deploy script runs `pnpm bundle && sam build && sam deploy` in that
order. The bundle step (`scripts/bundle.mjs`) uses esbuild to inline workspace
deps (`@evil-empire/peaktrack-services`, `@evil-empire/types`) and writes the
result to `dist/`; SAM then packages `dist/` as the Lambda payload. We bundle
ourselves rather than rely on SAM's `NodejsNpmEsbuildBuilder` because that
builder runs `npm install` against `package.json`, and npm doesn't speak
pnpm's `workspace:*` protocol.

First-time deploys need the parameters supplied via overrides:

```bash
pnpm bundle && sam build && sam deploy --config-env staging \
  --parameter-overrides \
    SupabaseUrl=https://....supabase.co \
    AnthropicApiKey=...
```

After the first deploy stores them in the stack, subsequent deploys reuse
the existing values.

## Security

- **JWT verification** — `src/middleware/jwt.ts` verifies tokens against
  Supabase's JWKS endpoint (asymmetric, derived from `SUPABASE_URL`). The
  Lambda holds only public verification material; the private signing key
  never leaves Supabase, so a Lambda compromise can't forge tokens. Key
  rotation is transparent — `jose`'s remote-set cache picks up new `kid`s
  on the next miss without redeploy. Both web and mobile clients carry
  tokens from the same Supabase project, so one verification path serves
  both.
- **CORS** — `src/middleware/cors.ts` reads `CORS_ALLOWED_ORIGINS`
  (comma-separated) and adds dev defaults (`localhost`, `null`,
  `capacitor://localhost`) when `NODE_ENV !== 'prod'/'staging'`. Add a LAN
  IP to the env var when testing Expo Go on a physical phone — no code
  change needed.
- **Secrets** — `ANTHROPIC_API_KEY` (PR 7) is the only Lambda secret.
  Stored as a `NoEcho` SAM parameter and injected as a Lambda env var at
  runtime; never committed.

## Module layout

```
src/
  app.ts            # Hono app factory (shared by Lambda + node-server)
  index.ts          # Lambda Function URL adapter (streamHandle)
  server.ts         # Local dev runner (@hono/node-server)
  env.ts            # Strict env-var loader (fail-fast on missing required)
  middleware/
    cors.ts
    jwt.ts
  routes/
    health.ts
  coach/            # Self-contained module — split criteria documented in
    index.ts        # the plan; folder-move not a rewrite if we ever do it.
```
