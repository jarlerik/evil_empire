---
title: Daily Log 25.04.2026
type: note
permalink: evil-empire/daily-log/daily-log-25.04.2026
tags:
- daily-log
- web
- auth
- peaktrack
---

## PR 2 — feat(web): auth + protected layout shell

Wired sign-in / sign-up / sign-out and the authenticated app shell on the new `apps/web/peaktrack-app`. Mobile uses email/password only — no OAuth — so PR 2 took the straight port path with no `/auth/callback` route. `AuthContext` and `UserSettingsContext` were ported from mobile with two changes: `AsyncStorage` swapped for a Promise-returning `localStorage` adapter (`webStorageAdapter` in `lib/storage-adapter.ts`) so the Supabase storage shape matches the mobile interface, and the RN `Platform.OS === 'web'` SSR check dropped since the web app is SPA-only.

The protected layout (`app/routes/_app.tsx`) is a TanStack pathless layout route whose `beforeLoad` calls `requireSession()` from `lib/auth-guards.ts` and throws a redirect to `/sign-in` when no Supabase session exists. The mirror guard `redirectIfAuthed()` is wired to both auth routes so an already-authed user lands on `/` instead of the form. Extracted both guards into `lib/auth-guards.ts` so they're directly testable without a router context. `__root.tsx` got the provider stack (`QueryClientProvider` + `AuthProvider` + `UserSettingsProvider`) and a `notFoundComponent` rendering an evil_ui `Card` + `Button` for 404s.

Tests cover the storage-adapter round trip and the two auth guards. The redirect-throw assertion was a sharp edge: TanStack's `redirect()` returns a `Response` with the options nested under `.options`, so `toMatchObject({ to: '/sign-in' })` failed until rewritten as `{ options: { to: '/sign-in' } }` and asserted against `isRedirect()` from `@tanstack/react-router`. 9 tests pass; typecheck, lint, and build clean across the web app and the rest of the monorepo.

## Browser-smoke fixes folded into the PR 2 commit

Two issues caught during the browser walkthrough and fixed before commit. The `@evil-empire/ui` SidebarNav active item rendered orange-on-orange because the active text was using `colors.primary` over a `colors.primary` background — swapped the active text color to `colors['primary-foreground']` to match how `Button` does it. And `#root` wasn't a flex container, so `_app`'s `flex: 1` chain stopped one level short of the viewport and the sidebar didn't stretch full height — added `display: flex; flex-direction: column` to `#root` in `styles.css`. Also flipped Supabase client `detectSessionInUrl` to `true` so users land signed in after clicking the verification email instead of having to re-enter the password against the `#access_token=…` hash that Supabase appends post-verify.

## Supabase URL allowlist needs the web origins

Documented (not code) but worth recording: Supabase silently substitutes the project's Site URL for any `emailRedirectTo` that isn't in the project's Redirect URL allowlist. With only `peaktrack://` previously listed, web signups were getting verification emails that pointed at the mobile deep link. Resolution is dashboard-side — add `http://localhost:5173/**`, the staging CloudFront URL, and (when PR 8 wires it) `https://app.getpeaktrack.com/**` to Authentication → URL Configuration → Redirect URLs. Site URL stays as `peaktrack://sign-in` so mobile signups that lose their explicit `emailRedirectTo` still deep-link correctly.

## PR 3 — refactor(services): lift program & exercise logic into shared package

Lifted ten modules from `apps/mobile/PeakTrack/lib/` into `packages/peaktrack-services/src/`: `parseProgramText`, `programScheduling`, `resolveProgramWeights`, `prepareMaterializeInputs`, `buildPhaseData`, `interpolateWeight`, `progressionLayoutCore`, `progressionLayout`, `exerciseProgressionLayout` — plus retiring the `formatExercisePhase.ts` and `parseSetInput.ts` re-export wrappers (consumers now import directly from `@evil-empire/parsers`). Internal cross-module imports adjusted to relative paths inside the package; `prepareMaterializeInputs` had to swap `from '@evil-empire/peaktrack-services'` for relative imports of `MaterializeExerciseInput`, `resolveProgramWeights`, and `buildPhaseData` to avoid a circular self-reference.

The five corresponding test files moved into a new `packages/peaktrack-services/__tests__/` directory; jest + ts-jest wired into the package mirroring the parsers package convention (`moduleNameMapper` for `@evil-empire/parsers` and `@evil-empire/types`). 75 lifted tests pass in their new home; mobile retains its 182 tests including `volumeStats` (not in the lift list) and the now-relocated coverage.

Mobile import surface updated across 25 files. One sharp edge: two files used the `@/lib/...` path alias rather than `../lib/...`, which the first sed pass missed — `WorkoutTimerDisplay.tsx` failed typecheck until I caught the alias form. Two test mocks needed updating: `EditExecutionModal.test.tsx`'s three `jest.mock('../../lib/...')` calls became single mocks against `@evil-empire/parsers` (parseSetInput + formatExercisePhase) and `@evil-empire/peaktrack-services` (interpolateWeight); `useExercisePhases.test.ts` mocked the four phase-service functions but left the mock empty, which broke the now-co-located `buildPhaseData` import — fixed with `jest.requireActual` spread to keep the real `buildPhaseData` while overriding only the four service calls.

Web app inherits the lifted modules with zero changes — it already imported from `@evil-empire/peaktrack-services` and the package's `index.ts` re-exports the new modules via `export *`. Removed the dead `export type { ... } from './progressionLayoutCore'` re-export block that `progressionLayout.ts` carried for legacy local-import compat — it would have caused `export *` ambiguity at the package barrel. Tests / typecheck / lint / build all clean across the monorepo.

Shipped as `2e93be1` on `develop`.

## Bonus: pnpm test no longer fails on packages without tests

`peaktrack-api` had no test files yet, so `pnpm test` was failing the whole turbo run on its `vitest run` exit code 1. Switched its test script to `vitest run --passWithNoTests` so empty-test packages exit clean. `pnpm test` now passes 11/11 across the monorepo.

## PR 4 — feat(web): workout management + history + RMs

Shipped the first real product slice on the web app. Eight routes under the protected `_app` shell: `/_app/index` redirects to today's date; `/_app/workouts/$date` shows the day's workouts with inline add-exercise + paste-workout entry points; `/_app/exercises/$id/edit` is the phase editor with the full RM-lookup → RM-select → RM-form fallback flow; `/_app/workouts/import` is the paste-and-review import; `/_app/history` is the 90-day scrollback with copy-to-today; `/_app/rms` is the RM CRUD; `/_app/settings` covers weight unit, body weight, and sign-out.

Hooks (`app/hooks/use-{workouts,exercises,phases,rms,history}.ts`) wrap `@evil-empire/peaktrack-services` in React Query — the entire data layer goes through the shared package, no direct Supabase calls from routes. The RM-lookup flow that mobile carries in `hooks/useRmLookup` and `hooks/useAddExercisePhase` was ported into a single pure helper at `app/lib/rm-lookup.ts` (`resolveWeights` + `findPartialRmMatches`); routes orchestrate the modal hand-offs themselves rather than duplicating the mobile state machine. Two new components — `RmFormModal`, `RmSelectModal` — wrap a tiny `Modal` primitive (no `evil_ui` modal exists yet) and reuse `Input` / `Button` / `Card` from the library. The plan called for `/_app/workouts/$date/add` as a separate add-exercise page; consolidated into `workouts/$date` for v1 since the inline name + free-text-paste entry already covers the parity inventory.

Sharp edges along the way: TanStack Router’s `routeTree.gen.ts` doesn’t regenerate on `pnpm typecheck` so the first typecheck after adding routes errored on every `createFileRoute('/_app/...')` — running `pnpm vite build` once regenerates the tree. `Text` only ships `heading` / `heading-sm` / `heading-lg` / `display` (no `heading-md`) — three components got typo-fixed. The exercise-edit loader initially used `await import('@evil-empire/peaktrack-services')` and triggered a Vite warning about the module being both static- and dynamic-imported, which would split it into its own chunk; switched to a static `getSupabaseClient` import. Bundle is **205 KB gzipped initial JS** (up from PR 2's 176 KB), all in the single chunk — PR 8 owns the route-level code-splitting conversation.

Verification: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all clean across the monorepo (13/13 typecheck, 11/11 test, lint clean except for the two pre-existing mobile warnings carved out for the lint-backlog chore). Nine web tests still pass; no new tests added in PR 4 since the route loader paths are thin wrappers around already-tested service calls.
