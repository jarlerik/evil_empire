# Simulation Tuning Lessons

Notes from backtesting the warrior trading scanner + strategy pipeline across multiple months (Oct 2025 - Mar 2026). Each section documents a parameter change, the reasoning, and the observed result.

---

## 1. Relative Volume (MIN_REL_VOLUME)

### 5.0x (original)
- **Result (Feb 2026):** 1-2 candidates across 19 days, 0 trades.
- **Problem:** 5x relative volume is extremely aggressive. Most stocks — even active momentum plays — trade at 1.5-3x normal volume. Only the most explosive movers hit 5x.

### 2.5x
- **Result (Feb 2026):** 3 candidates across 19 days, 0 trades. Slight improvement but still too restrictive.
- **Result (Mar 2026):** 5 candidates, 2 days with trades, 15 total trades. -$78 P&L.
- **Observation:** RVOL was still the main gatekeeper. On Mar 31, 8 gap candidates were found but all got rejected by RVOL (all below 2.5x).

### 1.5x (current)
- **Result (Nov 2025):** 6 candidates, 1 day with trades, 3 trades. +$404.64 (+1.62%). Both strategies profitable.
- **Result (6-month backtest):** 70/125 days with candidates, 17 days with trades, 75 total trades.
- **Key insight:** AAOI had 1.65x RVOL and was a legitimate momentum play that the 2.5x threshold killed. Dropping to 1.5x caught it.
- **Caveat:** The historical scanner uses full-day volume from the daily bar. A real-time scanner at 9:35am would see volume concentrated in the first few minutes, making RVOL appear much higher. The 1.5x threshold compensates for this historical data limitation.

---

## 2. Minimum Gap Percent (MIN_GAP_PCT)

### 5% (original)
- **Problem:** Combined with the $1-$20 price range and <20M float, very few stocks gap 5%+ on quiet market days.

### 3% (current)
- **Result:** Roughly doubled the number of gap candidates passing the initial filter. Many legitimate momentum stocks gap 3-5% rather than 5%+.
- **Trade-off:** More candidates to evaluate, slightly more noise, but the RVOL and strategy filters handle that.

---

## 3. Maximum Price (MAX_PRICE)

### $20 (original)
- **Problem:** Excluded stocks in the $20-$30 range that are still valid small/mid-cap momentum plays.

### $30 (current)
- **Result:** Caught additional candidates like ASMB ($27.99) and AAOI ($29.10).
- **Note:** Did not expand to $50 — wanted to stay focused on the small-cap momentum universe. $30 is a reasonable upper bound.

---

## 4. Maximum Float (MAX_FLOAT)

### 20M shares (unchanged)
- **Decision:** Kept at 20M. Low float is core to the Warrior Trading strategy — it's what creates explosive moves. Expanding to 50M would dilute signal quality by including more liquid stocks that don't move as sharply.

---

## 5. Loss Cooldown (COOLDOWN_BARS)

### None (original)
- **Problem:** ADMA on Mar 27 generated 14 trades in a single day. The algo would enter, get stopped out, immediately re-enter, get stopped out again — churning through capital.

### 15 bars (current)
- **Result:** ADMA trades dropped from 14 to 3 on the same date. Saved ~$250 in unnecessary losses.
- **Implementation:** After a losing trade, the risk manager blocks new entries for 15 bars (15 minutes). Resets each day.

---

## 6. Exit Parameters

### Tight exits (original/reverted to)
- Trailing stop: **1.5%**
- VWAP breakdown: after **2 bars**
- Time stop: **5 bars** (if not profitable)

### Relaxed exits (tested)
- Trailing stop: **3%**
- VWAP breakdown: after **5 bars**
- Time stop: **10 bars**

### Results comparison (6-month backtest, Oct 2025 - Mar 2026)

| Metric        | Tight exits | Relaxed exits |
|---------------|-------------|---------------|
| Total trades  | 75          | 64            |
| Win rate      | 41.3%       | 42.2%         |
| Total P&L     | -$2,208     | **-$3,148**   |
| ma-pullback   | +$9         | -$1,718       |
| flat-top      | -$2,194     | -$1,055       |
| micro-pullback| -$24        | -$375         |

- **Conclusion:** Relaxing exits made things worse. Letting losers run longer caused bigger losses. The tighter exits were actually protecting capital — cutting losses quickly even if they also cut some winners short.
- **Current status:** Reverted to tight exits. The problem is not exit timing — the strategies themselves may not have a strong enough edge on these stocks.

---

## 7. Strategy Performance (6-month, tight exits)

| Strategy       | P&L       | Notes                                    |
|----------------|-----------|------------------------------------------|
| ma-pullback    | +$9.49    | Breakeven. Most active strategy.         |
| micro-pullback | -$24.27   | Breakeven. Rarely triggers.              |
| flat-top       | -$2,193   | Big loser over 6 months despite looking good in single-month tests. |

- **Observation:** 41% win rate with 2:1 R:R should theoretically be profitable, but exits are cutting winners before they hit target.
- **Key finding:** flat-top looked great in isolated month tests (+$854 in March) but was the biggest loser over 6 months. Single-month results are misleading.

---

## 8. Infrastructure Improvements

### API Rate Limit Retry
- Added exponential backoff (1s, 2s, 4s, 8s, 16s) on HTTP 429 responses in `dataGet`.
- Respects `Retry-After` header if provided by Alpaca.
- **Impact:** Later simulation days no longer crash when hitting rate limits. Previously, days 20+ would fail with 429 errors.

### File-Based API Cache
- All `dataGet` responses cached to `.cache/alpaca/` as JSON files, keyed by SHA-256 hash of the full URL.
- **Impact:** Re-running the same date range is ~1s/day instead of ~20s/day.
- **Limitation:** Cache is per-URL, so different date ranges generate different cache keys even for overlapping data.

### In-Memory Symbol Cache
- `getTradeableSymbols()` result cached in memory for the process lifetime.
- **Impact:** Saves ~3s per simulated day after the first call (was hitting Alpaca SDK on every day).

---

## 9. Open Questions

- **Strategy edge:** The core strategies (flat-top, ma-pullback, micro-pullback) are net negative or breakeven over 6 months. Is this a parameter tuning problem, or do these patterns not have a reliable edge on low-float momentum stocks with 1-minute bars?
- **Exit logic:** The 41% win rate suggests entries are decent but exits need work. Possible directions: ATR-based trailing stops (instead of fixed %), partial profit-taking at 1R, or time-of-day-aware exits.
- **Historical RVOL bias:** The scanner uses end-of-day volume which understates morning RVOL. A more accurate approach would compute RVOL from intraday bars up to scan time, but that requires fetching 1-min bars for all ~12k symbols (expensive).
- **Data feed:** Using IEX (free tier) which has lower volume than SIP. This may affect RVOL calculations and price accuracy. SIP subscription could improve results.
