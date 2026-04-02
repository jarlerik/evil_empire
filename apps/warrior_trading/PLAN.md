# Warrior Trading Bot — Implementation Plan

## Overview

A fully automated day trading bot implementing Warrior Trading strategies, built with **Bun** runtime, **TypeScript**, and the **Alpaca Trade API**. The bot handles pre-market scanning, real-time strategy execution, risk management, and order management.

## Architecture

```
warrior_trading/
├── package.json
├── tsconfig.json
├── .env.example
├── PLAN.md
├── src/
│   ├── index.ts                  # Entry point — boots the bot
│   ├── config.ts                 # All configurable parameters + env loading
│   ├── alpaca/
│   │   ├── client.ts             # Alpaca REST + WebSocket client setup
│   │   ├── market-data.ts        # Bars, quotes, snapshots, streaming
│   │   └── orders.ts             # Order placement, modification, cancellation
│   ├── scanner/
│   │   ├── gap-scanner.ts        # Pre-market gap scanner (gap%, volume, price)
│   │   ├── float-filter.ts       # Float lookup via Polygon/Alpaca asset data
│   │   └── news-filter.ts        # News catalyst detection (Alpaca news API)
│   ├── indicators/
│   │   ├── ema.ts                # EMA (9, 20, 50, 200)
│   │   ├── vwap.ts               # VWAP calculation
│   │   ├── macd.ts               # MACD (12, 26, 9)
│   │   ├── atr.ts                # ATR for dynamic stops
│   │   ├── relative-volume.ts    # Relative volume vs N-day average
│   │   └── candlestick/           # Candlestick pattern detection (one file per pattern family)
│   │       ├── index.ts           # Re-exports all patterns
│   │       ├── single.ts          # Hammer, shooting star, doji, spinning top, marubozu
│   │       ├── double.ts          # Engulfing, harami, tweezer, piercing line, dark cloud
│   │       └── triple.ts          # Morning/evening star, three soldiers/crows
│   ├── strategies/
│   │   ├── types.ts              # Strategy signal interfaces
│   │   ├── gap-and-go.ts         # Strategy A: Gap and Go
│   │   ├── micro-pullback.ts     # Strategy B: Micro Pullback
│   │   ├── bull-flag.ts          # Strategy C: Bull Flag Breakout
│   │   ├── flat-top.ts           # Strategy D: Flat Top Breakout
│   │   └── ma-pullback.ts        # Strategy E: Moving Average Pullback
│   ├── risk/
│   │   ├── risk-manager.ts       # Daily loss, consecutive losses, position sizing
│   │   ├── position-sizer.ts     # Calculate shares based on risk % and stop distance
│   │   └── state-persistence.ts  # Atomic JSON read/write for risk state across restarts
│   ├── engine/
│   │   ├── trader.ts             # Main orchestrator — ties everything together
│   │   ├── watchlist.ts          # Dynamic watchlist management
│   │   └── session-timer.ts      # Trading session clock (pre-market, open, midday)
│   └── utils/
│       ├── logger.ts             # Structured logging with timestamps
│       └── bar.ts                # Bar/candle data types and helpers
```

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Broker API:** @alpacahq/typescript-sdk (REST + WebSocket) — the actively maintained SDK
- **Market Data:** Alpaca Data API v2 (bars, snapshots, news)
- **Float Data:** Alpaca asset info + fallback to Polygon.io if available
- **Scheduling:** Bun native timers + cron-like session management

---

## Task List

### Phase 1: Foundation

- [x] **1.1** Initialize project: `package.json`, `tsconfig.json`, `.env.example`
- [x] **1.2** Build `src/config.ts` — all tunable parameters from the rules doc, env variable loading
- [x] **1.3** Build `src/alpaca/client.ts` — Alpaca REST client + WebSocket setup with reconnection (exponential backoff, max retries, alert on permanent failure). Use `@alpacahq/typescript-sdk` (not the legacy `alpaca-trade-api` package)
- [x] **1.4** Build `src/alpaca/market-data.ts` — fetch bars, snapshots, streaming price data
- [x] **1.5** Build `src/alpaca/orders.ts` — place/cancel/modify orders, bracket orders (entry + stop + target). Include fill confirmation loop (poll until filled/rejected/expired) and market-hours guard (reject orders outside valid sessions independently of engine)
- [x] **1.6** Build `src/utils/logger.ts` and `src/utils/bar.ts` — logging and data types

### Phase 2: Scanner

- [x] **2.1** Build `src/scanner/gap-scanner.ts` — scan all tradeable assets for gap %, price range, relative volume
- [x] **2.2** Build `src/scanner/float-filter.ts` — filter by float using Alpaca asset data (shares outstanding as proxy)
- [x] **2.3** Build `src/scanner/news-filter.ts` — check Alpaca news API for recent catalyst headlines
- [x] **2.4** Integrate scanner modules: gap → float → news → ranked watchlist of top 3

### Phase 3: Indicators

- [x] **3.1** Build `src/indicators/ema.ts` — EMA(9), EMA(20), EMA(50), EMA(200)
- [x] **3.2** Build `src/indicators/vwap.ts` — intraday VWAP
- [x] **3.3** Build `src/indicators/macd.ts` — MACD line, signal line, histogram
- [x] **3.4** Build `src/indicators/atr.ts` — ATR(14) for dynamic stop sizing
- [x] **3.5** Build `src/indicators/relative-volume.ts` — current volume vs 30-day average
- [x] **3.6** Build `src/indicators/candlestick/` — all 13 bullish/bearish patterns from the reference chart, split into single-candle, double-candle, and triple-candle pattern families

### Phase 4: Strategies

- [x] **4.1** Define `src/strategies/types.ts` — `StrategySignal` interface (entry price, stop, target, strategy name, confidence)
- [x] **4.2** Build `src/strategies/gap-and-go.ts` — breakout above premarket high / bull flag high with volume
- [x] **4.3** Build `src/strategies/micro-pullback.ts` — tiny red candle after momentum surge, entry on new high
- [x] **4.4** Build `src/strategies/bull-flag.ts` — consolidation with lower highs, breakout on volume
- [x] **4.5** Build `src/strategies/flat-top.ts` — multiple touches of resistance, breakout on third attempt
- [x] **4.6** Build `src/strategies/ma-pullback.ts` — bounce off 9/20 EMA in uptrend

### Phase 5: Risk Management

- [x] **5.1** Build `src/risk/position-sizer.ts` — calculate shares from risk %, entry price, and stop distance
- [x] **5.2** Build `src/risk/risk-manager.ts`:
  - Track daily P&L, halt trading at max daily loss (10% of equity)
  - Track consecutive losses, halt at 3 in a row
  - Enforce 2:1 minimum reward/risk ratio on all trades
  - Enforce single-position rule (one trade at a time)
- [x] **5.3** Build state persistence for risk manager — write daily P&L, consecutive loss count, and trade log to a local JSON file atomically after each trade close. Restore on restart so circuit breakers survive crashes

### Phase 6: Engine

- [ ] **6.1** Build `src/engine/session-timer.ts` — track pre-market (7:00–9:29), open (9:30–11:00), midday (11:00+), closed
- [ ] **6.2** Build `src/engine/watchlist.ts` — hold scanner results, stream live prices, update indicators
- [ ] **6.3** Build `src/engine/trader.ts` — main loop:
  1. Pre-market: run scanner → build watchlist
  2. Market open: stream bars for watchlist stocks → run strategies → execute signals
  3. Monitor open positions → check exit signals (time stop, pattern invalidation, bearish candles, trailing stop)
  4. Midday: tighten criteria, only A+ setups
  5. Close: flatten all positions, log daily summary

### Phase 7: Entry Point & Polish

- [ ] **7.1** Build `src/index.ts` — boot sequence, graceful shutdown, error handling
- [ ] **7.2** Add paper trading mode as default (Alpaca paper endpoint)
- [ ] **7.3** Add daily summary logging (trades taken, P&L, win rate)

### Phase 8: Verification

- [ ] **8.0** Build bar replay harness — feed historical OHLCV data through the strategy pipeline offline and log signals to a file. Validate signal quality before live paper testing
- [ ] **8.1** Verify all modules import/compile cleanly with `bun build`
- [ ] **8.2** Test scanner against live Alpaca paper account
- [ ] **8.3** Run one full simulated session in paper mode
- [ ] **8.4** Review risk manager edge cases (what happens at exactly 3 losses, at daily max, etc.)
- [ ] **8.5** Verify RISK_PER_TRADE_PCT math against MAX_DAILY_LOSS_PCT — ensure worst-case drawdown at MAX_CONSEC_LOSSES cannot exceed the daily loss limit

---

## Key Design Decisions

**Why Alpaca?** Free paper trading, commission-free live trading, built-in market data API with news, and a well-maintained JS/TS SDK. The WebSocket streaming gives us real-time bar updates needed for momentum strategies.

**Why Bun?** Faster startup than Node, native TypeScript support (no build step), built-in `.env` loading via `Bun.env`, and better performance for WebSocket handling.

**Single position at a time.** The Warrior Trading methodology (especially for small accounts) focuses on one high-conviction trade at a time. The bot will not open a second position while one is active.

**Paper trading by default.** The bot connects to Alpaca's paper endpoint unless explicitly configured for live trading. This is a safety-first approach.

**Float data limitation.** Alpaca doesn't directly expose float. We use `shares_outstanding` from the asset endpoint as a proxy, which is close but not identical (float = outstanding - restricted shares). For exact float, Polygon.io's ticker details endpoint would be the upgrade path.

---

## Configuration Reference

All values from the Warrior Trading rules doc, exposed as environment variables:

| Variable | Default | Description |
|---|---|---|
| `ALPACA_KEY_ID` | — | Alpaca API key |
| `ALPACA_SECRET_KEY` | — | Alpaca secret key |
| `ALPACA_PAPER` | `true` | Use paper trading endpoint |
| `MIN_GAP_PCT` | `5` | Minimum gap % from prior close |
| `PREF_GAP_PCT` | `20` | Preferred gap % (higher priority) |
| `MIN_PRICE` | `1.00` | Minimum stock price |
| `MAX_PRICE` | `20.00` | Maximum stock price |
| `MAX_FLOAT` | `20000000` | Maximum float (shares) |
| `MIN_REL_VOLUME` | `5` | Minimum relative volume multiplier |
| `RR_RATIO` | `2` | Minimum reward:risk ratio |
| `RISK_PER_TRADE_PCT` | `1.5` | % of equity to risk per trade (keep low so MAX_CONSEC_LOSSES × risk < MAX_DAILY_LOSS_PCT) |
| `MAX_DAILY_LOSS_PCT` | `10` | Daily loss limit as % of equity |
| `MAX_CONSEC_LOSSES` | `3` | Stop after N consecutive losers |
| `TIME_STOP_BARS` | `5` | Exit if no progress after N bars |
| `TRAILING_STOP_PCT` | `1.5` | Trailing stop distance % |
| `STRATEGIES` | `all` | Comma-separated: `gap-and-go,bull-flag,flat-top,ma-pullback,micro-pullback`. `all` is validated at startup and expanded to the full list |
