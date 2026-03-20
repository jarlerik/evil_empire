# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Turborepo monorepo (pnpm workspaces) for **PeakTrack**, a React Native/Expo workout tracking app. See `README.md` and `CLAUDE.md` for full architecture and command reference.

### Quick reference

- **Node.js**: v22.21.1 (see `.nvmrc`); use `nvm use` to activate
- **Package manager**: pnpm 9.x (set via `corepack`)
- **Install deps**: `pnpm install` from repo root
- **Build shared packages**: `pnpm build --filter=@evil-empire/parsers --filter=@evil-empire/types` (must run before lint/test/typecheck)
- **Lint**: `pnpm lint`
- **Tests**: `pnpm test --filter=@evil-empire/parsers` (parser tests: 387 passing); mobile tests via `pnpm test --filter=@evil-empire/mobile` (has 1 pre-existing failure in `NavigationBar.test.tsx` due to missing SafeAreaProvider wrapper — not a regression)
- **Typecheck**: `pnpm typecheck`
- **Dev server (web)**: `cd apps/mobile/PeakTrack && npx expo start --web --port 8081`

### Non-obvious caveats

- The `pnpm build` root command fails because the serverless site packages (`@getpeaktrack/static-site`, `@vaikia-dev/static-site`) require AWS SAM CLI (`sam`), which is not installed. Always build with `--filter` to scope to the packages you need (parsers, types, mobile).
- The `pnpm test` command for `@evil-empire/mobile` uses `jest --watchAll` in its package.json script, which keeps running interactively. In CI or non-interactive contexts, run `cd apps/mobile/PeakTrack && npx jest --forceExit` instead.
- The mobile app requires Supabase environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) for authentication and data persistence. Without them, the app renders the auth screens but login/signup won't work.
- In the cloud VM, run the Expo app in web mode (`--web`) since there are no iOS/Android simulators available. This suffices for UI development and testing most non-native-specific features.
