# Backtest Engine — Implementation Plan

## Goal

Extend `replay.ts` into a full backtest engine that simulates order fills, position management, and exits using the **same logic as the live Trader**, then produces trade-level and aggregate performance metrics.

---

## Architecture Overview

```
src/
  backtest/
    backtest-engine.ts      ← orchestrator: feeds bars, manages day boundaries
    sim-broker.ts           ← simulated order fills + slippage model
    sim-trader.ts           ← mirrors Trader logic without Alpaca I/O
    stats.ts                ← per-trade + aggregate analytics
    types.ts                ← BacktestConfig, TradeRecord, BacktestResult
  backtest.ts               ← CLI entry point (replaces replay.ts role)
```

The key design principle: **reuse live modules directly** (strategies, indicators, RiskManager, position-sizer, config) and only replace the I/O layer (Alpaca orders → SimBroker, WebSocket bars → historical bar feed).

---

## File-by-File Specification

### 1. `src/backtest/types.ts` — Shared Types

```ts
export interface BacktestConfig {
  symbol: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  startingEquity: number;        // default 25_000
  commissionPerShare: number;    // default 0.005
  slippageTicks: number;         // default 1 (1 cent adverse fill)
  marketOpenHour: number;        // 9  (ET)
  marketOpenMinute: number;      // 30
  marketCloseHour: number;       // 15
  marketCloseMinute: number;     // 45  (flatten time, matches live)
}

export interface TradeRecord {
  id: number;
  symbol: string;
  strategy: StrategyName;
  confidence: number;
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;            // after slippage
  exitPrice: number;             // after slippage
  shares: number;
  side: "buy";
  pnl: number;                   // net of commissions
  commission: number;
  rMultiple: number;             // pnl / initial risk
  barsHeld: number;
  exitReason: "target" | "stop" | "trailing-stop" | "time-stop" | "vwap-breakdown" | "eod-flatten";
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: TradeRecord[];
  equity: EquityPoint[];         // equity curve
  stats: AggregateStats;
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
}

export interface AggregateStats {
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;          // gross profit / gross loss
  totalPnL: number;
  totalCommissions: number;
  netPnL: number;
  avgRMultiple: number;
  maxDrawdown: number;           // peak-to-trough in $
  maxDrawdownPct: number;        // peak-to-trough in %
  sharpeRatio: number;           // annualized, daily returns
  avgBarsHeld: number;
  tradesPerDay: number;
  strategyBreakdown: Record<StrategyName, {
    trades: number;
    winRate: number;
    avgR: number;
    totalPnL: number;
  }>;
}
```

### 2. `src/backtest/sim-broker.ts` — Simulated Order Execution

Replaces `alpaca/orders.ts`. Models limit-order fills against intra-bar price action.

**Responsibilities:**

- Accept a pending order (entry limit price, stop, target, shares).
- On each bar, check whether the limit price was touched:
  - **Entry fill rule:** If `bar.low <= limitPrice <= bar.high`, the order fills. Fill price = `limitPrice + slippageTicks * 0.01` (adverse slippage).
  - If the bar opens through the limit (gap through), fill at `bar.open + slippage` (worse case gap fill).
- Once filled, track the position and apply bracket logic:
  - **Target hit:** If `bar.high >= targetPrice`, exit at `targetPrice - slippage`.
  - **Stop hit:** If `bar.low <= stopPrice`, exit at `stopPrice - slippage`.
  - **Same-bar ambiguity:** If both stop and target are in range, assume stop hit first (conservative). Check if `bar.open <= stopPrice` — if so, gap-through stop at open.
- Commission = `shares × 2 × commissionPerShare` (round-trip).
- Expose `onBar(bar)` → returns `null | { filled } | { exited, exitPrice, exitReason }`.

**Key design choice — conservative fill assumptions:**
| Scenario | Assumption |
|----------|-----------|
| Entry limit touched | Fill at limit + slippage |
| Gap through entry | Fill at open + slippage |
| Target touched | Fill at target − slippage |
| Stop touched | Fill at stop − slippage |
| Both stop & target in range | Stop fills first (worst case) |
| EOD flatten | Fill at bar close − slippage |

### 3. `src/backtest/sim-trader.ts` — Simulated Trader

A stripped-down version of `engine/trader.ts` that replaces WebSocket streaming with a synchronous bar feed. Reuses the real modules:

**Reused directly (no changes):**
- All 5 strategies (`strategies/*.ts`)
- All indicators (`indicators/*.ts`)
- `RiskManager` (with a small tweak — see below)
- `calculatePositionSize` from `risk/position-sizer.ts`
- `loadConfig` from `config.ts`

**Simulated / replaced:**
- `Watchlist` → inline indicator state (same as `replay.ts` already does)
- `AlpacaStream` / `placeBracketOrder` / `waitForFill` → `SimBroker`
- `SessionTimer` → simple time-of-day check on bar timestamps

**Core loop (per bar):**

```
for each bar:
  1. Check if new trading day → reset VWAP, reset RiskManager daily state
  2. Determine session from bar.timestamp (pre-market / open / midday / close)
  3. Update indicators (EMA, VWAP, MACD, ATR)
  4. If position open → feed bar to SimBroker.onBar()
     - If SimBroker returns exit → record trade, update equity & risk state
     - Also run Trader's exit logic (trailing stop, time stop, VWAP breakdown)
       and force-close via SimBroker if triggered
  5. If no position AND trading allowed AND not halted:
     - Build IndicatorSnapshot
     - Evaluate all strategies → pick best signal ≥ confidence threshold
     - Run RiskManager.evaluateSignal() → if approved, submit to SimBroker
  6. If session == "close" AND position open → force flatten
  7. Record equity point
```

**RiskManager adaptation:**
The existing `RiskManager` uses `loadRiskState` / `saveRiskState` for disk persistence. For backtesting, we'll pass an option to skip disk I/O and instead initialize fresh state at the start of each simulated day. This can be done by:
- Adding an optional `skipPersistence: boolean` flag to the constructor.
- Or: creating a lightweight `BacktestRiskManager` subclass that overrides `initialize()` and `onTradeCompleted()` to avoid file I/O.

The second approach is cleaner — no changes to the live code path.

### 4. `src/backtest/stats.ts` — Analytics

Takes `TradeRecord[]` + `EquityPoint[]` and computes `AggregateStats`.

**Metrics:**

| Metric | Formula |
|--------|---------|
| Win rate | winners / total |
| Avg win / loss | mean PnL of winners / losers |
| Profit factor | Σ(winning PnL) / \|Σ(losing PnL)\| |
| R-multiple | trade PnL / (shares × (entry − stop)) |
| Max drawdown | max(peak − trough) over equity curve |
| Sharpe ratio | mean(daily returns) / std(daily returns) × √252 |
| Trades per day | total trades / trading days |
| Strategy breakdown | group all above by strategy name |

**Output formats:**
- Pretty-printed table to stdout
- Full JSON file (`backtest-{SYMBOL}-{START}-{END}.json`)
- Equity curve as CSV (`equity-{SYMBOL}-{START}-{END}.csv`) for charting

### 5. `src/backtest.ts` — CLI Entry Point

```
Usage:
  bun run src/backtest.ts <SYMBOL> <START> <END> [--equity 25000] [--slippage 1] [--commission 0.005]

Example:
  bun run src/backtest.ts AAPL 2026-01-02 2026-03-31
  bun run src/backtest.ts TSLA 2025-06-01 2025-12-31 --equity 50000
```

**Flow:**
1. Parse CLI args + merge with env-based Config
2. Fetch historical bars from Alpaca (paginate if > 10k bars)
3. Instantiate BacktestEngine with bars + config
4. Run simulation
5. Print summary stats to stdout
6. Write JSON results + equity CSV to disk

---

## What Changes in Existing Code

Minimal — the goal is zero changes to live trading paths.

| File | Change | Why |
|------|--------|-----|
| `risk/risk-manager.ts` | Extract daily state reset into a public `resetDaily(equity)` method | SimTrader needs to reset at each day boundary without disk I/O |
| `risk/state-persistence.ts` | No change | BacktestRiskManager bypasses this entirely |
| `config.ts` | No change | Backtest reuses `loadConfig()` as-is |
| `strategies/*.ts` | No change | Reused directly |
| `indicators/*.ts` | No change | Reused directly |
| `package.json` | Add `"backtest"` script | `"backtest": "bun run src/backtest.ts"` |

---

## Implementation Order

### Phase 1 — Core Simulation (sim-broker + sim-trader)
1. `backtest/types.ts` — define all interfaces
2. `backtest/sim-broker.ts` — order fill simulation with tests
3. `backtest/sim-trader.ts` — bar-by-bar loop with strategy eval + position mgmt
4. Smoke test: run against 1 week of AAPL data, verify trades are generated

### Phase 2 — Analytics
5. `backtest/stats.ts` — compute all metrics from trade records
6. `backtest.ts` — CLI wiring, JSON + CSV output
7. Validate: manually verify a handful of trades against a chart

### Phase 3 — Hardening & Extensions
8. **Multi-symbol support** — run scanner logic on historical snapshots to pick symbols, then backtest the top N in sequence (one position at a time, same as live)
9. **Walk-forward analysis** — split date range into in-sample / out-of-sample windows, run separately, compare
10. **Parameter sweep** — loop over config values (e.g., trailing stop 1%–3%) and tabulate results

---

## Testing Strategy

| Test | What it validates |
|------|-------------------|
| `sim-broker.test.ts` — limit fill | Bar touches limit → fills at limit + slippage |
| `sim-broker.test.ts` — gap through | Bar opens past limit → fills at open + slippage |
| `sim-broker.test.ts` — target exit | High reaches target → exits at target − slippage |
| `sim-broker.test.ts` — stop exit | Low reaches stop → exits at stop − slippage |
| `sim-broker.test.ts` — ambiguity | Both stop & target in range → stop fills first |
| `sim-trader.test.ts` — day reset | VWAP resets, daily PnL resets, halts clear |
| `sim-trader.test.ts` — risk halt | 3 consecutive losses → no more trades that day |
| `sim-trader.test.ts` — EOD flatten | Position open at 15:45 → force closed |
| `sim-trader.test.ts` — session filter | Signals before 9:30 are ignored |
| `stats.test.ts` — drawdown | Known equity curve → correct max drawdown |
| `stats.test.ts` — profit factor | 3 wins of $100, 2 losses of $50 → PF = 3.0 |
| Integration test | 1 month real data → results are deterministic across runs |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Look-ahead bias** | Inflated backtest returns | Strategies only see bars up to current index; snapshot built from historical buffer |
| **Survivorship bias** | Testing only stocks that still exist | Not a concern for single-symbol backtests; for multi-symbol, use scanner on historical data |
| **Overfitting** | Great backtest, poor live results | Walk-forward validation in Phase 3; track out-of-sample performance separately |
| **Intra-bar fill assumptions** | Real fills are worse than simulated | Conservative defaults: slippage, stop-before-target ambiguity rule |
| **1-minute bar granularity** | Can't model sub-minute price action | Acceptable for this strategy style (holds 5+ bars); document as known limitation |
| **API rate limits on historical data** | Slow data fetching for large ranges | Paginate in 10k-bar chunks; cache fetched bars locally in a JSON file |

---

## Example Output

```
$ bun run src/backtest.ts AAPL 2026-01-02 2026-03-31 --equity 25000

Fetching bars... 12,847 bars loaded (62 trading days)
Running backtest...

=== Backtest Results: AAPL  2026-01-02 → 2026-03-31 ===

  Total trades:     47
  Winners:          28 (59.6%)
  Losers:           19 (40.4%)
  Avg win:          $142.30
  Avg loss:         -$71.88
  Profit factor:    2.92
  Net P&L:          $2,618.42
  Total commission: $23.50
  Avg R-multiple:   1.24
  Max drawdown:     $812.00 (3.2%)
  Sharpe ratio:     1.87
  Avg bars held:    4.2
  Trades/day:       0.76

  Strategy breakdown:
    gap-and-go      18 trades  61% win  avg R 1.41  $1,420.10
    bull-flag        12 trades  58% win  avg R 1.18  $712.80
    micro-pullback   10 trades  60% win  avg R 1.02  $340.12
    flat-top          5 trades  60% win  avg R 1.15  $110.40
    ma-pullback       2 trades  50% win  avg R 0.80  $35.00

Results written to:
  backtest-AAPL-2026-01-02-2026-03-31.json
  equity-AAPL-2026-01-02-2026-03-31.csv
```
