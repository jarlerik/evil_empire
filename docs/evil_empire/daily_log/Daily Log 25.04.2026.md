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
