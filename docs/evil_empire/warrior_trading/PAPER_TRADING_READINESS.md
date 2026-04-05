# Paper Trading Readiness Assessment

**Date**: 2026-04-05
**Target**: Monday market open (2026-04-06)
**Verdict**: GO

---

## Pre-Launch Fix (Done)

`ALPACA_PAPER=true` was missing from `.env`. The config defaults to `"true"` when absent, so it was safe — but now it's explicit.

## Verified Fixes from Code Review (2026-04-02)

All 12 critical and high issues from REVIEW.md have been confirmed fixed in the source code:

| # | Issue | Fix Confirmed |
|---|-------|---------------|
| 1 | Race condition: duplicate bracket orders | `executionInProgress` flag in `trader.ts:55`, checked at line 218, set/cleared around `executeSignal` |
| 2 | Non-atomic state file write | `state-persistence.ts` uses `fs/promises.rename` after `Bun.write(tmpFile)` |
| 3 | No validation on deserialized risk state | `isValidState()` at line 18 with `Number.isFinite` checks and date regex |
| 4 | Relative volume always 0 | `scanner/index.ts:64-74` calls `computeRelativeVolumeBatch`, enriches candidates, filters by `minRelVolume` |
| 5 | Position monitored with wrong symbol | `trader.ts:213` checks `symbol === this.openPosition.symbol` |
| 6 | SessionTimer.emit discards async rejections | `session-timer.ts:120` is `async emit()` with `await cb()` in try/catch |
| 7 | getAccount() REST latency in signal path | `cachedEquity` field at `trader.ts:56`, used in `executeSignal` at line 257 |
| 8 | ALPACA_PAPER typo enables live trading | `config.ts:61-64` throws if value isn't exactly `"true"` or `"false"` |
| 9 | Invalid WebSocket URL (`/v2/sqs`) | `client.ts:64` now reads `/v2/iex` |
| 10 | Unsafe type casts on equity | `index.ts:71-74` validates with `Number.isFinite` and `> 0` |
| 11 | TOCTOU race in closeOpenPosition | `trader.ts:438` sets `openPosition = null` after `onTradeCompleted()` at line 419 |
| 12 | dist/ tracked in git | App-level `.gitignore` covers `dist/`, `risk-state.json`, `results/`, `.cache/` |

Medium and low issues (13–30) are also all fixed per REVIEW.md, except #18 (test coverage) which is partially addressed with 25 test files now in place.

## Safety Checks Verified

- **Paper mode**: `.env` has `ALPACA_PAPER=true`, config validates strictly, `index.ts` warns and requires `CONFIRM_LIVE_TRADING=yes` for non-interactive environments
- **Risk management**: 1.5% risk per trade, 10% max daily loss, 3 max consecutive losses, atomic state persistence with halt after 3 save failures
- **Connectivity**: `index.ts` validates Alpaca account equity on startup, exits on failure
- **Graceful shutdown**: SIGINT/SIGTERM handlers flatten positions before exit
- **End-of-day flatten**: `close` session phase (15:45–16:00 ET) triggers `flattenPositions()`

## Scanner Pipeline

Fully wired end-to-end:

1. Fetch tradeable symbols (cached to file)
2. Gap scan — parallel batches of 5 × 200 symbols
3. Float filter — parallel batches
4. Relative volume — `computeRelativeVolumeBatch`, filter below `minRelVolume`
5. News filter — catalyst detection
6. Score, rank, select top 3 for watchlist

## Dashboard

- React + Vite + TradingView Lightweight Charts
- WebSocket with exponential backoff reconnect (1s → 2s → ... → 10s cap)
- All trading events streamed: bars, indicators, signals, position open/close/update, risk state, equity curve, scanner results

## Backend WebSocket (Alpaca Stream)

- `/v2/iex` feed (free tier)
- Exponential backoff reconnect up to 30s, max 10 attempts
- Auto-resubscribes to bars/quotes on reconnect
- JSON.parse wrapped in try/catch

## Known Limitations (Not Blockers)

1. **`isTradingAllowed()` limits trades to 9:30–11:00 ET** — by design for first-hour momentum strategies. Bot will not take new positions after 11am.
2. **Single position at a time** — the bot holds at most one open position.
3. ~~`trader.ts:78` has an unvalidated equity parse~~ — **Fixed**: now validates with `Number.isFinite()` and `> 0`, matching `index.ts` pattern.
4. **Test coverage is partial** — 25 test files exist covering critical paths, but not all edge cases. Run `bun test` locally before Monday to confirm all pass.

## Pre-Monday Checklist

- [x] `ALPACA_PAPER=true` in `.env`
- [x] Run `bun test` locally — confirm all 25 test files pass (158 pass, 0 fail)
- [ ] Run `bun run dev` and verify Alpaca connectivity message in logs
- [ ] Observe pre-market scan at 7:00 ET — confirm candidates appear in dashboard
- [ ] Watch first trade execution at 9:30 ET — confirm bracket order, fill, and position tracking
