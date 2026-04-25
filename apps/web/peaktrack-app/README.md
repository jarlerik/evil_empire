# @evil-empire/web-app

PeakTrack web app — TanStack Router on plain Vite, React 19, consuming
`@evil-empire/ui` via `react-native-web`. v1 is a management + analytics
surface (planning, history, programs, RMs, progression). Workout execution
stays mobile-only.

## Commands

Run from this directory or via the root scripts (`pnpm dev:web`, etc.).

```bash
pnpm dev          # Vite dev server on :5173
pnpm build        # Production build to ./dist
pnpm preview      # Serve the production build locally
pnpm typecheck    # tsc --noEmit
pnpm lint         # ESLint over app/
pnpm test         # Vitest
```

## Environment

Copy `.env.example` to `.env.local` and fill in real values. Vite only
exposes vars prefixed with `VITE_` to the browser bundle.

## Structure

```
app/
  routes/         # TanStack Router file-based routes (plugin generates routeTree.gen.ts)
  main.tsx        # Entry — mounts <RouterProvider />
  styles.css      # Tailwind directives
```

## Notes

The Vite config aliases `react-native` → `react-native-web` and resolves
`.web.tsx` first, so an evil_ui component can ship a `Component.web.tsx`
sibling that overrides the native version on web. PR 2 will swap the
placeholder home for the real auth shell.
