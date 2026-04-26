# Daily Log 26.04.2026

## fix(web): un-nest program assign/edit so detail page can navigate to them
Renamed the assign/edit routes to flat siblings (`$id_.assign.tsx`, `$id_.edit.tsx`) so they mount independently of the detail route, which had no Outlet — the click was navigating but the child had nowhere to render. Also wired virtual program sessions onto the day view with a materialize action and shortened the assign flow when no 1RMs need filling.

## feat(web): progression views (PR 6)
Added the per-exercise (`/exercises/$id/progression`) and per-program (`/programs/$id/progression`) progression routes, both consuming a shared `ProgressionChart` component lazy-loaded into its own 1.49 KB gzipped chunk. Skipped recharts in favour of plain inline SVG since the visualization is custom tile stacks plus a tiny trend polyline; RMs page and program detail now link in only when the user actually has data to plot.

## feat(api): coach endpoint + secret plumbing (PR 7)
Filled in `POST /api/coach/prompt` with JWT gating, JSON validation, and `streamSSE` over Lambda Function URL `RESPONSE_STREAM`; an Anthropic provider adapter sits behind a stub fallback so the SSE path is exercisable without a real key. Added `@evil-empire/types/coach` as a subpath export, a hidden `/coach` web surface gated by `VITE_COACH_ENABLED=1`, and verified the secret is absent from the built client bundle.
