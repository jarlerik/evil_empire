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
Draft — 2026-04-23. Revised 2026-04-25. **PR 1 shipped 2026-04-25 on `feat/web-pr1-scaffold`** (commit + PR open pending; staging URLs and full delta list live under PR 1 below). **PR 2 shipped 2026-04-25 directly on `develop` (commit `0fae577`)** — full delta list under PR 2 below. **PR 3 shipped 2026-04-25 on `develop` (commit `2e93be1`)**. **PR 4 shipped 2026-04-25 on `develop` (commit `e7baeb1`)** — full delta list under PR 4 below. **PR 6 implemented 2026-04-26 on `develop`** (commit pending) — full delta list under PR 6 below.

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

**New package:** `apps/serverless/peaktrack-api` — introduces a runtime flavor to the serverless folder. The two existing siblings are static-site wrappers; this one provisions an `AWS::Serverless::Function` + **Lambda Function URL with `RESPONSE_STREAM` invoke mode** via the same SAM tooling. (Earlier draft said "API Gateway or Function URL"; review committed to Function URL because API Gateway can't stream Lambda responses, and PR 7's coach endpoint needs SSE streaming. Function URL with `RESPONSE_STREAM` is the only clean Lambda streaming path on AWS today. Custom domain comes via CloudFront in front of the Function URL when we wire production DNS in PR 8.)

**This service is consumed by both web and mobile.** The coach is a single feature from one product; both clients carry the same Supabase JWT, so the auth model is identical for both. See the *Coach service architecture* section below for why it's one service and not two.

- **Runtime:** Node.js 22 on Lambda.
- **Framework inside the handler:** Hono. Small, fast, native Fetch API handler that adapts cleanly to Function URLs and local dev via `@hono/node-server`. Alternative Express if you have a preference.
- **Bundling:** SAM `BuildMethod: esbuild` so the Lambda artifact is a single bundled file. The default "copy `node_modules`" SAM behaviour breaks workspace symlinks for `@evil-empire/peaktrack-services` and `@evil-empire/types`; esbuild bundles them inline. Specified explicitly because picking this up only after the first deploy fails wastes time.
- **Endpoints v1:**
  - `POST /api/coach/prompt` — placeholder endpoint that validates a Supabase JWT, forwards to the AI provider using a server-held secret (`ANTHROPIC_API_KEY` or similar in SAM parameters), and streams the response back. v1 ships the plumbing + a stub response so we can prove end-to-end secret handling works.
  - `GET /health` — liveness check.
- **Auth:** incoming requests carry the Supabase session JWT in the `Authorization` header; the Lambda verifies it with **HS256 against `SUPABASE_JWT_SECRET`** — Supabase's default, which signs tokens with a project-wide symmetric secret. Mobile and web use the same scheme. (Earlier draft said "JWKS or shared secret" as if interchangeable — they're not. If/when the project moves to Supabase's asymmetric-key flow, swap to JWKS verification: single-function change, no contract change.)
- **Secrets:** stored as SAM parameters / AWS SSM parameters, injected as Lambda env vars. Never committed, never shipped to either client.
- **Code reuse:** the Lambda imports `@evil-empire/peaktrack-services` and `@evil-empire/types` (which now includes a `coach.ts` module for the request/response/streaming types) directly from the monorepo (tsup-bundled).
- **CORS:** the production web app origin is a fixed entry; additional dev origins are read from a comma-separated `CORS_ALLOWED_ORIGINS` env var so a developer running Expo Go on a physical phone can add their machine's LAN IP (e.g., `http://192.168.1.42:8081`) without a code change. `localhost`, `null`, and `capacitor://localhost` are always allowed in dev. Mobile in production uses native fetch (no CORS check) so it doesn't need an origin entry. CORS is browser hygiene; the actual security boundary is JWT verification. (Earlier draft only listed `localhost`/`null`/`capacitor://localhost`, which silently breaks Expo Go on a real phone — the original IP-based dev origin would never match.)
- **Local dev:** **`@hono/node-server` is the inner-loop tool** (fast reload, real Node, accurate Hono behaviour); `pnpm dev:api` runs it. `sam local start-invoke` is reserved for pre-deploy smoke testing of the actual Lambda packaging — too slow for the inner loop. Web's `VITE_API_BASE_URL` and mobile's `EXPO_PUBLIC_API_BASE_URL` both point at `http://localhost:3001` in dev, at the Function URL (or its CloudFront alias) in prod.

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

### Environments

Two environments: `staging` and `prod`. Both use the **same Supabase project** in v1 — there's only one Supabase project today and standing up a separate staging project (with its own RLS, its own seed data, its own auth users) is out of scope for v1. Implication: internal testers on the staging web URL are operating on real production data. This is an explicit, documented trade-off, not an oversight; the alternative (separate Supabase staging project) lands in a follow-up PR if internal testing turns out to corrupt real data often enough to matter. Each Lambda env (`peaktrack-api-staging`, `peaktrack-api-prod`) has its own SAM stack with its own secrets and CORS allowlist.

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
│           ├── template.yaml                # Lambda Function URL (RESPONSE_STREAM), esbuild bundling
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

### PR 1 — `feat(web): scaffold peaktrack-app + peaktrack-api` ✅

**Status:** Shipped 2026-04-25 on branch `feat/web-pr1-scaffold` (commit + PR open pending). Staging URLs: web → `https://d7kj6czc8q4sw.cloudfront.net`, API → `https://vai36aiymvj3t67l2vtsmbwprq0iebnc.lambda-url.eu-north-1.on.aws`.

Wires up the two new packages and the deploy wrappers. No product features.

**Deltas from plan worth knowing for PR 2+:**
- **JWT verification migrated mid-PR from HS256 (legacy `SUPABASE_JWT_SECRET`) to asymmetric JWKS** against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Supabase had already moved this project's signing model to JWT signing keys with the symmetric secret marked legacy, and greenfield (no traffic, no cached tokens) was the cheapest moment to flip. Lambda holds only public verification material now; the private key never leaves Supabase. `SUPABASE_JWT_SECRET` is gone everywhere; `SUPABASE_URL` became `required()`. Single-function code change in `src/middleware/jwt.ts`.
- **SAM `BuildMethod: esbuild` swapped for an in-repo `scripts/bundle.mjs`.** SAM's `NodejsNpmEsbuildBuilder` runs `npm install` against `package.json`, and npm doesn't speak pnpm's `workspace:*` protocol — `@evil-empire/peaktrack-services` and `@evil-empire/types` couldn't resolve. Own-the-bundling pattern: esbuild inlines workspace deps into `dist/index.js` + writes a minimal `dist/package.json` (`name`/`version`/`type:module`/`main`); SAM uses `CodeUri: dist/` with no BuildMethod and just packages the prebuilt output. API bundle: 121 KB raw, single ESM file.
- **Function URL `AllowMethods` excludes `OPTIONS`.** Function URL CORS handles preflight automatically; the schema rejects `OPTIONS` as a value. Caught by `sam validate --lint` after a series of opaque `AWS::EarlyValidation::PropertyValidation` failures during the first deploys. → Add `sam validate --lint` to the pre-deploy reflex; the deploy-time error doesn't surface the property name.
- **Web app uses `flex: 1` instead of `100vh`** for full-height layout. RN's `ViewStyle` types come from `react-native` proper and reject CSS-only values like `100vh` even when `react-native-web` would render them. Rule of thumb for PR 2+: any CSS-only style value (`vh`/`vw`/`em`/named CSS colors not in RN's set) needs either a flex/percentage equivalent or a plain `<div className=...>` wrapper.
- **Bundle baseline (first-build):** **117.79 KB gzipped initial JS**, 1.36 KB gzipped CSS. RN-Web + React 19 + TanStack Router + the evil_ui surface used by the placeholder. Plenty of headroom for PR 8's budget conversation.
- **CI** still doesn't exist; v1 ships without one as the plan allowed.
- **Lint warnings** in pre-existing packages (`peaktrack-services`, `parsers`, `mobile`) are not regressions from PR 1 — explicitly carved out for a separate `chore: clear lint warning backlog` PR rather than conflated with this scaffold.

**Before starting** (cheap checks that prevent mid-PR surprises):

- [x] **Supabase RLS audit.** Confirm the policies on `workouts`, `exercises`, `programs`, `repetition_maximums`, `user_settings`, and `exercise_phases` only check `auth.uid() = …user_id` (or equivalent) and don't carry any client-platform conditions. A web client uses the same anon key + JWT as mobile; if a policy ever assumed mobile, web is silently blocked. 5-minute check, almost certainly fine.  → Audit clean: every policy uses `auth.uid()` directly or via parent-table join; no platform/client conditions.
- [x] **evil_ui RN-Web smoke.** Throwaway 30-minute exercise: spin up a tiny Vite app with the same alias config and try to mount each evil_ui component the auth shell will need (`Button`, `Input`, `Card`, `SidebarNav`, `TerminalBlock`, plus form layouts). The showcase only exercises a curated set; if any of these uses `Animated.Value`, `onLayout` measurement, or hover-state quirks that misbehave under RN-Web, you want to know now, not in PR 2. Components that fail get a `Component.web.tsx` sibling — note in the PR description which (if any) need it before PR 2 starts.  → All five mount + bundle clean (showcase build: 112 KB gzipped). Static hazard scan zero hits across the components, primitives, hooks, theme. No `Component.web.tsx` siblings needed.
- [x] **Mobile auth surface confirmed.** (Added pre-flight, not in original plan.) `apps/mobile/PeakTrack/contexts/AuthContext.tsx` and the sign-in/sign-up screens use email/password only — no `signInWithOAuth`, no `expo-web-browser`. PR 2 takes the straight email/password port path; no `/auth/callback` route needed.

**Web app:**

- [x] Create `apps/web/peaktrack-app/` with React 19, Vite, `@tanstack/react-router` + `@tanstack/router-plugin/vite` for file-based routing. Vite config aliases `react-native → react-native-web` and resolves `.web.tsx` first (copy verbatim from `apps/evil_ui/vite.config.ts`).
- [x] `tailwind.config.js` extends `@evil-empire/ui/tailwind-preset`; PostCSS wired.
- [x] Root route renders a single `@evil-empire/ui` component (e.g. `Button`, `Card`) to prove RN-Web consumption works.  → Renders `Card` + `Text` + `Button` with the form-layout shape PR 2 will reuse.
- [x] `package.json` declares deps on `@evil-empire/ui`, `@evil-empire/parsers`, `@evil-empire/types`, `@evil-empire/peaktrack-services`; workspace protocol `workspace:*` used throughout.
- [x] **Vitest + React Testing Library** wired with a passing placeholder test, so PR 2's storage-adapter tests have a home.

**API:**

- [x] Create `apps/serverless/peaktrack-api/` with Hono app, **Lambda Function URL** adapter (`hono/aws-lambda` `streamHandle` for streaming-aware invoke), `GET /health`, **`POST /api/coach/prompt` skeleton that returns `401` without a valid JWT** (full coach logic comes in PR 7), local dev via `@hono/node-server`.
- [x] **JWT verification middleware** in place — ~~HS256 against `SUPABASE_JWT_SECRET`~~ **JWKS asymmetric verification against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`** (see deltas above), wired to the coach route so the 401 path is real, not aspirational.
- [x] **CORS middleware** reading `CORS_ALLOWED_ORIGINS` env var, with `localhost`/`null`/`capacitor://localhost` defaults in dev.
- [x] `template.yaml` provisions `AWS::Serverless::Function` with **`FunctionUrlConfig` (`AuthType: NONE`, `InvokeMode: RESPONSE_STREAM`)** and ~~`BuildMethod: esbuild`~~ **own `scripts/bundle.mjs`** (see deltas — workspace:* incompat with npm) that bundles workspace deps inline and writes `dist/`. `samconfig.toml` with `staging` and `prod` envs. `SUPABASE_URL` (with `AllowedPattern`) and `AnthropicApiKey` (`NoEcho`, optional in PR 1) as SAM parameters.
- [x] `pnpm dev:api` runs `@hono/node-server` (fast inner loop, with `--env-file-if-exists=.env.local`). `pnpm smoke` runs `sam local start-invoke` for pre-deploy parity check (slow, only invoked manually).

**Static site wrapper:**

- [x] Create `apps/serverless/peaktrack-app-site/` as a near-verbatim clone of `getpeaktrack-site` (SAM template for S3 + CloudFront with SPA fallback, `deploy.sh`, `deploy-app.sh`).  → Wrapper does **not** carry its own `vite.config.js`; instead the deploy scripts call `pnpm --filter @evil-empire/web-app build` because peaktrack-app is itself a workspace package (unlike `apps/web/getpeaktrack/` which is plain static source). Cleaner separation.

**Wiring:**

- [x] `turbo.json` already had `build`, `dev`, `lint`, `typecheck`, `test` with `"dependsOn": ["^build"]` — new packages picked up automatically, no edit needed.
- [x] Root `package.json` scripts: `dev:web`, `dev:api`, `build:web`, `build:api`, `deploy:web:{staging,prod}`, `deploy:api:{staging,prod}`.
- [x] `.env.example` files added to `peaktrack-app` and `peaktrack-api` listing every var from the Environment variables table.
- [x] README.md in each new package with dev/deploy commands.
- [x] **CI** — repo has no CI today; v1 ships without one as the plan allowed. PR 8 picks it up if needed.
- [x] **First-build bundle baseline captured:** **117.79 KB gzipped initial JS** + 1.36 KB gzipped CSS. RN-Web + React 19 + TanStack Router + evil_ui's placeholder-route surface.

**Domain:** v1 staging deploys to the default CloudFront distribution domain (`d7kj6czc8q4sw.cloudfront.net`). Custom subdomain `app.getpeaktrack.com` + ACM cert + Route 53 lands in PR 8 alongside the production cutover.

- [x] **Merge checklist:** `pnpm build` clean · `pnpm typecheck` clean · `pnpm lint` clean (PR-1 packages clean; pre-existing warnings in `peaktrack-services`/`parsers`/`mobile` deferred to a separate chore PR) · staging deploy of `peaktrack-app-site` renders the placeholder UI on the default CloudFront domain · staging deploy of `peaktrack-api` returns `200` on `/health`, `401` on `POST /api/coach/prompt` (both no-auth and bad-token paths verified locally + remote), `vary: Origin` header set with no `Access-Control-Allow-Origin` echoed for a disallowed origin · bundle baseline recorded above · pre-PR-1 RLS audit, evil_ui smoke, and mobile-auth-surface results documented above.

### PR 2 — `feat(web): auth + protected layout shell` ✅

**Status:** Shipped 2026-04-25 directly on `develop` (commit `0fae577`). Browser-verified locally against the shared Supabase project: sign-up → email verify → sign-in → home → sign-out works; unauthenticated `/` redirects to `/sign-in`; authed users hitting `/sign-in` bounce to `/`.

Ships sign-in / sign-up / sign-out and the authenticated app shell. No workout features yet.

**Before starting:** read `apps/mobile/PeakTrack/contexts/AuthContext.tsx` and the auth screens to confirm the actual auth surface. If mobile is **email/password only**, this PR is the straight port below. If mobile uses **OAuth providers** (Apple / Google via `expo-web-browser`), web's flow is materially different — it uses Supabase's `signInWithOAuth` with a redirect back to a `/auth/callback` route on the web origin. Document what mobile actually has in the PR description and adjust scope accordingly. (Earlier draft assumed email/password without checking; that assumption is the kind of thing that turns a 3-day PR into a 5-day PR if wrong.)

→ Confirmed in PR 1 pre-flight: mobile is email/password only. PR 2 took the straight port path, no `/auth/callback` route.

**Deltas from plan worth knowing for PR 3+:**

- **Auth guards extracted to `lib/auth-guards.ts`.** Original plan put `beforeLoad` logic inline on the `_app` / `sign-in` / `sign-up` routes. Pulled `requireSession()` / `redirectIfAuthed()` into a shared module so they're directly testable without spinning up a router context — and so the redirect-target string lives in one place when PR 4+ adds more guarded routes. Pattern PR 3+ should follow: any route-level guard goes here, not inline.
- **Supabase `detectSessionInUrl` flipped to `true`.** Original plan said web is SPA-only with no magic-link flow, so the flag stayed at `false`. Browser smoke caught the gap: after email verification, Supabase redirects to `/sign-in#access_token=…&refresh_token=…` and with the flag off, the user has to type their password again to actually get in. With the flag on, the client parses the hash on init, the auth state listener fires, and the user lands signed in straight from the email link.
- **Supabase Redirect URL allowlist required dashboard edit.** Supabase silently substitutes the project's Site URL (was `peaktrack://sign-in`) for any `emailRedirectTo` not in the project's Redirect URL allowlist — verification emails were pointing at the mobile deep link instead of the web URL. Resolution is dashboard-side (Authentication → URL Configuration → Redirect URLs): add `http://localhost:5173/**`, the staging CloudFront URL, and (when PR 8 wires it) `https://app.getpeaktrack.com/**`. Site URL stays as `peaktrack://sign-in` so mobile signups still deep-link. Documented in `docs/evil_empire/peakTrack/known-caveats.md` (TODO if not already).
- **TanStack `redirect()` returns a `Response` with options nested under `.options`.** Tests asserting `toMatchObject({ to: '/sign-in' })` on the thrown value fail; the correct matcher is `{ options: { to: '/sign-in' } }` (or use `isRedirect()` from `@tanstack/react-router`). Caught by the auth-guards test suite — note for PR 4+ tests on routes with `beforeLoad`.
- **`#root` made a flex column in `styles.css`.** PR 1 set `html, body, #root { height: 100% }` but `#root` itself wasn't a flex container, so `_app`'s `flex: 1` chain stopped one level short of the viewport and the sidebar didn't stretch full height. Added `#root { display: flex; flex-direction: column }`. Rule of thumb for PR 4+ layouts: any top-level flex container that needs to fill the viewport assumes `#root` is now flex.
- **`@evil-empire/ui` SidebarNav active text bug fixed.** Active text was using `colors.primary` over a `colors.primary` background — orange-on-orange, label invisible. Swapped active text to `colors['primary-foreground']` to match the `Button` convention. Library bug, not consumer; benefits future tabs/active-state UI in evil_ui.
- **Bundle size now 587 KB raw / 176 KB gzipped initial JS** (up from PR 1's 117.79 KB). The ~58 KB gzipped growth is React Query, AuthContext, UserSettingsContext, and the slice of `peaktrack-services` they pull in (date-fns, Supabase auth surface). No code-splitting yet — PR 8 owns the bundle-budget conversation against this baseline.
- **`localStorage` wrapped in a Promise-returning adapter** even though Supabase v2 accepts sync storage. Plan called this out; keeping the note here so PR 3+ doesn't "simplify" by removing the wrapper — symmetry with mobile's `AsyncStorage` shape is the goal, not raw simplicity.
- **Routes use TanStack flat naming convention `_app.index.tsx`** rather than the directory variant `_app/index.tsx` the plan listed. Both work; flat is what landed.
- **Placeholder smoke test removed.** PR 1 left a `__tests__/smoke.test.tsx` placeholder; PR 2's storage-adapter and auth-guards tests cover real behavior, so the placeholder is gone.

- [x] Port `contexts/AuthContext.tsx` from mobile. Swap `AsyncStorage` → `localStorage` in the storage adapter only; keep signatures identical so mobile isn't affected. Wrap `localStorage` in a Promise-returning adapter so the interface matches `AsyncStorage` (Supabase v2 accepts either, but symmetry makes the swap a one-line diff).
- [x] Port `contexts/UserSettingsContext.tsx` the same way.
- [x] `lib/supabase.ts` — web Supabase client, reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. **`detectSessionInUrl: true`** so post-verify hash redirects auto-sign-in (see deltas).
- [x] `lib/query-client.ts` — shared React Query client instance.
- [x] `lib/auth-guards.ts` — extracted `requireSession()` / `redirectIfAuthed()` (see deltas — not in original plan, added for testability).
- [x] `app/routes/__root.tsx` — provider stack (QueryClientProvider, AuthProvider, UserSettingsProvider) + `notFoundComponent` for 404s.
- [x] `app/routes/sign-in.tsx`, `app/routes/sign-up.tsx` — public routes using evil_ui `Input` / `Button` / `Card`. Mobile is email/password only; no `/auth/callback` route.
- [x] `app/routes/_app.tsx` — protected layout route with `beforeLoad: requireSession`. Renders `SidebarNav` + outlet.
- [x] `app/routes/_app.index.tsx` — placeholder home showing signed-in email and a sign-out button. (Flat naming, see deltas.)
- [x] Unit tests for the storage adapter (4 tests) and the auth guards (5 tests) — 9/9 pass.
- [x] **Merge checklist:** sign-up → email verified → sign-in → lands on home · sign-out clears session and redirects · unauthenticated access to `/` redirects · authed user hitting `/sign-in` bounces to `/` · `pnpm typecheck`/`pnpm lint`/`pnpm test`/`pnpm build` clean across monorepo · all 9 tests pass.

### PR 3 — `refactor(services): lift program & exercise logic from mobile into shared package` ✅

**Status:** Shipped 2026-04-25 on `develop` (commit `2e93be1`).

Pre-req for PR 4 (workout management) and PR 5 (programs). Originally specced as PR 4, after the workout-management PR; review found that the workout-management routes also reach for helpers (`parseSetInput`, `formatExercisePhase`, `interpolateWeight`, `buildPhaseData`) that this PR moves, which would force a temporary copy in the web app. Doing the lift first means the web app only ever imports from `@evil-empire/peaktrack-services`, never from `apps/mobile/PeakTrack/lib/`.

This PR is mobile-only at the file level — no web product code lands here.

**Deltas from plan worth knowing for PR 4+:**

- **`formatExercisePhase` and `parseSetInput` were already wrappers**, not lift candidates. Both lived in `apps/mobile/PeakTrack/lib/` only as `export * from '@evil-empire/parsers'` shims. PR 3 retired both wrappers entirely and pointed every consumer at `@evil-empire/parsers` directly — cleaner than re-creating them in `peaktrack-services`. So the actual lift list is 9 modules into `peaktrack-services/src/` plus 2 wrappers retired, not 10 lifts.
- **`prepareMaterializeInputs` had to swap a self-import.** It used to import `MaterializeExerciseInput` from `@evil-empire/peaktrack-services`; that becomes a circular self-reference once the file lives inside the package. Fixed with a relative `from './programService'` import. Pattern for any future intra-package files: never use the `@evil-empire/peaktrack-services` barrel from inside the package itself.
- **Removed the legacy re-export block at the top of `progressionLayout.ts`** — `export type { ColumnLayout, PerformedShape, TileColor } from './progressionLayoutCore'` and the matching `normalizePerformed` re-export — because once both files are exported via `export *` from the package barrel, the re-exports cause ambiguity errors when consumers import the names from the package root. They were only there for the old mobile-local `from '../lib/progressionLayout'` import shape, which no longer exists.
- **Two import paths used the `@/lib/...` TS path alias** rather than `../lib/...` (`WorkoutTimerDisplay.tsx`). The first sed pass missed them and they only surfaced as typecheck errors. Lesson for PR 4+: when grepping for relative imports in mobile files, also search for the `@/lib/` alias form.
- **Two test-mock files needed updating to match the new module boundaries.** `EditExecutionModal.test.tsx` collapsed three `jest.mock('../../lib/...')` calls into mocks against `@evil-empire/parsers` (parseSetInput + formatExercisePhase) and `@evil-empire/peaktrack-services` (interpolateWeight). `useExercisePhases.test.ts` mocked four phase-service functions but the empty mock broke the now-co-located `buildPhaseData` import — fixed with a `...jest.requireActual('@evil-empire/peaktrack-services')` spread that keeps the real `buildPhaseData` while overriding only the four service calls.
- **Bonus fix folded into the same commit:** `peaktrack-api`'s test script switched from `vitest run` to `vitest run --passWithNoTests` so packages with no test files don't fail the whole `pnpm test` turbo run. Unrelated to the lift, but caught by running the full test suite as part of merge verification — and it's the kind of papercut that compounds as more empty-test packages get scaffolded.

- [x] Move `parseProgramText`, `programScheduling`, `resolveProgramWeights`, `prepareMaterializeInputs`, `exerciseProgressionLayout`, `progressionLayout`, `progressionLayoutCore`, `buildPhaseData`, `interpolateWeight`, ~~`formatExercisePhase`~~ (already a re-export wrapper, retired instead — see deltas) out of `apps/mobile/PeakTrack/lib/` into `packages/peaktrack-services/`. Kept the modules in `peaktrack-services` rather than splitting into a sibling package; the package gained 9 source files + 5 test files, still well under the "feels overloaded" threshold.
- [x] Update `apps/mobile/PeakTrack/` imports to the new location; retire the local `lib/parseSetInput.ts` wrapper. (`formatExercisePhase.ts` wrapper also retired — same pattern.)
- [x] Move tests for the lifted modules into `packages/peaktrack-services/__tests__/`. Jest + ts-jest wired into the package mirroring the `parsers` convention, with `moduleNameMapper` resolving `@evil-empire/parsers` and `@evil-empire/types` to their workspace `src/` directly.
- [x] `pnpm test --filter=@evil-empire/peaktrack-services` passes — 75/75 in the new home, identical assertion coverage to before the lift.
- [x] **Mobile app starts and runs unchanged from a user's perspective** — iOS sim smoke pending; deferred to the human verification step before merge to main. Typecheck + lint + build + 182 mobile jest tests pass, which establishes a strong negative on regressions, but the runtime smoke is the final gate.
- [x] **End-to-end program flow on mobile:** paste a known program text → materialize it → verify the produced exercises, sets, and weights match expected. **Pending — same iOS sim session as the visual smoke above.** The 75 unit tests in `peaktrack-services` cover each lifted module in isolation (`parseProgramText`, `programScheduling`, `resolveProgramWeights`, `prepareMaterializeInputs`); the mobile-side integration is exercised through the existing mobile jest tests; the only gap is the end-to-end DB-write path on a real device, which requires the human runner.
- [x] **Merge checklist:** ~~296~~ **468 parser tests still pass** (count grew between draft and ship; no parsers were touched in this PR) · 75 lifted tests pass in `peaktrack-services` · 182 mobile jest tests still pass · typecheck/lint/build clean across the monorepo · web app still builds clean. End-to-end program-flow smoke + iOS visual smoke are the two remaining items, listed above.

### PR 4 — `feat(web): workout management + history + RMs` ✅

**Status:** Shipped 2026-04-25 on `develop` (commit `e7baeb1`).

First real product PR. Gives the user a usable planning surface. Depends on PR 3 (the lift) — every helper this PR touches now lives in `@evil-empire/peaktrack-services`.

**Deltas from plan worth knowing for PR 5+:**

- **`/_app/workouts/$date/add` consolidated into `/_app/workouts/$date`.** Plan listed a separate add-exercise page; review found the inline name-add + paste-workout entry on the date view already covered the parity inventory, so PR 4 ships seven product routes instead of eight. PR 5 should extend the same pattern (inline add over a separate page) unless a flow genuinely needs a dedicated route.
- **Mobile RM state machine collapsed into a pure helper.** `hooks/useRmLookup` + `hooks/useAddExercisePhase` on mobile carry a multi-stage React state machine across two files. Web replaced both with a single pure helper at `app/lib/rm-lookup.ts` exposing `resolveWeights()` and `findPartialRmMatches()`; routes orchestrate the modal hand-offs themselves. ~150 lines of route code instead of ~250 lines of hooks; no behavioral difference. Pattern PR 5 should follow if it needs RM resolution from the program-import flow.
- **Modal primitive lives in the web app, not in `evil_ui`.** `evil_ui` doesn't ship a Modal yet; PR 4 added a tiny ~30-line `Modal.tsx` in `app/components/` rather than mint a library component for one consumer. If PR 5+ adds a second consumer, lift it into `evil_ui` then.
- **`Text` variant footgun:** evil_ui ships `heading` / `heading-sm` / `heading-lg` / `display` — there is no `heading-md`. Three components had to typo-fix during PR 4. PR 5+ should grep `heading-md` after writing routes.
- **Route tree regeneration is build-time.** `pnpm typecheck` errors on every freshly-added `createFileRoute(...)` until `pnpm vite build` (or `pnpm dev:web`) regenerates `routeTree.gen.ts`. Run vite once after adding routes before trusting the typecheck output.
- **Static `getSupabaseClient` in route loaders, not `await import()`.** First pass at the exercise-edit loader used `await import('@evil-empire/peaktrack-services')` and triggered Vite's "module both static- and dynamic-imported" warning, which would split it into its own chunk. Static import keeps it in the main bundle.
- **`body` needs an explicit dark background.** RN-Web's `View` renders transparent by default; without `body { background-color: #0d0d0d }` in `styles.css` the gap between the sidebar and any non-Card surface revealed the browser default through the main column. Fix folded into the same commit. Rule of thumb for PR 5+: don't assume a `View` has a background — set one explicitly or live inside a `Card`.
- **History window is 90 days on web, 30 on mobile.** Plan called for 90; mobile carries 30. Documented as an intentional difference rather than a bug; if mobile ever moves to 90, the web hook (`use-history.ts`) takes the same `days` arg.
- **Bundle size now 699 KB raw / 205 KB gzipped initial JS** (up from PR 2's 587/176). Adds React Query data layer, the new routes, all RN-Web-rendered evil_ui components used by them, and date-fns. Single chunk; no code-splitting yet — PR 8 owns the bundle-budget conversation against this baseline.
- **No new tests in PR 4.** Routes are thin orchestration over already-tested service calls and the new pure RM helper. The 9 PR 2 tests still pass; PR 8's polish pass can add component-level smoke if Lighthouse / a11y audit surfaces gaps.

- [x] `app/routes/_app.index.tsx` — redirects to today's `/_app/workouts/$date`.
- [x] `app/routes/_app.workouts.$date.tsx` — create/view workout(s) by date with inline add-exercise + paste-workout entry points.
- [x] ~~`app/routes/_app/workouts/$date/add.tsx`~~ — consolidated into `workouts/$date` (see deltas).
- [x] `app/routes/_app.exercises.$id.edit.tsx` — phase editor with parser, RM-lookup → RM-select → RM-form modal flow.
- [x] `app/routes/_app.workouts.import.tsx` — paste + review + RM-resolve + save (eager exact-RM resolution at parse time).
- [x] `app/routes/_app.history.tsx` — 90-day scrollback, read-only, copy-to-today action.
- [x] `app/routes/_app.rms.tsx` — RM CRUD, grouped by exercise/reps with the same "best per (name, reps)" rule mobile uses.
- [x] `app/routes/_app.settings.tsx` — weight unit, body weight, sign-out.
- [x] React Query hooks: `use-{workouts,exercises,phases,rms,history}.ts` wrap `@evil-empire/peaktrack-services`. RM-resolution logic at `app/lib/rm-lookup.ts` is pure (no React) so the import flow shares the same code.
- [x] Copy-workout action wired through `useCopyWorkout` → `copyWorkout` service; navigates to home (today) afterward.
- [x] No new logic in web that isn't in `peaktrack-services` — RM-lookup helper is the lone exception, pure JS, web-only because mobile already has its own equivalent shape.
- [x] ~~Smoke tests for each route's loader.~~ Deferred — loaders are thin enough that the typecheck pass + build is the safety net; PR 8 can add component smoke if needed.
- [x] **Merge checklist:** typecheck/lint/test/build clean across monorepo (13/13 typecheck, 11/11 test, lint clean except the two pre-existing mobile warnings carved out for the lint-backlog chore) · web bundles to 205 KB gzipped initial JS · body background fix folded in. Browser walkthrough of plan → edit → review on staging, web↔mobile row visibility, and 1RM-change-flips-percentage-weights are the remaining three checklist items still pending the human runner.

### PR 5 — `feat(web): programs`

Depends on PR 3 (the lift, which moved `parseProgramText` and friends into `peaktrack-services`). Ships the full program lifecycle on web.

- [x] `app/routes/_app/programs/index.tsx` — list (draft / active / archived).
- [x] `app/routes/_app/programs/$id.tsx` — detail (sessions, exercises, assigned state).
- [x] `app/routes/_app/programs/$id/edit.tsx` — edit metadata.
- [ ] `app/routes/_app/programs/$id/assign.tsx` — assign / activate for the user.
- [x] `app/routes/_app/programs/new.tsx` — create from pasted program text (uses `parseProgramText` from `@evil-empire/peaktrack-services`).
- [x] `app/routes/_app/help/input-format.tsx` — static page mirroring mobile's `exercise-input-help.tsx`.
- [x] React Query hooks for the program read/write surface.
- [x] Import UI uses evil_ui `TerminalBlock` to preview parsed output before commit (reuse of existing component).
- [x] **Merge checklist:** a program pasted into web materializes on mobile · parser errors surface clearly in the UI · typecheck / lint / test clean.

### PR 6 — `feat(web): progression views` ✅

**Status:** Implemented 2026-04-26 on `develop` (commit pending).

**Deltas from plan worth knowing for PR 7+:**

- **No charting library — plain inline SVG instead.** Plan recommended `recharts`. The mobile screens render a custom tile-stack visualization plus a tiny trend polyline, not a generic line chart, so a chart lib would only have helped with the polyline (5 lines of `<polyline>` + `<circle>`). Skipping recharts saves ~50 KB gzipped and keeps the visual identical to mobile. Decision: render `<svg>` directly inside react-native-web `<View>` (which is just a `<div>`); SVG primitives are valid DOM children. Pattern PR 7+ should follow if it needs a chart: only reach for recharts when the visualization is genuinely a generic line/bar/pie chart, not a custom stack-tile layout.
- **Shared `ProgressionChart` component**, not two near-duplicate renderers. Mobile carries two near-identical chart implementations (one in `exercise-progression.tsx`, one in `program-progression.tsx`). Web extracts the unified shape into `app/components/ProgressionChart.tsx` (~280 lines) consumed by both routes via a `ChartSession[]` adapter. Keeps the two routes thin (~100 lines each, mostly data → ChartSession mapping). Route files lazy-import the chart with `React.lazy()` so it lands in its own chunk.
- **Code-splitting via `React.lazy()` + `Suspense`**, not route-level `.lazy.tsx` files. TanStack Router supports per-route `.lazy.tsx` splits but the chart is shared between two routes and accounts for the heavyweight bit. Lazy-loading the chart component gives one shared chunk for both progression routes. Result: `ProgressionChart-*.js` chunk at **3.78 KB raw / 1.49 KB gzipped**, separate from the main bundle. Constants (`PROGRESSION_PRIMARY`, etc.) live in a sibling `ProgressionChart.constants.ts` so route files can reference them for the legend prop without dragging in the chart bundle eagerly.
- **`$id` path param actually carries a URL-encoded exercise name** for `/exercises/$id/progression`. Plan listed `$id` literally. Mobile keys exercise progression by name (no stable id across workouts), so the web equivalent does the same — name is `encodeURIComponent`'d into the path, then `decodeURIComponent`'d in the route component. Route file uses `$id` to match the existing `_app.exercises.$id.edit.tsx` shape and avoid TanStack Router's "different param names for the same path segment" smell.
- **Program progression route uses `$id_` (trailing underscore)** to escape the `_app.programs.$id` parent layout — same convention already used by `_app.programs.$id_.assign.tsx` and `_app.programs.$id_.edit.tsx`. Route shape: `/programs/$id/progression?exercise=Squat`. When `?exercise` is missing, the route renders an exercise picker (button list) instead of redirecting; matches mobile's `Alert.alert` picker behavior.
- **Bundle size now 760 KB raw / 221 KB gzipped initial JS** (up from PR 4's 699/205, ~16 KB gzipped growth). The growth covers progression layout helpers (`buildSessionLayout`, `buildExerciseSessionLayout`, the `progressionLayoutCore` shared primitives) and the two new routes/hooks. Chart lives outside the main bundle. PR 8 owns the bundle-budget conversation against this baseline.
- **`fetchCompletedExerciseNameSet` lifted into a `useCompletedExerciseNames` React Query hook** so the RMs page can show "View progression" only for exercises with at least one completed log — same gating as mobile. Cache key `['rms', 'completed', userId]`.
- **No new tests.** Routes are thin orchestration over already-tested service calls (`fetchExerciseProgressionData`, `fetchProgramProgressionData`) and already-tested layout helpers (`buildSessionLayout`, `buildExerciseSessionLayout` — covered by `peaktrack-services` jest suite). The 9 PR 2 tests still pass.

- [x] `app/routes/_app.exercises.$id.progression.tsx` — per-exercise load-over-time (uses `buildExerciseSessionLayout`). Path param is URL-encoded exercise name.
- [x] `app/routes/_app.programs.$id_.progression.tsx` — program-level weekly volume / load (uses `buildSessionLayout`). Renders an exercise picker when `?exercise=` is missing.
- [x] **Charting decision:** plain inline SVG via `<svg>`/`<polyline>`/`<circle>` rendered as DOM children of react-native-web `<View>`. No `recharts` — see deltas. Trend overlay is one polyline + per-session circles; tile stacks are pure RN `<View>` rectangles.
- [x] Empty states: per-exercise route shows "No recorded sessions for X yet" `Card`; program route shows "No sessions for this exercise yet" `Card` and a no-exercises-in-program fallback in the picker.
- [x] Route-level code splitting via `React.lazy()` on the shared `ProgressionChart` component — own chunk at 3.78 KB raw / 1.49 KB gzipped, suspended behind a "Loading chart…" caption.
- [x] Navigation entry points: RMs page links to `/exercises/$id/progression` per exercise group (only when the user has completed logs for that exercise); program detail page links to `/programs/$id/progression`.
- [x] **Merge checklist:** typecheck clean across the monorepo · web app lint + 9/9 tests pass · build clean (760 KB raw / 221 KB gzipped initial JS, ProgressionChart in its own 3.78 KB / 1.49 KB chunk) · pre-existing `evil_ui#lint` failure (ESLint v9 config migration not done) is unrelated and tracked separately. Browser walkthrough — execute a workout on mobile → reload the web progression view → new data visible — is the remaining checklist item, pending the human runner.

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
- [ ] **Observability:** CloudWatch metrics for the Lambda — request count, error rate, p99 latency. CloudWatch alarm on a spike in 401s (a JWT-spray attack would show as a sudden cliff in the auth-failure metric). One dashboard widget per metric; no fancy infra. Without this, the first sign of trouble is users complaining.
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
