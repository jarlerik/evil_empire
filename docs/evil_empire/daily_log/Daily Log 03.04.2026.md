---
title: Daily Log 03.04.2026
type: note
permalink: evil-empire/daily-log/daily-log-03.04.2026
tags:
- daily-log
---

## Dashboard instrumentation & Alpaca market data fix

Wired dashboardBus.broadcast() into trader.ts, watchlist.ts, and index.ts for all live trade lifecycle events (phases 1.4, 2.1–2.4). Fixed Alpaca SDK 0.0.32-preview bug where market data calls were routed to the trading API instead of data.alpaca.markets by bypassing the SDK with direct fetch, and defaulted to IEX feed for free-tier accounts.

## Backtest results output directory

Moved backtest output files (JSON + equity CSV) into a `results/` subdirectory instead of the project root. Added `results/` to `.gitignore`.

## Backtest dashboard playback (Phase 5)

Implemented backtest replay in the dashboard UI. SimTrader now emits all dashboard events (bar, indicators, signal, position lifecycle, risk, equity, session progress) and supports playback controls (pause/play/step/speed) via the event bus. Backtest starts paused so the user can open the dashboard before playback begins. Use `--dashboard` flag: `bun run src/backtest.ts MRVL 2026-02-01 2026-03-31 --dashboard`.