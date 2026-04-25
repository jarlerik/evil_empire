# Daily Log 09.04.2026

## Untrack docs/ and add to gitignore
Removed the `docs/` folder from git tracking (42 files) and added it to `.gitignore`. Docs are now kept locally only and no longer shared via git.

## Claude Code hooks + warrior_trading typecheck fixes
Wired TaskCompleted hook to run `pnpm typecheck` in background on task completion (skips when no TS files dirty, notifies via terminal-notifier on failure). The hook immediately surfaced hidden type errors in warrior_trading — fixed tsconfig (`jsx: react-jsx`, include `*.tsx`) and three code errors (`ColorType.Solid` in Chart/EquityPanel, numeric percent in SessionBanner).

## Link AGENTS.md from CLAUDE.md
Added `@AGENTS.md` reference in `CLAUDE.md` so workflow/orchestration guidance loads alongside the codebase guide.

## Add eslint to apps/agent
Wired `@evil-empire/eslint-config/base` into `apps/agent` via a local `eslint.config.cjs`, added eslint + the config as dev deps, and cleaned up the unused `commitAll`, `push`, and `branch` symbols that eslint flagged in `apps/agent/src/index.ts`.
