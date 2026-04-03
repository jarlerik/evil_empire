# Warrior Trading Bot — Test Plan

**Target**: Issue #18 from REVIEW.md — add test infrastructure and unit tests for critical paths
**Framework**: `bun:test` (built-in, zero dependencies)
**Convention**: `__tests__/` directories adjacent to source modules

---

## 1. Test Infrastructure Setup

Add to `package.json`:
```json
"scripts": {
  "test": "bun test",
  "test:watch": "bun test --watch"
}
```

Create `__tests__/` directories mirroring source structure:
```
src/
├── __tests__/
│   └── config.test.ts
├── risk/__tests__/
│   ├── position-sizer.test.ts
│   ├── risk-manager.test.ts
│   └── state-persistence.test.ts
├── indicators/__tests__/
│   ├── ema.test.ts
│   ├── vwap.test.ts
│   ├── macd.test.ts
│   ├── atr.test.ts
│   ├── relative-volume.test.ts
│   └── candlestick.test.ts
├── strategies/__tests__/
│   ├── gap-and-go.test.ts
│   ├── bull-flag.test.ts
│   ├── flat-top.test.ts
│   ├── ma-pullback.test.ts
│   └── micro-pullback.test.ts
├── scanner/__tests__/
│   ├── gap-scanner.test.ts
│   └── float-filter.test.ts
├── engine/__tests__/
│   ├── session-timer.test.ts
│   ├── watchlist.test.ts
│   └── trader.test.ts
└── alpaca/__tests__/
    ├── orders.test.ts
    └── market-data.test.ts
```

---

## 2. Priority 1 — Risk Module (financial-critical math)

### `position-sizer.test.ts`
| Test Case | Input | Expected |
|---|---|---|
| Basic sizing | equity=25000, risk=1.5%, stop=$0.50 | 750 shares |
| Position value capped to equity | equity=10000, risk=5%, stop=$0.01 | capped to equity/price |
| Zero stop distance | stopDistance=0 | throws or returns 0 |
| Very large equity | equity=1M, risk=1.5%, stop=$0.10 | 150,000 shares |
| Fractional shares rounded down | result is non-integer | floor to whole shares |

### `risk-manager.test.ts`
| Test Case | Expected |
|---|---|
| Approves valid signal (R:R >= 2, within limits) | `{ approved: true }` |
| Rejects R:R below minimum (e.g. 1.5:1) | `{ approved: false, reason: "R:R too low" }` |
| Rejects when daily loss limit hit | halted after cumulative loss >= 10% equity |
| Rejects after 3 consecutive losses | halted after `maxConsecLosses` |
| Rejects when position already open | single position rule |
| Resets on new trading day | daily counters clear |
| `onTradeCompleted` updates win/loss tracking | state reflects P&L |

### `state-persistence.test.ts`
| Test Case | Expected |
|---|---|
| Save + load round-trip | identical state |
| Load with missing file | returns fresh default state |
| Load with corrupted JSON | returns fresh default state (doesn't crash) |
| Load with NaN/Infinity fields | rejected by validator, returns default |
| Load with wrong date | resets to default (new day) |
| Atomic write survives (temp file written) | file not corrupted |

---

## 3. Priority 2 — Indicators (pure math, no I/O)

### `ema.test.ts`
| Test Case | Expected |
|---|---|
| First value = input (priming) | EMA seeded correctly |
| Known sequence (period=9) | matches hand-calculated values |
| Multi-EMA update (9,20,50,200) | all four periods computed |
| Priming with < period bars | partial state, no NaN |

### `vwap.test.ts`
| Test Case | Expected |
|---|---|
| Single bar | VWAP = typical price |
| Multiple bars | cumulative VWAP formula verified |
| Reset on new session | clears accumulated state |
| Zero volume bar | handled without division by zero |

### `macd.test.ts`
| Test Case | Expected |
|---|---|
| After 26+ bars | MACD, signal, histogram all finite |
| Histogram sign matches momentum direction | positive when fast > slow |
| Known price series | matches reference values |

### `atr.test.ts`
| Test Case | Expected |
|---|---|
| After 14 bars | ATR is finite and positive |
| Gap-up bar (high > prev close) | true range accounts for gap |
| Flat market | ATR near zero |

### `candlestick.test.ts`
| Test Case | Expected |
|---|---|
| Hammer: long lower wick, small body, top of range | detected |
| Doji: open = close | detected |
| Bullish engulfing: bearish then larger bullish | detected |
| Morning star: bear, doji, bull | detected |
| Tweezer on doji bar (issue #30) | tolerance handles zero range |
| Non-pattern bars | returns empty/null |

---

## 4. Priority 3 — Strategies (signal generation logic)

For each strategy, build helper functions to create mock `IndicatorSnapshot` objects with controlled values.

### Common test cases per strategy
| Test Case | Expected |
|---|---|
| Textbook setup generates signal | non-null signal with correct entry/stop/target |
| Missing prerequisite (e.g. price below VWAP) | returns null |
| Insufficient bars (< minimum lookback) | returns null |
| Confidence calculation | base + bonuses sum correctly |
| Stop and target produce R:R >= 2 | always |

### Strategy-specific
| Strategy | Key Scenario |
|---|---|
| Gap-and-Go | Breakout above premarket high on volume spike |
| Bull-Flag | 3-7 bar consolidation with lower highs after strong move |
| Flat-Top | 2+ touches of resistance, breakout bar |
| MA-Pullback | Bounce off EMA9/20 in uptrend |
| Micro-Pullback | Tiny red bar after large green surge |

---

## 5. Priority 4 — Engine (integration-style, needs mocking)

### `session-timer.test.ts`
| Test Case | Expected |
|---|---|
| 9:00 ET = pre-market phase | correct phase detection |
| 9:30 ET = open phase | phase transition fires |
| 11:00 ET = midday phase | `isTradingAllowed()` = true |
| 15:45 ET = close phase | `shouldFlattenPositions()` = true |
| 16:00 ET = after-hours | `isTradingAllowed()` = false |
| Weekend = closed | correct detection |
| Async listener error in emit | caught, logged, doesn't crash |

### `watchlist.test.ts`
| Test Case | Expected |
|---|---|
| handleBar updates ring buffer | bars stored in order, max 50 |
| Ring buffer overflow | oldest bar evicted |
| Indicators updated on each bar | EMA/VWAP/MACD/ATR values change |
| onBar callback fires with snapshot | callback receives correct data |
| Premarket high tracked | highest bar.high before market open |

### `trader.test.ts` (mock Alpaca client)
| Test Case | Expected |
|---|---|
| `executionInProgress` prevents duplicate orders | second signal blocked |
| `monitorPosition` only fires for matching symbol | wrong symbol ignored |
| Trailing stop triggers close | price drops > 1.5% from high |
| Time stop triggers close | no progress after 5 bars |
| VWAP breakdown triggers close | price crosses below VWAP |
| `flattenPositions` called at market close | all positions closed |
| `openPosition` nulled only after `onTradeCompleted` | TOCTOU fix verified |

---

## 6. Priority 5 — Scanner & Alpaca (mock HTTP/WebSocket)

### `gap-scanner.test.ts`
| Test Case | Expected |
|---|---|
| Stock with 10% gap, in price range | included |
| Stock with 3% gap (below min) | excluded |
| Stock priced at $50 (above max) | excluded |
| Batch pagination | all symbols processed |

### `float-filter.test.ts`
| Test Case | Expected |
|---|---|
| Float 5M shares | passes filter |
| Float 50M shares | excluded |
| API error for one symbol | skipped, others continue |

### `orders.test.ts`
| Test Case | Expected |
|---|---|
| `placeBracketOrder` sends correct legs | TP and SL attached |
| `waitForFill` timeout after 30s | throws/returns error |
| `assertTradingHours` blocks outside market hours | order rejected |
| `normalizeOrder` handles typed response | fields mapped correctly |

### `config.test.ts`
| Test Case | Expected |
|---|---|
| Valid env vars | config object populated correctly |
| Missing required `ALPACA_KEY_ID` | throws |
| `ALPACA_PAPER=ture` (typo) | throws (issue #8 fix) |
| Defaults applied for optional vars | correct default values |

---

## 7. Test Helpers & Fixtures

Create `src/__tests__/helpers/`:
- **`fixtures.ts`** — Factory functions for `Bar`, `IndicatorSnapshot`, `StrategySignal`, `WatchlistEntry`
- **`mock-alpaca.ts`** — Mock Alpaca REST client (returns canned responses for `getAccount`, `getAssets`, `getBars`)
- **`mock-websocket.ts`** — Mock WebSocket that emits controlled bar messages
- **`time.ts`** — Helper to freeze/set time for session timer tests

---

## 8. Execution Order

1. **Risk module** — highest financial impact, pure logic, easiest to test
2. **Indicators** — pure math, no dependencies, fast
3. **Strategies** — depend on indicator types but testable with mock snapshots
4. **Config** — validate env parsing edge cases
5. **Engine** — integration tests, require mocking Alpaca
6. **Scanner/Alpaca** — HTTP mocking, lower priority

---

## 9. Coverage Targets

| Module | Target | Rationale |
|---|---|---|
| `risk/` | 100% branch | Financial safety — every rejection path must be tested |
| `indicators/` | 95%+ line | Math correctness, edge cases (zero, NaN) |
| `strategies/` | 90%+ line | Signal generation and all rejection conditions |
| `engine/` | 80%+ line | Integration logic, harder to fully mock |
| `scanner/` | 70%+ line | I/O heavy, focus on filtering logic |
| `alpaca/` | 60%+ line | Thin wrappers, mock boundaries |

---

## 10. Task List

### Infrastructure
- [ ] Add `test` and `test:watch` scripts to `package.json`
- [ ] Create `src/__tests__/helpers/fixtures.ts` — factory functions for `Bar`, `IndicatorSnapshot`, `StrategySignal`, `WatchlistEntry`
- [ ] Create `src/__tests__/helpers/mock-alpaca.ts` — mock Alpaca REST client
- [ ] Create `src/__tests__/helpers/mock-websocket.ts` — mock WebSocket
- [ ] Create `src/__tests__/helpers/time.ts` — time freeze/set helpers

### Priority 1 — Risk Module
- [ ] Write `src/risk/__tests__/position-sizer.test.ts` (5 cases)
- [ ] Write `src/risk/__tests__/risk-manager.test.ts` (7 cases)
- [ ] Write `src/risk/__tests__/state-persistence.test.ts` (6 cases)

### Priority 2 — Indicators
- [ ] Write `src/indicators/__tests__/ema.test.ts` (4 cases)
- [ ] Write `src/indicators/__tests__/vwap.test.ts` (4 cases)
- [ ] Write `src/indicators/__tests__/macd.test.ts` (3 cases)
- [ ] Write `src/indicators/__tests__/atr.test.ts` (3 cases)
- [ ] Write `src/indicators/__tests__/relative-volume.test.ts`
- [ ] Write `src/indicators/__tests__/candlestick.test.ts` (6 cases)

### Priority 3 — Strategies
- [ ] Write `src/strategies/__tests__/gap-and-go.test.ts`
- [ ] Write `src/strategies/__tests__/bull-flag.test.ts`
- [ ] Write `src/strategies/__tests__/flat-top.test.ts`
- [ ] Write `src/strategies/__tests__/ma-pullback.test.ts`
- [ ] Write `src/strategies/__tests__/micro-pullback.test.ts`

### Priority 4 — Engine
- [ ] Write `src/engine/__tests__/session-timer.test.ts` (7 cases)
- [ ] Write `src/engine/__tests__/watchlist.test.ts` (5 cases)
- [ ] Write `src/engine/__tests__/trader.test.ts` (7 cases)

### Priority 5 — Scanner & Alpaca
- [ ] Write `src/scanner/__tests__/gap-scanner.test.ts` (4 cases)
- [ ] Write `src/scanner/__tests__/float-filter.test.ts` (3 cases)
- [ ] Write `src/alpaca/__tests__/orders.test.ts` (4 cases)
- [ ] Write `src/alpaca/__tests__/market-data.test.ts`
- [ ] Write `src/__tests__/config.test.ts` (4 cases)
