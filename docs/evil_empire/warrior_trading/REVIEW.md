# Warrior Trading Bot — Code Review

**Date**: 2026-04-02
**Scope**: Security, Performance, Code Quality
**Status**: Pre-production review

---

## CRITICAL Issues (fix before any live trading)

### 1. Race condition: duplicate bracket orders (Security + Performance + Quality)

**File**: `src/engine/trader.ts:171-199`

`executeSignal` is async but called from a synchronous bar callback without `await`. `this.openPosition` remains `null` until the fill confirms (up to 30 seconds), so concurrent bars can pass the guard and place multiple bracket orders simultaneously.

**Fix**: Add a synchronous `executionInProgress` flag:

```typescript
private executionInProgress = false;

private evaluateStrategies(symbol: string, snapshot: IndicatorSnapshot): void {
  if (!isTradingAllowed()) return;
  if (this.riskManager.isHalted) return;
  if (this.openPosition || this.executionInProgress) {
    if (this.openPosition && symbol === this.openPosition.symbol) {
      this.monitorPosition(snapshot);
    }
    return;
  }
  // ... signal selection unchanged ...
  if (bestSignal) {
    this.executionInProgress = true;
    this.executeSignal(bestSignal).finally(() => {
      this.executionInProgress = false;
    });
  }
}
```

### 2. State file write is not atomic (Security)

**File**: `src/risk/state-persistence.ts:66-77`

The comment says "atomic write: write to temp file, then rename" but uses two sequential `Bun.write` calls. A crash between them corrupts `risk-state.json`, and the catch block silently resets to default state — losing knowledge of today's losses and consecutive losses, bypassing all circuit breakers.

**Fix**: Use `fs/promises.rename` which is atomic on POSIX:

```typescript
import { rename } from "fs/promises";

await Bun.write(tmpFile, JSON.stringify(state, null, 2));
await rename(tmpFile, STATE_FILE);
```

### 3. No validation on deserialized risk state (Security)

**File**: `src/risk/state-persistence.ts:38`

`JSON.parse(raw) as PersistedRiskState` is a TypeScript lie — no runtime validation. If fields are `NaN`, negative, or `Infinity` (from corruption or manual edit), `Math.abs(NaN) >= maxDailyLoss` is `false`, silently disabling all circuit breakers.

**Fix**: Add a runtime validator:

```typescript
function isValidState(s: unknown): s is PersistedRiskState {
  if (typeof s !== "object" || s === null) return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Number.isFinite(r.dailyPnL as number) &&
    Number.isFinite(r.consecutiveLosses as number) &&
    Number.isFinite(r.tradesCompleted as number) &&
    Number.isFinite(r.tradesWon as number) &&
    Number.isFinite(r.startingEquity as number) &&
    (r.startingEquity as number) > 0
  );
}
```

### 4. Relative volume is always 0 — bot cannot take any trade (Performance)

**File**: `src/scanner/gap-scanner.ts:55`, `src/scanner/index.ts`

`relativeVolume` is hardcoded to `0` in `GapCandidate` and `computeRelativeVolumeBatch` is never called anywhere. Every strategy checks `snap.relativeVolume < 2` and returns `null`, meaning the bot will reject every signal.

**Fix**: Call `computeRelativeVolumeBatch` in `runScanner` between float filter and news filter, and filter candidates below `config.scanner.minRelVolume`.

---

## HIGH Issues

### 5. Position monitored with wrong symbol's snapshot (Quality)

**File**: `src/engine/trader.ts:174-177`

`monitorPosition(snapshot)` is called with whatever symbol triggered the bar callback. If the open position is in AAPL but GME fires a bar first, AAPL's position is monitored using GME's bars, VWAP, and indicators — producing incorrect trailing stops and exit signals.

**Fix**:

```typescript
if (this.openPosition) {
  if (symbol === this.openPosition.symbol) {
    this.monitorPosition(snapshot);
  }
  return;
}
```

### 6. SessionTimer.emit silently discards async listener rejections (Quality)

**File**: `src/engine/session-timer.ts:115-122`

`emit` calls listeners synchronously but `onMarketClose` is async. If `flattenPositions()` rejects, the promise is lost — positions are not flattened at end-of-day.

**Fix**: Make `emit` async and await each callback:

```typescript
private async emit(phase: SessionPhase): Promise<void> {
  const callbacks = this.listeners.get(phase) ?? [];
  for (const cb of callbacks) {
    try {
      await cb();
    } catch (err) {
      log.error("Session listener error", { phase, error: String(err) });
    }
  }
}
```

### 7. getAccount() REST call on every signal adds 50-300ms latency (Performance)

**File**: `src/engine/trader.ts:203-205`

Equity is fetched via REST in the critical path between signal detection and `placeBracketOrder`. For momentum setups, this delay can mean the fill comes 1-2 price levels late.

**Fix**: Cache equity on startup and update after each completed trade. Remove the REST call from `executeSignal`.

### 8. ALPACA_PAPER typo silently enables live trading (Security)

**File**: `src/config.ts:61`

Any value other than `"true"` (including typos like `"ture"`, `"1"`, `"yes"`) resolves to `isPaper = false`, enabling live trading without warning.

**Fix**:

```typescript
const raw = env("ALPACA_PAPER", "true").toLowerCase().trim();
if (raw !== "true" && raw !== "false") {
  throw new Error(`ALPACA_PAPER must be "true" or "false", got: "${raw}"`);
}
const isPaper = raw === "true";
```

### 9. WebSocket URL is invalid (Quality)

**File**: `src/alpaca/client.ts:65`

```typescript
const WS_BASE = "wss://stream.data.alpaca.markets/v2/sqs";
```

`/v2/sqs` is not a documented Alpaca feed. Valid options are `/v2/iex` (free) or `/v2/sip` (paid SIP subscription).

### 10. Unsafe type casts on account data — NaN equity breaks all risk math (Security)

**Files**: `src/index.ts:57`, `src/engine/trader.ts:75,205`

`parseFloat((account as unknown as Record<string, string>).equity)` returns `NaN` if the SDK response shape changes. NaN flows into `startingEquity`, and all circuit breaker comparisons silently evaluate to `false`.

**Fix**: Add explicit validation after each account fetch:

```typescript
const rawEquity = (account as Record<string, unknown>).equity;
const equity = typeof rawEquity === "string" ? parseFloat(rawEquity) : NaN;
if (!Number.isFinite(equity) || equity <= 0) {
  throw new Error(`Invalid equity value from Alpaca: ${rawEquity}`);
}
```

### 11. TOCTOU race in closeOpenPosition (Quality)

**File**: `src/engine/trader.ts:307-328`

`this.openPosition = null` is set at line 321 before `await this.riskManager.onTradeCompleted(result)`. A bar arriving in that window sees no open position and may trigger a new signal, bypassing the consecutive-loss check from the just-completed trade.

**Fix**: Set `openPosition = null` only after `onTradeCompleted` resolves, or use the `executionInProgress` guard.

### 12. dist/ tracked in git (Security)

**File**: Root `.gitignore`

`apps/*/dist/` is not excluded. The built bundle embeds all source strings and could contain credentials if misconfigured.

**Fix**: Add `apps/*/dist/` to the root `.gitignore` and remove the committed `dist/index.js`.

---

## MEDIUM Issues

### 13. Timezone conversion unreliable on minimal server environments

**Files**: `src/alpaca/orders.ts:48-53`, `src/engine/session-timer.ts:13-18`

`toLocaleString` with timezone → `new Date()` parsing is locale-specific and not guaranteed to be parseable in all environments (Docker slim images without ICU data).

**Fix**: Use `Intl.DateTimeFormat.formatToParts` with a cached formatter instance.

### 14. Replay CLI has no input sanitization

**File**: `src/replay.ts:151,164`

Symbol and date args from CLI are interpolated into file paths without validation. `symbol = "../../somefile"` writes outside the working directory.

**Fix**: Validate `symbol` matches `/^[A-Z]{1,5}$/` and dates match `/^\d{4}-\d{2}-\d{2}$/`.

### 15. Float filter batches are sequential instead of parallel

**File**: `src/scanner/float-filter.ts:51-55`

Batches of 10 are processed sequentially. All 30 candidates could be fetched in a single parallel `Promise.all` within Alpaca's rate limit.

### 16. Gap scanner makes 40 sequential API calls

**File**: `src/scanner/gap-scanner.ts:28-58`

~8000 symbols / 200 per batch = 40 sequential requests. Parallel batches of 5 would reduce scan time 5x.

### 17. normalizeOrder uses explicit `any` (Quality)

**File**: `src/alpaca/orders.ts:198`

Every order passes through `normalizeOrder(raw: any)`. A SDK field rename breaks silently at runtime.

**Fix**: Define an `AlpacaRawOrder` interface matching the known response shape.

### 18. No test infrastructure (Quality)

No test script, no test framework, no `__tests__` directory. Financial-critical functions have zero test coverage:
- `calculatePositionSize` (position sizing math)
- `RiskManager.evaluateSignal` (all rejection conditions)
- Strategy `evaluate` functions (signal generation and rejection)
- `loadRiskState` / `saveRiskState` round-trip

Bun has a built-in test runner (`bun:test`) — no extra dependencies needed.

### 19. closePosition/closeAllPositions bypass trading-hours guard (Security)

**File**: `src/alpaca/orders.ts:181-195`

`assertTradingHours()` is called in `placeOrder` and `placeBracketOrder` but not in close functions. This may be intentional for emergency closes but should be explicitly documented.

### 20. flattenPositions estimates P&L from last bar close, not actual fill price (Quality)

**File**: `src/engine/trader.ts:331-349`

`closeAllPositions` submits a market order and returns immediately. The fill price is never retrieved, so persisted daily P&L diverges from actual brokerage P&L over time.

### 21. ALPACA_ENDPOINT config key exists but is never passed to the SDK (Quality)

**File**: `src/config.ts:67-73`, `src/alpaca/client.ts:10-15`

`config.alpaca.endpoint` is computed and logged but never used. Either remove it or wire it through.

---

## LOW Issues

### 22. 5-second live trading abort window insufficient for non-interactive environments

**File**: `src/index.ts:33-37`

In Docker/systemd/CI, there's no opportunity to Ctrl+C. Add a `CONFIRM_LIVE_TRADING=yes` env var requirement.

### 23. saveRiskState silently swallows errors

**File**: `src/risk/state-persistence.ts:84-86`

A failure to persist state is logged but trading continues. Should halt after N consecutive persistence failures.

### 24. No .gitignore inside apps/warrior_trading/

`risk-state.json` and `dist/` are not explicitly excluded at the app level.

### 25. WebSocket onmessage has no try-catch around JSON.parse

**File**: `src/alpaca/client.ts:99`

A malformed message will throw an unhandled exception that crashes the process in Bun.

### 26. Strategy array allocations on every bar

**Files**: `src/strategies/gap-and-go.ts:38`, `src/strategies/flat-top.ts:31,54`, `src/strategies/ma-pullback.ts:55`, `src/strategies/bull-flag.ts:37,55`

`slice-map-spread` patterns allocate intermediate arrays on every bar. Replace with index-based iteration.

### 27. Array.shift() for rolling bar window is O(N)

**File**: `src/engine/watchlist.ts:162-165`

50-element shift on every bar. A ring buffer would be O(1). Not urgent at 3 symbols/minute.

### 28. replay.ts lacks import.meta.main guard

**File**: `src/replay.ts:151-172`

Top-level CLI code runs on any import of the module, not just direct execution.

### 29. getLatestBars is dead code

**File**: `src/alpaca/market-data.ts:120-140`

Exported but never called anywhere in the codebase.

### 30. Tweezer patterns fail on doji bars

**File**: `src/indicators/candlestick/double.ts:56,63`

`barRange(prev) * 0.05` produces tolerance of `0` when prev is a doji, requiring exact floating-point match.

---

## Task List

### Critical — Must fix before any live trading

- [x] **#1** Add `executionInProgress` guard in `Trader.evaluateStrategies` (`trader.ts`)
- [x] **#2** Fix atomic state write — use `fs/promises.rename` instead of double `Bun.write` (`state-persistence.ts`)
- [x] **#3** Add runtime validator for deserialized risk state (`state-persistence.ts`)
- [x] **#4** Wire up `computeRelativeVolumeBatch` in scanner pipeline (`scanner/index.ts`, `gap-scanner.ts`)

### High — Fix before paper trading

- [x] **#5** Filter `monitorPosition` to open position's symbol only (`trader.ts`)
- [x] **#6** Make `SessionTimer.emit` async and await callbacks (`session-timer.ts`)
- [x] **#7** Cache account equity — remove REST call from `executeSignal` (`trader.ts`)
- [x] **#8** Reject invalid `ALPACA_PAPER` values instead of defaulting to live (`config.ts`)
- [x] **#9** Fix WebSocket URL from `/v2/sqs` to `/v2/iex` or `/v2/sip` (`client.ts`)
- [x] **#10** Add equity validation after every `getAccount()` call (`index.ts`, `trader.ts`)
- [x] **#11** Fix TOCTOU race in `closeOpenPosition` — null assignment after `onTradeCompleted` (`trader.ts`)
- [x] **#12** Add `apps/*/dist/` to root `.gitignore` and remove committed `dist/index.js`

### Medium — Fix before production

- [x] **#13** Replace `toLocaleString` timezone conversion with `Intl.DateTimeFormat.formatToParts` (`orders.ts`, `session-timer.ts`)
- [x] **#14** Add input sanitization to replay CLI args (`replay.ts`)
- [x] **#15** Parallelize float filter batches (`float-filter.ts`)
- [x] **#16** Parallelize gap scanner snapshot batches (`gap-scanner.ts`)
- [x] **#17** Replace `any` in `normalizeOrder` with typed `AlpacaRawOrder` interface (`orders.ts`)
- [ ] **#18** Add test infrastructure and unit tests for critical paths (`package.json`, new `__tests__/`)
- [x] **#19** Document or guard `closePosition`/`closeAllPositions` trading-hours behavior (`orders.ts`)
- [x] **#20** Retrieve actual fill price in `flattenPositions` instead of estimating from last bar (`trader.ts`)
- [x] **#21** Remove or wire through `ALPACA_ENDPOINT` config key (`config.ts`, `client.ts`)

### Low — Nice to have

- [x] **#22** Add `CONFIRM_LIVE_TRADING` env var requirement for non-interactive environments (`index.ts`)
- [x] **#23** Halt trading after N consecutive `saveRiskState` failures (`state-persistence.ts`)
- [x] **#24** Add app-level `.gitignore` for `risk-state.json` and `dist/`
- [x] **#25** Add try-catch around WebSocket `JSON.parse` in `onmessage` (`client.ts`)
- [x] **#26** Replace `slice-map-spread` patterns with index-based iteration in strategies
- [x] **#27** Replace `Array.shift()` with ring buffer in watchlist (`watchlist.ts`)
- [x] **#28** Add `import.meta.main` guard to `replay.ts`
- [x] **#29** Remove dead `getLatestBars` export (`market-data.ts`)
- [x] **#30** Fix tweezer pattern tolerance for doji bars (`candlestick/double.ts`)

---

## Questions for Clarification

1. Is the lack of a trading-hours guard on `closePosition`/`closeAllPositions` intentional for emergency closes?
2. Is `risk-state.json` intentionally written relative to the process working directory? Consider a configurable absolute path.
3. Is EMA/MACD cross-day continuity intentional, or should indicators reset at market open?
4. Does Alpaca auto-cancel bracket order legs when `closePosition` is called?
5. Is Polygon.io integration planned for accurate float data, or is `shares_outstanding` sufficient?
6. What Alpaca data subscription tier is being used — IEX (free) or SIP (paid)?
