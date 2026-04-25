---
title: Plan - PeakTrack Web App v1
type: note
permalink: evil-empire/plans/plan-peaktrack-web-app-v1
tags:
- plan
- architecture
- web
- peaktrack
- tanstack-router
- evil_ui
---
	
# Plan — PeakTrack Web App v1

## Status
Draft — 2026-04-23. Revised 2026-04-25.

Original draft chose TanStack Start (anticipating eventual SSR). On review, the SSR premise didn't hold for v1: the AI coach's server-side requirement is satisfied by the separate `peaktrack-api` Lambda that mobile already needs, so the web app has nothing it must render server-side. This revision swaps **TanStack Start → TanStack Router on plain Vite** (static SPA), folds the coach contract types into the existing `@evil-empire/types` package rather than minting `peaktrack-coach-contract`, commits to **HS256 + shared-secret JWT verification** (matching Supabase's actual default), tightens **CORS handling for Expo Go on physical devices** (env-driven allowlist), fixes a stale row in the routing table (`create-workout.tsx` doesn't exist on mobile), reorders PRs so the **shared-package refactor lands before any web product code that depends on it**, and softens the time and bundle-size estimates so they're set against real numbers rather than guessed up front. Reasoning is preserved inline at each affected section so future readers don't have to dig back through chat history.

**Workout execution (the in-session timer flow) is explicitly out of scope for web v1** — web is a management + analytics surface; mobile remains the execution surface.

## Goal

Ship a web application that covers the **management and analytics** surface of the existing React Native/Expo mobile app (`apps/mobile/PeakTrack`): planning workouts, editing exercises, building and assigning programs, viewing history, tracking repetition maximums, and viewing progression. **Live workout execution (the timer-driven "start-workout" flow) stays mobile-only.**

The web app must be able to consume the `@evil-empire/ui` component library, and must have access to a server layer capable of holding secret tokens (required for an AI coach feature that will follow v1).

The existing `getpeaktrack.com` marketing site (`apps/serverless/getpeaktrack-site` + source in `apps/web/getpeaktrack`) **stays as-is**. The only change there is a link pointing to the new web app. Landing/marketing content is explicitly out of scope for this plan.

## Non-goals (v1)

- **Live workout execution / timer UI.** No `start-workout` route, no interval timer, no set-by-set stepping, no audio beeps, no post-workout rating flow. These stay on mobile.
- AI coach feature itself — only the serverless plumbing and token-handling scaffolding lands in v1.
- Rewriting or migrating the existing static landing page.
- Offline support, push notifications, haptics, and other mobile-only surface area that has no clean web analogue.
- SSR-first rendering. v1 ships as a client-rendered SPA to match the rest of the workspace's static-site deploy pattern.

---

## Tech stack

**Framework:** TanStack Router on plain Vite (React 19, file-based routing via `@tanstack/router-plugin/vite`).

Originally specced as TanStack Start with a "switch to SSR later" hedge. The hedge didn't survive review: the only concrete server-side need v1 has is holding the AI provider secret, and that's covered by `peaktrack-api` (a separate Lambda that mobile also calls). With the coach broker living outside the web app, nothing in v1 needs SSR or server functions. TanStack Router gives us the same file-based routing, type-safe routes, route-level code splitting, and `beforeLoad` redirects without the server runtime — and the build is a vanilla Vite SPA that drops straight into the existing S3 + CloudFront deploy pattern (same as `getpeaktrack-site`). If a future feature genuinely needs SSR (e.g., shareable coach summary URLs that need link previews / SEO), the migration path to TanStack Start is mechanical because the router and route files are identical between the two; the cost shows up on the day we actually need it, not now.

**UI library:** `@evil-empire/ui` (`apps/evil_ui`) consumed directly via `react-native-web`.

The library's own Vite showcase already aliases `react-native` → `react-native-web` and resolves `.web.tsx` extensions, so this is a validated path. The web app Vite config will mirror those aliases 1:1. If a specific component proves problematic on web (keyboard focus, hover states, semantic HTML), we add a `Component.web.tsx` sibling inside `apps/evil_ui/src/components/` — that is future work, not v1 work.

**Styling:** NativeWind / Tailwind via the `@evil-empire/ui/tailwind-preset` that the UI package already exports. The web app's `tailwind.config.js` extends this preset so color tokens, typography, spacing, and radius match mobile exactly.

**State / data:**
- `@supabase/supabase-js` for auth and DB access (direct from browser, same as mobile — RLS on Supabase already enforces tenancy).
- `@tanstack/react-query` for server-state caching, alongside the singleton Supabase client. The React Context approach the mobile app uses for `AuthContext` and `UserSettingsContext` is preserved; per-entity data (workouts, programs, exercises) moves to React Query hooks that call into `@evil-empire/peaktrack-services`.
- No new global-state library (Redux / Zustand). React Query + Context is sufficient.

**Shared workspace packages (direct consumption, zero changes required):**
- `@evil-empire/ui` — components (via RN-Web).
- `@evil-empire/parsers` — set/rep/weight input parser.
- `@evil-empire/types` — shared `Workout`, `Exercise`, parser types.
- `@evil-empire/peaktrack-services` — confirmed platform-agnostic (only `@supabase/supabase-js`, `date-fns`, parsers, types). Every Supabase call the mobile app makes funnels through this package; the web app calls the same functions.
- `@evil-empire/eslint-config`, `@evil-empire/typescript-config` — shared configs.

**Testing:** Vitest + React Testing Library (web-native). Parser tests and service tests already exist in their packages and don't need to be re-run from the web app. Component smoke tests live next to components in `__tests__/`.

---

## Infrastructure

### Web app hosting

Same pattern as `apps/serverless/getpeaktrack-site` and `apps/serverless/vaikia-dev-site`: AWS SAM template that provisions an S3 bucket + CloudFront distribution for a static Vite build. SPA fallback (`403 → index.html`) is already solved in those templates and gets reused.

**New package:** `apps/serverless/peaktrack-app-site` (static hosting wrapper for the web app).

- `template.yaml` — S3 + CloudFront, mirroring `getpeaktrack-site/template.yaml`.
- `vite.config.js` — points at `../../web/peaktrack-app` source (matches the sibling pattern `getpeaktrack-site/vite.config.js` uses to reference `../../web/getpeaktrack`).
- `deploy.sh`, `deploy-app.sh`, `samconfig.toml` — mirror existing conventions.
- Target domain: `app.getpeaktrack.com` (or similar subdomain — to confirm before first deploy).

### API layer (shared backend for AI coach + future server-side features)

**New package:** `apps/serverless/peaktrack-api` — introduces a runtime flavor to the serverless folder. The two existing siblings are static-site wrappers; this one provisions an `AWS::Serverless::Function` + API Gateway (or a Function URL for simplicity) via the same SAM tooling.

**This service is consumed by both web and mobile.** The coach is a single feature from one product; both clients carry the same Supabase JWT, so the auth model is identical for both. See the *Coach service architecture* section below for why it's one service and not two.

- **Runtime:** Node.js 22 on Lambda.
- **Framework inside the handler:** Hono. Small, fast, native Fetch API handler that adapts cleanly to API Gateway / Function URLs / local dev via `@hono/node-server`. Alternative Express if you have a preference.
- **Endpoints v1:**
  - `POST /api/coach/prompt` — placeholder endpoint that validates a Supabase JWT, forwards to the AI provider using a server-held secret (`ANTHROPIC_API_KEY` or similar in SAM parameters), and streams the response back. v1 ships the plumbing + a stub response so we can prove end-to-end secret handling works.
  - `GET /health` — liveness check.
- **Auth:** incoming requests carry the Supabase session JWT in the `Authorization` header; the Lambda verifies it with **HS256 against `SUPABASE_JWT_SECRET`** — Supabase's default, which signs tokens with a project-wide symmetric secret. Mobile and web use the same scheme. (Earlier draft said "JWKS or shared secret" as if interchangeable — they're not. If/when the project moves to Supabase's asymmetric-key flow, swap to JWKS verification: single-function change, no contract change.)
- **Secrets:** stored as SAM parameters / AWS SSM parameters, injected as Lambda env vars. Never committed, never shipped to either client.
- **Code reuse:** the Lambda imports `@evil-empire/peaktrack-services` and `@evil-empire/types` (which now includes a `coach.ts` module for the request/response/streaming types) directly from the monorepo (tsup-bundled).
- **CORS:** the production web app origin is a fixed entry; additional dev origins are read from a comma-separated `CORS_ALLOWED_ORIGINS` env var so a developer running Expo Go on a physical phone can add their machine's LAN IP (e.g., `http://192.168.1.42:8081`) without a code change. `localhost`, `null`, and `capacitor://localhost` are always allowed in dev. Mobile in production uses native fetch (no CORS check) so it doesn't need an origin entry. CORS is browser hygiene; the actual security boundary is JWT verification. (Earlier draft only listed `localhost`/`null`/`capacitor://localhost`, which silently breaks Expo Go on a real phone — the original IP-based dev origin would never match.)
- **Local dev:** `sam local start-api` or `hono dev` against `@hono/node-server`. Web's `VITE_API_BASE_URL` and mobile's `EXPO_PUBLIC_API_BASE_URL` both point at `http://localhost:3001` in dev, at the API Gateway domain in prod.

### Coach service architecture (shared, not split)

`peaktrack-api` is the single backend for the coach feature; both clients call the same endpoints. Reasons:

- **One credential, one verification path.** Mobile and web both authenticate via Supabase JWT; the Lambda doesn't care which client is calling.
- **One source of truth.** System prompts, model selection, rate-limit logic, prompt-injection defenses, observability — all live in one place. Change the prompt once, both clients pick it up.
- **No data-layer divergence.** Mobile keeps talking to Supabase directly via RLS for workouts/programs/exercises; coach is a *new* outbound call that mobile adds, not a refactor of mobile's existing flow.
- **Cheaper ops.** One SAM stack, one set of secrets to rotate, one pipeline.

**Module hygiene inside `peaktrack-api`** — the coach lives in its own self-contained folder (`src/coach/` with its own routes, services, providers, env vars) from day one. If we ever need to split it out (criteria below), it's a folder move, not an archaeology project.

**Decision criteria for splitting later** (none of these apply today; document them so we re-evaluate when they do):

- Coach needs long-lived streaming connections that don't fit Lambda well (e.g., WebSocket sessions) while the rest of the API is happy on Lambda.
- Coach grows a separate cost/scaling profile that warrants isolated budgets and dashboards.
- Coach pulls in heavyweight runtime deps (image / audio models) that we don't want loaded for `/health`.
- A different team takes ownership of coach.

**Shared contract:** the request/response/streaming-event shapes for `/api/coach/*` go into the existing `@evil-empire/types` package as `coach.ts`, **not** a new `peaktrack-coach-contract` package. Both clients and the Lambda already depend on `@evil-empire/types`, so adding a single file there gives the same "one source of truth" guarantee with no new build, no new tsup config, and no new entry in three `package.json`s. (Original draft listed the new package as the default with folding-in as an alternative; review found no benefit to the new package.)

**Mobile integration is additive, not a v1 web blocker.** Web v1 ships the plumbing and a hidden coach surface that exercises the endpoint. The mobile coach UX is a separate track that lands after v1 web; mobile picks up the new types module from `@evil-empire/types` and writes its own client. PR 7 ships the server endpoint and the types; mobile's adoption is a follow-up PR after this plan completes.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | web build | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | web build | Supabase anon key |
| `VITE_API_BASE_URL` | web build | Base URL for peaktrack-api |
| `EXPO_PUBLIC_API_BASE_URL` | mobile build | Base URL for peaktrack-api (added when mobile picks up the coach) |
| `SUPABASE_URL` | Lambda | Supabase project URL |
| `SUPABASE_JWT_SECRET` | Lambda | HS256 verification of incoming Supabase JWTs |
| `CORS_ALLOWED_ORIGINS` | Lambda | Comma-separated origins allowed by CORS (web app prod URL + dev/LAN origins) |
| `ANTHROPIC_API_KEY` | Lambda | AI provider secret (example) |

---

## Repository layout (new additions only)

```
evil_empire/
├── apps/
│   ├── mobile/PeakTrack/                    # unchanged
│   ├── web/
│   │   ├── getpeaktrack/                    # unchanged (static landing)
│   │   └── peaktrack-app/                   # NEW — TanStack Router + Vite SPA
│   │       ├── app/                         # route files (see Routing)
│   │       ├── contexts/                    # AuthContext, UserSettingsContext (ported)
│   │       ├── hooks/                       # use-workout-state, use-workout-timer, …
│   │       ├── lib/                         # supabase client, query client, formatters
│   │       ├── public/
│   │       ├── vite.config.ts               # Vite + @tanstack/router-plugin, RN-Web alias, .web.tsx resolution
│   │       ├── tailwind.config.js           # extends @evil-empire/ui preset
│   │       └── package.json                 # @evil-empire/web-app
│   └── serverless/
│       ├── getpeaktrack-site/               # unchanged
│       ├── vaikia-dev-site/                 # unchanged
│       ├── peaktrack-app-site/              # NEW — SAM wrapper for web app
│       └── peaktrack-api/                   # NEW — SAM + Lambda (Hono)
│           ├── src/
│           │   ├── index.ts                 # Hono app + Lambda adapter
│           │   └── routes/
│           │       ├── coach.ts
│           │       └── health.ts
│           ├── template.yaml                # Lambda + API Gateway
│           ├── samconfig.toml
│           └── package.json                 # @evil-empire/peaktrack-api
└── packages/
    ├── parsers/                             # unchanged
    ├── peaktrack-services/                  # gains lifted program logic in PR 3 (was PR 4 before reorder)
    ├── types/                               # gains coach.ts (request/response/event types for /api/coach/*)
    ├── eslint-config/                       # unchanged
    └── typescript-config/                   # unchanged
```

Coach types live in `@evil-empire/types/coach`, consumed by the web app, the mobile app (when it adopts the coach), and the Lambda — all three speak the same TypeScript types for coach traffic with no new package overhead. (Earlier draft introduced a dedicated `peaktrack-coach-contract` package; review found that folding into the existing types package gets the same alignment guarantee for less infrastructure.)

Package names follow the existing convention: `@evil-empire/web-app`, `@evil-empire/peaktrack-api`.

---

## Routing (TanStack Router file-based)

One-to-one mapping with the mobile app's `app/` routes:

| Mobile route | Web route | Notes |
|---|---|---|
| `app/(auth)/sign-in.tsx` | `app/routes/sign-in.tsx` | Public |
| `app/(auth)/sign-up.tsx` | `app/routes/sign-up.tsx` | Public |
| `app/index.tsx` | `app/routes/index.tsx` and `app/routes/workouts/$date.tsx` | Mobile's `index.tsx` is both the home and the date-scoped workout view (there is no separate `create-workout.tsx` on mobile — earlier draft of this table listed one). On web, split into two routes: home at `/` redirects to today's date; the date-parameterised route handles any other day. |
| `app/add-exercises.tsx` | `app/routes/workouts/$date/add.tsx` | |
| `app/edit-exercise.tsx` | `app/routes/exercises/$id/edit.tsx` | |
| `app/start-workout.tsx` | — | **Out of scope.** Execution stays mobile-only. |
| `app/repetition-maximums.tsx` | `app/routes/rms.tsx` | |
| `app/programs.tsx` | `app/routes/programs/index.tsx` | |
| `app/program-detail.tsx` | `app/routes/programs/$id.tsx` | |
| `app/program-edit.tsx` | `app/routes/programs/$id/edit.tsx` | |
| `app/program-assign.tsx` | `app/routes/programs/$id/assign.tsx` | |
| `app/program-progression.tsx` | `app/routes/programs/$id/progression.tsx` | |
| `app/create-program.tsx` | `app/routes/programs/new.tsx` | Text parser entry |
| `app/import-workout.tsx` | `app/routes/workouts/import.tsx` | |
| `app/history.tsx` | `app/routes/history.tsx` | 90-day scrollback |
| `app/exercise-progression.tsx` | `app/routes/exercises/$id/progression.tsx` | |
| `app/settings.tsx` | `app/routes/settings.tsx` | |
| `app/exercise-input-help.tsx` | `app/routes/help/input-format.tsx` | |
| `app/+not-found.tsx` | `app/routes/__root.tsx` NotFound | |

Authenticated routes sit under a protected layout route (`app/routes/_app.tsx`) whose `beforeLoad` checks the Supabase session and redirects to `/sign-in` if absent.

---

## Feature parity inventory

Web v1 is a **management and analytics surface**. The following must all work:

**Auth:** email/password sign-up, sign-in, sign-out, session persistence.

**Workout management (planning, not execution):**
- Create/view a workout for a given date.
- Add exercises to a workout from the catalog or free text.
- Parse exercise input strings (`4 x 3 @50kg`, `4 x 6 @80%`, `3-2-1-1-1 65kg`, `Build to 8RM`, `2x 10, 2-3RIR`, rest times `120s`/`2m`, compound sets, circuits) — reuse `@evil-empire/parsers` as-is.
- Edit exercise details (sets, reps, weight, phases, rest).
- Import a workout from pasted text.
- Copy a past workout forward from history.

**History:** last 90 days of workouts, read-only, with copy-workout action.

**Repetition maximums:** view, add, and edit 1RMs; they drive percentage-based weights in parsed input.

**Programs:** list (draft/active/archived), detail, edit, assign, create from pasted program text (existing `parseProgramText` lib — ported).

**Progression views:**
- Exercise progression (per-exercise chart/table of load over time).
- Program progression (weekly loads, volume trends across a program).

**Settings:** weight unit (kg/lbs), user weight.

**Explicitly out of scope for v1 (may or may not ever come to web):**
- Live workout execution — the start-workout flow, interval timer, set-by-set stepper, haptics, audio, post-workout rating. Mobile remains the sole execution surface.
- AI coach UX (the API endpoint exists in v1 as a stub so the secret-token path is proven end-to-end).
- Onboarding coach marks.
- Offline workout capture / push notifications.

---

## Milestones

**M1 — Scaffold & shared infra (≈ 3–5 days)**
- Create `apps/web/peaktrack-app` with React 19 + Vite + `@tanstack/react-router` + `@tanstack/router-plugin/vite`, RN-Web alias copied verbatim from `apps/evil_ui/vite.config.ts`, Tailwind with the UI preset, a root route that renders one `@evil-empire/ui` component successfully.
- Create `apps/serverless/peaktrack-api` with a Hono `GET /health` endpoint, a `POST /api/coach/prompt` skeleton that returns 401 without a valid JWT, deployable via SAM, verified against local `sam local start-api`.
- Turbo pipeline updated so `pnpm dev:web`, `pnpm dev:api`, `pnpm build` all work.
- Exit criteria: deployed staging URL renders the UI library; `/health` returns 200; `/api/coach/prompt` returns 401 with no JWT and correct CORS headers from an allowed origin; first-build bundle baseline recorded.

**M2 — Auth + layout shell (≈ 3 days)**
- Port `AuthContext` and `UserSettingsContext` from mobile (platform-agnostic logic, only `AsyncStorage` → `localStorage` swap needed for persistence).
- Sign-up / sign-in / sign-out flows.
- Protected `_app` layout with sidebar nav using `SidebarNav` from evil_ui.
- Exit criteria: authenticated user lands on home, sees their Supabase identity, can sign out.

**M3 — Workout management + history (≈ 5 days)**
- Home (today's workout), create/view workout by date, add exercises, edit exercise, import-workout, copy-from-history.
- Repetition maximums CRUD.
- History view (90-day scrollback, read-only, copy-workout action).
- React Query hooks around `@evil-empire/peaktrack-services`.
- Exit criteria: a user can plan, edit, and review workouts end-to-end on web; 1RMs flow through parser correctly.

**M4 — Programs (≈ 5 days)**
- Programs list/detail/edit, assignment, create-from-text.
- Reuse `parseProgramText`, `programScheduling`, `resolveProgramWeights`, `prepareMaterializeInputs` — these still live in `apps/mobile/PeakTrack/lib/` today. Lift them into `packages/peaktrack-services` (or a new `packages/peaktrack-program-logic`) during this milestone so mobile and web share one implementation. (**Flagged in Risks.**)
- Exit criteria: program lifecycle works end-to-end on web.

**M5 — Progression views (≈ 3 days)**
- Exercise progression (per-exercise load-over-time chart/table, port `exerciseProgressionLayout`).
- Program progression (weekly volume / load trends across a program, port `progressionLayout`).
- Charting: start with `recharts` or `victory-native-xl`'s web build; evaluate at implementation time.
- Exit criteria: a user can open any exercise or program and see progression over their history.

**M6 — Coach API plumbing + polish (≈ 3 days)**
- `POST /api/coach/prompt` on Lambda: JWT verification, secret-backed call to AI provider with a stub response, streaming back to client.
- Web app has a wired-up (hidden / feature-flagged) coach surface that proves the round-trip works with the secret held server-side only.
- Lighthouse pass, accessibility audit, bundle-size check on RN-Web output.
- Exit criteria: team internal review, feature flag flipped for internal users, ready to announce.

**Total rough estimate: ~4–5 weeks of focused work for one engineer.** The earlier "2.5–3 weeks" figure was optimistic for a greenfield RN-Web bringup that also includes a Lambda + Hono + JWT + secret-plumbing service, a cross-platform shared-package refactor (PR 3), progression chart work, and a launch-polish pass. Use 4–5 weeks when committing to a date; treat 2.5–3 as the floor only if everything goes right.

---

## Task list — one PR per milestone

Each milestone below corresponds to **one pull request**, sized so it can be reviewed and merged independently. Later PRs assume earlier PRs have merged to `main`. Every PR ends with a merge checklist; don't merge until everything in it is green.

### PR 1 — `feat(web): scaffold peaktrack-app + peaktrack-api`

Wires up the two new packages and the deploy wrappers. No product features.

- [ ] Create `apps/web/peaktrack-app/` with React 19, Vite, `@tanstack/react-router` + `@tanstack/router-plugin/vite` for file-based routing. Vite config aliases `react-native → react-native-web` and resolves `.web.tsx` first (copy verbatim from `apps/evil_ui/vite.config.ts`).
- [ ] `tailwind.config.js` extends `@evil-empire/ui/tailwind-preset`; PostCSS wired.
- [ ] Root route renders a single `@evil-empire/ui` component (e.g. `Button`, `Card`) to prove RN-Web consumption works.
- [ ] `package.json` declares deps on `@evil-empire/ui`, `@evil-empire/parsers`, `@evil-empire/types`, `@evil-empire/peaktrack-services`; workspace protocol `workspace:*` used throughout.
- [ ] Create `apps/serverless/peaktrack-api/` with Hono app, Lambda adapter, `GET /health`, **`POST /api/coach/prompt` skeleton that returns `401` without a valid JWT** (full coach logic comes in PR 7), local dev via `@hono/node-server`.
- [ ] **JWT verification middleware** in place — HS256 against `SUPABASE_JWT_SECRET`, wired to the coach route so the 401 path is real, not aspirational.
- [ ] **CORS middleware** reading `CORS_ALLOWED_ORIGINS` env var, with `localhost`/`null`/`capacitor://localhost` defaults in dev.
- [ ] `template.yaml` provisions `AWS::Serverless::Function` + API Gateway (or Function URL); `samconfig.toml` with `dev` env. `SUPABASE_JWT_SECRET` and `CORS_ALLOWED_ORIGINS` as `NoEcho` SAM parameters.
- [ ] Create `apps/serverless/peaktrack-app-site/` as a near-verbatim clone of `getpeaktrack-site` (SAM template for S3 + CloudFront, `vite.config.js` points at `../../web/peaktrack-app`, `deploy.sh`, `deploy-app.sh`). With TanStack Router instead of TanStack Start, this is genuinely a copy.
- [ ] `turbo.json` updated so `build`, `dev`, `lint`, `typecheck`, `test` all fan out to the new packages.
- [ ] Root `package.json` scripts: `dev:web`, `dev:api`, `deploy:web`, `deploy:api`.
- [ ] `.env.example` files added to `peaktrack-app` and `peaktrack-api` listing every var from the Environment variables table.
- [ ] README.md in each new package with dev/deploy commands.
- [ ] **First-build bundle baseline captured** in the PR description (initial JS gzipped, RN-Web overhead). This is the number the bundle budget in PR 8 gets set against — picking a number up front (the earlier "300 KB gzipped" target) before knowing the baseline was guessing.
- [ ] **Merge checklist:** `pnpm build` clean · `pnpm typecheck` clean · `pnpm lint` clean · staging deploy of `peaktrack-app-site` renders the placeholder UI · staging deploy of `peaktrack-api` returns `200` on `/health`, `401` on `POST /api/coach/prompt` with no `Authorization` header, correct `Access-Control-Allow-Origin` from an allowed origin and rejection from a disallowed origin · bundle baseline recorded in the PR description.

### PR 2 — `feat(web): auth + protected layout shell`

Ships sign-in / sign-up / sign-out and the authenticated app shell. No workout features yet.

- [ ] Port `contexts/AuthContext.tsx` from mobile. Swap `AsyncStorage` → `localStorage` in the storage adapter only; keep signatures identical so mobile isn't affected.
- [ ] Port `contexts/UserSettingsContext.tsx` the same way.
- [ ] `lib/supabase.ts` — web Supabase client, reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- [ ] `lib/query-client.ts` — shared React Query client instance.
- [ ] `app/routes/__root.tsx` — provider stack (QueryClientProvider, AuthProvider, UserSettingsProvider) + NotFound.
- [ ] `app/routes/sign-in.tsx`, `app/routes/sign-up.tsx` — public routes using evil_ui `Input` / `Button`.
- [ ] `app/routes/_app.tsx` — protected layout route with `beforeLoad` that redirects to `/sign-in` when no session. Renders `SidebarNav` + outlet.
- [ ] `app/routes/_app/index.tsx` — placeholder home showing signed-in email and a sign-out button.
- [ ] Unit tests for the storage adapter swap and for the `beforeLoad` redirect.
- [ ] **Merge checklist:** sign-up → email verified (or stubbed) → sign-in → lands on home · sign-out clears session and redirects · unauthenticated access to any `_app` route redirects · tests pass.

### PR 3 — `refactor(services): lift program & exercise logic from mobile into shared package`

Pre-req for PR 4 (workout management) and PR 5 (programs). Originally specced as PR 4, after the workout-management PR; review found that the workout-management routes also reach for helpers (`parseSetInput`, `formatExercisePhase`, `interpolateWeight`, `buildPhaseData`) that this PR moves, which would force a temporary copy in the web app. Doing the lift first means the web app only ever imports from `@evil-empire/peaktrack-services`, never from `apps/mobile/PeakTrack/lib/`.

This PR is mobile-only at the file level — no web product code lands here.

- [ ] Move `parseProgramText`, `programScheduling`, `resolveProgramWeights`, `prepareMaterializeInputs`, `exerciseProgressionLayout`, `progressionLayout`, `progressionLayoutCore`, `buildPhaseData`, `interpolateWeight`, `formatExercisePhase` out of `apps/mobile/PeakTrack/lib/` into `packages/peaktrack-services/`. (Earlier draft missed `progressionLayoutCore.ts`, which underpins `progressionLayout` / `exerciseProgressionLayout` and lives in the same folder.) If during the PR the services package starts to feel overloaded, split into a sibling `packages/peaktrack-program-logic` — decide in-PR, but default to keeping things in `peaktrack-services`.
- [ ] Update `apps/mobile/PeakTrack/` imports to the new location; retire the local `lib/parseSetInput.ts` wrapper.
- [ ] Move or create tests for the lifted modules in the destination package.
- [ ] `pnpm test --filter=@evil-empire/peaktrack-services` (or the new package) passes with the new tests.
- [ ] Mobile app starts and runs unchanged from a user's perspective — visual smoke test on iOS sim.
- [ ] **Merge checklist:** no behavior change on mobile · 296 parser tests still pass · new tests cover the lifted modules · typecheck clean across monorepo · web app (which imports from `peaktrack-services` since PR 1) still builds clean.

### PR 4 — `feat(web): workout management + history + RMs`

First real product PR. Gives the user a usable planning surface. Depends on PR 3 (the lift) — every helper this PR touches now lives in `@evil-empire/peaktrack-services`.

- [ ] `app/routes/_app/index.tsx` — today's workout view.
- [ ] `app/routes/_app/workouts/$date.tsx` — create/view workout by date.
- [ ] `app/routes/_app/workouts/$date/add.tsx` — add exercises (catalog + free-text parser).
- [ ] `app/routes/_app/exercises/$id/edit.tsx` — edit exercise details (sets, reps, weight, phases, rest).
- [ ] `app/routes/_app/workouts/import.tsx` — import from pasted text (reuses parser logic).
- [ ] `app/routes/_app/history.tsx` — 90-day scrollback, read-only, with copy-workout action.
- [ ] `app/routes/_app/rms.tsx` — repetition maximums CRUD; 1RMs drive percentage-based weights in the parser.
- [ ] React Query hooks (`hooks/use-workouts.ts`, `hooks/use-exercises.ts`, `hooks/use-rms.ts`) wrapping `@evil-empire/peaktrack-services`.
- [ ] Copy-workout action: creates a new workout on a target date using the same exercises/phases as the source.
- [ ] No new logic in the web app that isn't in `peaktrack-services` — anything that would need porting from mobile's `lib/` should already be in the shared package thanks to PR 3.
- [ ] Smoke tests for each route's loader.
- [ ] **Merge checklist:** plan → edit → review end-to-end on staging · a workout created on web is visible on mobile (same Supabase row) · 1RM changes flip percentage weights in parsed input · tests pass.

### PR 5 — `feat(web): programs`

Depends on PR 3 (the lift, which moved `parseProgramText` and friends into `peaktrack-services`). Ships the full program lifecycle on web.

- [ ] `app/routes/_app/programs/index.tsx` — list (draft / active / archived).
- [ ] `app/routes/_app/programs/$id.tsx` — detail (sessions, exercises, assigned state).
- [ ] `app/routes/_app/programs/$id/edit.tsx` — edit metadata.
- [ ] `app/routes/_app/programs/$id/assign.tsx` — assign / activate for the user.
- [ ] `app/routes/_app/programs/new.tsx` — create from pasted program text (uses `parseProgramText` from `@evil-empire/peaktrack-services`).
- [ ] `app/routes/_app/help/input-format.tsx` — static page mirroring mobile's `exercise-input-help.tsx`.
- [ ] React Query hooks for the program read/write surface.
- [ ] Import UI uses evil_ui `TerminalBlock` to preview parsed output before commit (reuse of existing component).
- [ ] **Merge checklist:** a program pasted into web materializes on mobile · parser errors surface clearly in the UI · typecheck / lint / test clean.

### PR 6 — `feat(web): progression views`

- [ ] `app/routes/_app/exercises/$id/progression.tsx` — per-exercise load-over-time (uses `exerciseProgressionLayout`).
- [ ] `app/routes/_app/programs/$id/progression.tsx` — program-level weekly volume / load (uses `progressionLayout`).
- [ ] Pick a charting library in the PR description (`recharts` is the default recommendation — plain DOM, React-native, small); document the decision.
- [ ] Empty states for users with no history yet.
- [ ] Route-level code splitting for the charting lib so it doesn't bloat the initial bundle.
- [ ] **Merge checklist:** executing a workout on mobile → reload the web progression view → new data visible · bundle report generated and included in the PR description · tests pass.

### PR 7 — `feat(api): coach endpoint + secret plumbing`

Proves the server can hold secrets end-to-end and finalises the types that mobile will pick up later. Coach UX itself is stubbed.

- [ ] Add `coach.ts` to `@evil-empire/types` exporting the request, response, and streaming-event types for `/api/coach/*`. (Originally specced as a separate `peaktrack-coach-contract` package; review found no benefit over folding into the existing types package that everything already depends on — same alignment guarantee, less infrastructure.)
- [ ] Fill in `POST /api/coach/prompt` in `peaktrack-api` (the route shell + 401 path landed in PR 1; PR 7 fills in the body), isolated under `src/coach/` (own routes, services, provider adapter, env vars) so a future split is a folder move.
- [ ] Confirm JWT verification middleware (already in place from PR 1) accepts valid Supabase HS256 tokens; same code path serves mobile and web.
- [ ] Forward to AI provider using a server-side secret (e.g. `ANTHROPIC_API_KEY`). v1 can ship a stub response if the provider isn't chosen yet; the important thing is the secret never leaves Lambda.
- [ ] Streaming response supported end-to-end (SSE or chunked fetch); the streaming event shape lives in `@evil-empire/types/coach`.
- [ ] CORS verified to allow the web app origin and Expo dev origins via `CORS_ALLOWED_ORIGINS` (configured in PR 1); mobile production calls are native fetch (no CORS check).
- [ ] SAM template updates: `ANTHROPIC_API_KEY` (or equivalent) as a `NoEcho` parameter, wired to the Lambda env.
- [ ] Hidden / feature-flagged coach surface in the web app that exercises the endpoint, importing types from `@evil-empire/types`.
- [ ] **Schema:** v1 ships no schema changes (coach is stub-only, no conversation persistence). Document this in the PR description so it's a recorded decision rather than an oversight; the first PR after v1 that adds conversation history will own its own migration.
- [ ] Integration test: web app hits deployed API with a valid JWT, gets a streamed response, secret is never present in any client-side bundle (verify by grepping the built assets).
- [ ] **Merge checklist:** deployed staging round-trip works from web · secret absent from client bundle · CORS passes from allowed origins, fails from others · `@evil-empire/types/coach` importable from both clients and the Lambda · tests pass.

> **Follow-up after v1 web ships (out of this plan's scope):** mobile adoption of the coach. A separate PR imports the coach types from `@evil-empire/types` (already a mobile dep), wires `EXPO_PUBLIC_API_BASE_URL`, and ships the mobile coach UI against the same endpoint. No new shared package needed, no server changes.

### PR 8 — `chore(web): v1 polish + launch prep`

Final PR before flipping the switch.

- [ ] Lighthouse pass on the staging URL (target ≥ 90 on Performance / Accessibility / Best Practices for the authenticated home).
- [ ] Bundle-size audit against the budget set after PR 1's first-build baseline. (Earlier draft hard-coded "initial JS < 300 KB gzipped" up front; review pushed back because RN-Web + Supabase + React Query + TanStack Router add up to a number we don't actually know yet. Real budget is "PR 1 baseline + agreed headroom" — pick the headroom in this PR using PR 1's recorded number.) Route-split anything that pushes initial JS over.
- [ ] Accessibility audit (keyboard nav, focus traps in modals, ARIA on custom RN-Web components).
- [ ] Error boundary at the `__root` level with a friendly fallback.
- [ ] Analytics event instrumentation (if applicable — decide in the PR).
- [ ] Add a link from `getpeaktrack.com` landing page (`apps/web/getpeaktrack/index.html`) pointing to the new app subdomain.
- [ ] Production subdomain + ACM cert + Route 53 wired in the SAM template.
- [ ] **Merge checklist:** production deploy succeeds · real user (internal) test pass · post-launch monitoring dashboard exists.

---

## Risks & open questions

**RN-Web bundle size.** Baseline RN-Web adds ~60–80 KB gzipped over plain React DOM. Acceptable for an authenticated app but should be measured at M1 and M6. Mitigation: code-split per route (TanStack Router supports this natively), lazy-load heavy surfaces (programs, progression charts).

**RN-Web SSR.** No longer applies — v1 is plain TanStack Router on Vite, fully client-rendered, deployed as a static SPA to S3 + CloudFront. If a future feature genuinely needs SSR (e.g., shareable coach-summary URLs that need link previews / SEO), the migration to TanStack Start will need to solve RN-Web's `AppRegistry.getApplication()` style-extraction dance at that point. Flagged here so it's not a surprise then. (Earlier draft chose TanStack Start in SPA/prerender mode specifically to keep this door open; the door is still open via TanStack Router → TanStack Start migration when the need actually arises.)

**Program logic location.** Inventory shows several helpers (`parseProgramText`, `programScheduling`, `resolveProgramWeights`, `prepareMaterializeInputs`, `progressionLayout`, `progressionLayoutCore`, `exerciseProgressionLayout`, `buildPhaseData`, `interpolateWeight`, `formatExercisePhase`) currently live in `apps/mobile/PeakTrack/lib/`. PR 3 lifts them into `packages/peaktrack-services` and retires the local `lib/parseSetInput.ts` wrapper. Done **before** any web product code lands so the web app only ever imports from the shared package, never from `apps/mobile/PeakTrack/lib/`. (Earlier draft scheduled this as PR 4, between workout-management and programs; review pushed it earlier because workout-management itself reaches for `parseSetInput`, `formatExercisePhase`, `interpolateWeight`, and `buildPhaseData`, which would force a temporary copy.)

**Expo-only APIs.** Mostly non-issue now that execution is out of scope. `expo-haptics`, `expo-audio`, `expo-notifications` — all associated with the execution/timer flow and no longer need a web equivalent. `expo-web-browser` (used for OAuth / external links) replaces trivially with `window.open`.

**Mobile and web drift.** Execution stays mobile-only, so there's now a first-class reason for two clients to behave differently. Keep the shared contract (data model, services, parsers, types) strictly in shared packages, and push any "which platform does X" decisions out to the route/screen layer. The progression views on web should read the same execution log data that mobile writes.

**Deploy domain & CloudFront config.** Subdomain (`app.getpeaktrack.com`?) and the existing Route 53 / ACM setup need confirmation before M1's deploy step.

**AI provider choice.** The secret-token plumbing is provider-agnostic, but the Lambda needs *some* target to call for v1's smoke test. Claude via the Anthropic API is the assumed default; revisit at M6.

---

## Verification checklist (before declaring v1 done)

- [ ] All routes in the Feature parity inventory render and function.
- [ ] `pnpm test` passes across monorepo (no regressions in parsers, services).
- [ ] `pnpm typecheck` clean across all new packages.
- [ ] `pnpm lint` clean.
- [ ] Staging deploy of `peaktrack-app-site` serves the web app.
- [ ] Staging deploy of `peaktrack-api` responds on `/health` and `/api/coach/prompt`.
- [ ] End-to-end (web flow): sign up → create workout → add exercises → edit → see in history → open exercise progression view, on a deployed staging URL.
- [ ] Cross-device smoke: a workout created on web shows up on mobile, gets executed on mobile, and the resulting execution data appears in the web progression view.
- [ ] `POST /api/coach/prompt` works from the deployed web app with the AI provider key stored only in Lambda env, never shipped to the browser.
- [ ] Bundle size report generated and under the budget set against PR 1's first-build baseline (the "300 KB gzipped" figure from the original draft was a guess; the real budget gets agreed in PR 8 against a real baseline).
- [ ] Link from getpeaktrack.com landing page to `app.getpeaktrack.com` added.
