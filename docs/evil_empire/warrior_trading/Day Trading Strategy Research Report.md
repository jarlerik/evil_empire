---
title: Day Trading Strategy Research Report
type: note
permalink: evil-empire/plans/day-trading-strategy-research-report
tags:
- warrior-trading
- backtesting
- strategies
- day-trading
- small-cap
---


## Overview

Research report on well-known intraday momentum strategies for small-cap/low-float stocks, optimal parameters, and risk management techniques. Focused on strategies suitable for backtesting on 1-minute bars with gap-up stocks ($1-$30, float < 20M).

---

## PART 1: NEW STRATEGIES TO IMPLEMENT

### Strategy 1: VWAP Reclaim

**Concept:** Stock gaps up, sells off below VWAP, then reclaims VWAP from below. The reclaim triggers short-covering and FOMO buying, creating a sharp rally back toward high of day.

**Entry Conditions:**
- Stock must have gapped up 3%+ with catalyst
- Price drops below VWAP after the open
- Price crosses back ABOVE VWAP with a confirming green candle that closes above VWAP
- Volume on the reclaim candle should be above average (RVOL > 1.5)
- Ideally happens within the first 60-90 minutes

**Stop Loss:**
- Below the low of the consolidation under VWAP (the double bottom area)
- Or fixed: $0.10-0.20 below VWAP at the time of entry
- ATR-based: 1.5x ATR below entry

**Targets:**
- Target 1: High of Day (HOD) -- the stock already proved it can reach there
- Target 2: If HOD breaks, trail the stop
- Typical R:R of 2:1 to 3:1

**Parameterization:**
- New strategy enum: `vwap-reclaim`
- Requires VWAP calculation (cumulative price*volume / cumulative volume)
- Parameters: VWAP_RECLAIM_BARS_BELOW (min bars below VWAP before reclaim counts, suggest 5-15)
- Parameters: VWAP_RECLAIM_CONFIRM_BARS (bars above VWAP to confirm, suggest 1-2)
- Works with existing: TRAILING_STOP_PCT, TIME_STOP_BARS, FIRST_HOUR_ONLY, RR_RATIO

---

### Strategy 2: Opening Range Breakout (ORB)

**Concept:** Define a price range during the first N minutes of trading. Trade the breakout when price exceeds the range high. Research shows shorter opening ranges (1-5 minutes) perform better in the algorithmic era.

**Entry Conditions:**
- Define opening range as high/low of first N bars (1, 3, or 5 minutes)
- Enter long when price closes above the opening range high
- Volume confirmation: current bar volume > 1.5x average of opening range bars
- Price should be above VWAP for additional confirmation

**Stop Loss:**
- Conservative: Below the opening range low
- Moderate: At the 50% level of the opening range (midpoint)
- Aggressive: Below the opening range high (the breakout level)

**Targets:**
- Target = opening range height added to breakout level (measured move)
- Or use R:R ratio of 2:1 minimum

**Parameterization:**
- New strategy enum: `orb`
- Parameters: ORB_RANGE_BARS (number of bars to define opening range, suggest 1-5)
- Parameters: ORB_STOP_LEVEL (low, mid, breakout -- where to place stop)
- Works with existing: TRAILING_STOP_PCT, RR_RATIO, FIRST_HOUR_ONLY, MAX_HOLD_BARS

---

### Strategy 3: Red-to-Green Move

**Concept:** Stock gapped up in premarket but opens slightly red (below previous close), then reverses to green. The cross from red-to-green signals aggressive buyer interest. Powerful on low-float stocks where 10%+ of float traded pre-market.

**Entry Conditions:**
- Stock had significant gap-up but opened slightly below previous close (red)
- Opening loss ideally less than 1-1.5% from previous close
- Price crosses ABOVE previous close (the green level)
- Volume surge on the crossover candle

**Stop Loss:**
- Below the session low (lowest point while stock was red)

**Targets:**
- Target 1: Pre-market high
- Target 2: Gap-up high

**Parameterization:**
- New strategy enum: `red-to-green`
- Parameters: R2G_MAX_RED_PCT (maximum % the stock can be red, suggest 1-2%)
- Works with existing: TRAILING_STOP_PCT, RR_RATIO, FIRST_HOUR_ONLY

---

### Strategy 4: ABCD Pattern

**Concept:** Classic harmonic pattern from Andrew Aziz / Bear Bull Traders. Stock makes initial move up (A to B), pulls back (B to C, retracing 38.2-61.8% of AB), then breaks out again (C to D). The CD leg typically equals the AB leg.

**Entry Conditions:**
- AB leg: Strong upward move with volume
- BC leg: Pullback that retraces 38.2% to 61.8% of the AB move
- Point C must be HIGHER than Point A (higher low)
- Enter near Point C when price starts moving up again
- Volume should decrease on BC pullback and increase on CD breakout
- Each leg typically lasts 3-13 bars on 1-minute charts

**Stop Loss:**
- Below Point C

**Targets:**
- Target 1: Point B level (retest of high)
- Target 2: AB leg length projected from C (measured move D = C + (B - A))

**Parameterization:**
- New strategy enum: `abcd-pattern`
- Parameters: ABCD_MIN_RETRACE (min BC retracement, suggest 0.382)
- Parameters: ABCD_MAX_RETRACE (max BC retracement, suggest 0.618)
- Parameters: ABCD_MIN_LEG_BARS (minimum bars per leg, suggest 3)
- Parameters: ABCD_MAX_LEG_BARS (maximum bars per leg, suggest 13)

---

### Strategy 5: VWAP Bounce (Support Test)

**Concept:** Stock trending above VWAP pulls back TO VWAP and bounces off it as support. Different from VWAP Reclaim -- here the stock never loses VWAP, it just tests it.

**Entry Conditions:**
- Stock is trading above VWAP (bullish trend)
- Price pulls back toward VWAP (within 0.3-0.5%)
- A green candle forms at or near VWAP (the bounce)
- Volume decreasing on pullback, increasing on bounce

**Stop Loss:**
- Just below VWAP ($0.10-0.20 below, or 0.5% below)

**Targets:**
- Target: Retest of high of day
- For stocks under $20: approximately 10% move from VWAP

**Parameterization:**
- New strategy enum: `vwap-bounce`
- Parameters: VWAP_BOUNCE_PROXIMITY_PCT (how close to VWAP, suggest 0.3-0.5%)
- Parameters: VWAP_BOUNCE_MIN_ABOVE_BARS (min bars above VWAP before pullback, suggest 10-20)

---

### Strategy 6: Washout Long (Panic Reversal)

**Concept:** Stock trending up suddenly drops sharply (panic selling / stop-loss cascade). The sharp drop washes out weak holders. Algorithmic correction creates V-shaped bounce.

**Entry Conditions:**
- Stock has been trending up (above VWAP, making higher highs)
- Sudden sharp drop: 3-5%+ within 1-3 bars
- Volume spike on the drop (panic selling)
- Quick reversal: price recovers 50%+ of the drop within 2-3 bars

**Stop Loss:**
- Below the washout low (the panic bottom)

**Targets:**
- Target 1: Pre-washout high
- Target 2: New high of day

**Parameterization:**
- New strategy enum: `washout-long`
- Parameters: WASHOUT_DROP_PCT (minimum drop %, suggest 3-5%)
- Parameters: WASHOUT_DROP_BARS (max bars for the drop, suggest 1-3)
- Parameters: WASHOUT_RECOVERY_PCT (min recovery % of drop, suggest 50%)

---

## PART 2: OPTIMAL PARAMETER RANGES

### Risk Per Trade
- Professional consensus: 1-2% per trade
- Kelly Criterion research: 2% provides +95% returns with -24.6% max drawdown
- Most professionals use fractional Kelly (quarter to half)
- Current 1.0% is solid. Test: 0.5%, 0.75%, 1.0%, 1.25%, 1.5%

### Trailing Stop
- Academic research: 15-25% for swing trading (too wide for intraday)
- Day trading small caps: 4-8% trailing is reasonable
- ATR-based trailing reduces max drawdown by 32% vs fixed
- Current 6% is reasonable. Test: 4%, 5%, 6%, 7%, 8%
- Also test ATR-based: 1.5x, 2.0x, 2.5x ATR

### ATR Trailing Stop Multiplier
- Day trading optimal: 1.5-2.0x ATR
- 2x ATR works well for momentum stocks
- ATR adapts to volatility (superior to fixed % on $2-$25 range)
- Recommend enabling: test 1.5x, 2.0x, 2.5x

### Time Stop
- Momentum should resolve within 10-15 minutes
- Winning trades show profit within 5-10 bars
- Current 15 is reasonable. Test: 10, 12, 15, 20

### Cooldown
- Professional practice: 10-30 minutes after a loss
- Current 10 bars aligns with professional practice
- Test: 5, 10, 15, 20

### Max Consecutive Losses
- Professional standard: 3 consecutive losses = stop for the day
- Equals ~3% of capital at 1% risk per trade
- Never lose more than 3% in a single day
- Recommend: 3

### First Hour Only
- Best trading: 9:30-11:30 AM
- Afternoon trading is often unprofitable for momentum
- Current 9:30-11:00 is optimal. Could test extending to 11:30

### R:R Ratio
- Minimum 2:1 ensures profitability at 40% win rate
- 3:1 ideal but fewer fills
- Recommend 2.0 default. Test: 1.5, 2.0, 2.5, 3.0

### Max Hold Bars
- Momentum on 1-min bars should resolve within 30-60 minutes
- Recommend: 30-60 bars. Test: 20, 30, 45, 60

---

## PART 3: EXISTING STRATEGY IMPROVEMENTS

### Gap and Go
- Add VWAP confirmation (price above VWAP on breakout)
- Add relative volume filter (RVOL > 2.0)
- Best in first 30 minutes
- Tighter stops: use pre-market high as stop reference

### Moving Average Pullback (current best)
- Add volume confirmation: volume decrease on pullback, increase on bounce
- Add VWAP as additional support confirmation
- EMA 9 is most important for 1-minute momentum

### Bull Flag
- Flagpole should have RVOL > 2.0
- Consolidation should be 3-7 bars
- Volume should contract 50%+ during flag
- Breakout volume should exceed flagpole volume

### Flat Top Breakout
- Minimum 3 resistance touches
- Each touch within $0.05 of each other
- Volume should build on each test (ascending volume)

### Micro Pullback
- Red candle range < 25% of previous green candle
- Volume on red candle < 50% of surge candle
- Enter on next green candle
- Very tight stop: below red candle low

---

## PART 4: IMPLEMENTATION PRIORITY

1. **VWAP Reclaim** -- High priority. Simple, well-documented.
2. **Opening Range Breakout** -- High priority. Clean objective rules.
3. **Red-to-Green** -- Medium priority. Simple but less frequent on gap-ups.
4. **ABCD Pattern** -- Medium priority. Complex but high win rate.
5. **VWAP Bounce** -- Medium priority. Good complement to VWAP Reclaim.
6. **Washout Long** -- Lower priority. Harder to backtest accurately.
