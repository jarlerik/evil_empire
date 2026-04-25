# Daily Log 08.04.2026

## Warrior Trading - Production scripts and dashboard improvements

Added production-ready `start` script that builds the dashboard and runs the trading engine in one command. Created standalone `scan.ts` CLI for running the pre-market scanner independently (live or historical mode). Dashboard server now caches state events so clients connecting mid-session immediately see current scanner results, session phase, and risk metrics.

## Warrior Trading - Multi-sim prefetch bug fix and new backtests

Fixed a data divergence bug in `multi-sim.ts` where the `prefetchAllDailyBars` bulk-fetch path produced different scanner results (52 days with candidates) than the per-day path used by `simulation.ts` (31 days). The prefetch generated phantom candidates, inflating trade counts and distorting results. Removed prefetch in favor of the per-day scanner path — results now match exactly.

Added `MIN_STOP_DISTANCE` config option to reject signals with stops too close to entry (addresses the low realized R:R issue seen on AAPD). Ran new backtests across Jan-Apr 2026 testing min stop distance variants and strategy comparisons. Confirmed ma-pullback remains the only profitable strategy; previous R5A-BEST config recommendation still holds.
