---
title: Progression Stat Cards (Weekly / Monthly Volume Δ)
type: note
permalink: evil-empire/plans/progression-stat-cards
---

# Progression Stat Cards — Weekly / Monthly Volume Δ

## Goal

Add a row of `StatCard`s at the top of the progression screens that surface a quick "am I trending up?" read before the user scans the chart:

- **7d Volume** — kg performed in the last 7 days, with `±x%` vs. the prior 7-day window
- **30d Volume** — kg performed in the last 30 days, with `±x%` vs. the prior 30-day window
- **(optional)** **Total Volume** — sum across all logs in view (no trend)

Visual reference: the dark-mode StatCard row from the user's screenshot. Cards reuse `StatCard` from [@evil-empire/ui](apps/evil_ui/src/components/stat-card/StatCard.tsx).

## Scope

### In
- New shared util `apps/mobile/PeakTrack/lib/volumeStats.ts` that computes rolling-window volume + delta from a list of `{ date, volume }` points.
- Tweak `StatCard` to color `trend` by sign (green for `+`, red for `-`, muted for `0`/no-change). Backwards compatible: existing `trend="+12%"` callers stay green.
- Wire a `StatCardRow` (3-up, equal width, horizontal scroll fallback on small screens) into:
  - [app/program-progression.tsx](apps/mobile/PeakTrack/app/program-progression.tsx) — driven by `SessionLayout.performedVolume` + the session's executed date
  - [app/exercise-progression.tsx](apps/mobile/PeakTrack/app/exercise-progression.tsx) — driven by `ExerciseProgressionRow.log` (volume) + `workoutDate`
- Unit tests for `volumeStats.ts` (window math, edge cases, sign formatting).
- Showcase entry in `apps/evil_ui/showcase/App.tsx` and demo in `apps/evil_ui/expo-demo/App.tsx` for the updated `StatCard`.

### Out (explicit)
- New StatCard primitive variants (icons, sparklines) — keep current API.
- Calendar week / calendar month windows (we chose **rolling**).
- Set-count or session-count cards — volume only for v1.
- Per-program-week or per-microcycle aggregation (sessions are still rendered chronologically by the existing layout; cards are time-window based).

## Resolved decisions

- **Window**: rolling 7d and 30d, anchored on `now()` at screen mount. Comparison window is the immediately preceding 7d / 30d block (i.e. days `-14..-7` and `-60..-30`).
- **Volume definition**: same kg formula already used by the chart — `Σ reps × weight` over performed sets. Reuse `volumeOf(NormalizedSpec)` from [progressionLayoutCore.ts:115](apps/mobile/PeakTrack/lib/progressionLayoutCore.ts:115). For exercise-progression we already have per-log `sets/reps/weight/weights/compound_reps` → normalize via `normalizePerformed` then call `volumeOf`.
- **Bodyweight / RIR / unparseable sets**: contribute `0` to volume (consistent with current chart behavior — no estimation, no surprises).
- **Empty/new-user states**: when the prior window has `0` volume, render `trend="—"` (em dash) instead of `+∞%` or `+100%`. When the current window is also `0`, value renders as `0 kg` and trend is `—`.
- **Unit**: read `weight_unit` from `useUserSettings()` and suffix the value (`"1,240 kg"` or `"1,240 lbs"`). DB stores unitless decimals — no conversion needed. See [known-caveats.md → "Weight unit is global, not per-row"](docs/evil_empire/peakTrack/known-caveats.md) for the full assumption (mid-history unit flips are out of scope).
- **Rounding**: value rounded to nearest 1 kg. Trend rounded to nearest 1%.
- **Sign convention**: `+x%` for increase, `-x%` for decrease, `0%` for no change. Color: green / red / `text-secondary`.

## Implementation

### Step 1 — `StatCard` trend direction (apps/evil_ui)

File: [apps/evil_ui/src/components/stat-card/StatCard.tsx](apps/evil_ui/src/components/stat-card/StatCard.tsx)

- Add optional `trendDirection?: 'up' | 'down' | 'neutral'` prop.
- If omitted, infer from leading char of `trend` (`+` → up, `-` → down, else neutral).
- Map: `up → colors.success`, `down → colors.danger` (add token if missing), `neutral → colors['text-secondary']`.
- Snapshot test in `apps/evil_ui/src/components/stat-card/__tests__/StatCard.test.tsx` covering all three cases.

### Step 2 — Pure volume-stats util

New file: `apps/mobile/PeakTrack/lib/volumeStats.ts`

```ts
export interface VolumePoint { date: string; volume: number; } // YYYY-MM-DD, kg
export interface WindowStat {
  volume: number;          // current window total
  previousVolume: number;  // prior window total
  deltaPct: number | null; // null when previousVolume === 0
}
export function rollingWindowStat(points: VolumePoint[], days: number, now?: Date): WindowStat;
export function formatVolume(value: number, unit: 'kg' | 'lbs'): string; // "1,240 kg" | "1,240 lbs"
export function formatTrend(deltaPct: number | null): { label: string; direction: 'up'|'down'|'neutral' };
```

Edge cases the tests must lock in:
- `previousVolume === 0` → `deltaPct = null`, label `"—"`, direction `neutral`
- `currentVolume === 0` → still computes, may yield negative delta (e.g. `-100%`)
- Inclusive lower bound, exclusive upper bound: a log at exactly `now - 7d` falls in the **previous** window
- Date-only strings (YYYY-MM-DD) are treated as local-midnight; no timezone drift across DST

### Step 3 — Wire into program-progression

File: [app/program-progression.tsx](apps/mobile/PeakTrack/app/program-progression.tsx)

- Build a `VolumePoint[]` from `SessionLayout` rows where `performedVolume != null` and the matching `ProgramProgressionSessionRow.performedLog.executed_at` exists. Use `executed_at`'s local date.
- Compute 7d + 30d via `rollingWindowStat`.
- Render `<StatCardRow>` immediately above the existing tile-stack scroll view; collapse to single-row horizontal scroll on narrow viewports.

### Step 4 — Wire into exercise-progression

File: [app/exercise-progression.tsx](apps/mobile/PeakTrack/app/exercise-progression.tsx)

- For each `ExerciseProgressionRow`, derive volume by passing the row's `log` through `normalizePerformed` (same path the chart already uses) and calling `volumeOf`. Use `workoutDate` as the bucket date.
- Reuse the same `<StatCardRow>` component — extract to `apps/mobile/PeakTrack/components/StatCardRow.tsx` so both screens share the layout.

### Step 5 — Tests

- `apps/mobile/PeakTrack/lib/__tests__/volumeStats.test.ts` (window math, formatting, edge cases — aim for ~12 cases)
- `apps/mobile/PeakTrack/components/__tests__/StatCardRow.test.tsx` (renders 3 cards, propagates trend direction)
- Update `apps/evil_ui/src/components/stat-card/__tests__/StatCard.test.tsx`

### Step 6 — Showcase / demo

- Add a "Stats" section to `apps/evil_ui/showcase/App.tsx` and `apps/evil_ui/expo-demo/App.tsx` showing all three trend directions.

## Acceptance

- [ ] `StatCard` renders `+12%` green, `-12%` red, `—` muted; existing call sites unchanged.
- [ ] Both progression screens show a 3-card row with correct kg + sign + color.
- [ ] New-user case (no logs in prior 7d) renders `—`, never `Infinity%` or `NaN`.
- [ ] `pnpm test --filter=@evil-empire/ui --filter=@evil-empire/mobile` green.
- [ ] `pnpm typecheck` and `pnpm lint` clean.
- [ ] Manual: open program-progression for the Russian back-squat program, verify the 30d card matches a hand-summed volume.

## Risks / open questions

- **Timezone**: `executed_at` is UTC. If a user trains 23:00 local, naive UTC bucketing can land it on the next day. v1 uses local date via `new Date(executedAt).toLocaleDateString('en-CA')` (en-CA gives YYYY-MM-DD). Document this in the util.
- **Volume parity**: confirm `volumeOf(normalizePerformed(log))` matches the value already shown in the chart — they should, since the chart uses the same path.
- **Unit flips**: see [known-caveats.md](docs/evil_empire/peakTrack/known-caveats.md). Out of scope here.

## Review (filled after implementation)

_TBD._
