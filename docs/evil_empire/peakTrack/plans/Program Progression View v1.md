---
title: Program Progression View v1
type: note
permalink: evil-empire/plans/program-progression-view-v1
---

# Program Progression View v1

## Goal
New route in PeakTrack mobile app: per-program, per-exercise progression view. Shows tile stack + volume trend across program sessions so the user can scan "am I getting stronger week over week?"

Anchor use case: Russian back squat 9-week program (`6 × 2 @80%` → `5 × 5 @85%` etc).

## Scope

### v1 (in)
- Route: `app/program-progression.tsx` with params `{ programId, exerciseName }`
- Entry point: "View progression" link per exercise row on `program-detail.tsx`
- Single program + single exercise
- Render types: linear sets, waves, compounds (same-exercise interpretation)
- Color: bright orange = performed ≥ prescribed; dark brown = below; dim = prescribed-but-missed
- Empty column handling via dim tiles on missed sets
- Unparseable prescribed `raw_input` → performed-only, bright
- Horizontal scroll with week / day / weight labels
- SVG volume trend line overlaid on column stacks (`react-native-svg`)
- Weight labels under wave columns; single label above uniform-weight sessions
- Legend strip at bottom

### v2 (deferred)
- Compound sets across different exercises (requires parser + schema changes)
- Top-set / PR shade
- Sparkline on program detail
- Pinch-zoom / animated chart transitions

## Resolved decisions
- **Identity**: scope to program, normalize exercise name via `lower(trim(name))`.
- **Entry point**: per-exercise `trending-up-outline` link on program-detail.tsx session row.
- **Route shape**: flat `app/program-progression.tsx`, no tab registration.
- **Color rule**: any shortfall (reps OR weight) → brown; extra sets beyond prescription → bright.
- **Missed sessions / sets**: dim tiles preserve the expected shape visually.
- **Unparseable prescription**: show performed only, bright, no deviation.
- **Volume math**: always use resolved kg (via `resolveWeightsFromSnapshot` for %). Program RM is source of truth.
- **Compound rendering**: full/faded shade split inside each column for the `+N` segment.

## Implementation steps
- [x] Install `react-native-svg` via `npx expo install react-native-svg`
- [x] Add `fetchProgramProgressionData(programId, exerciseName)` to `packages/peaktrack-services/src/programService.ts`
- [x] Build `buildSessionLayout` + normalization helpers in `apps/mobile/PeakTrack/lib/progressionLayout.ts`
- [x] Build `app/program-progression.tsx` screen (horizontal ScrollView, SVG polyline, per-column tile stacks, legend)
- [x] Register `program-progression` Stack.Screen in `app/_layout.tsx`
- [x] Wire entry link on program-detail session rows
- [x] Unit tests in `lib/__tests__/progressionLayout.test.ts` — 9 tests covering linear / below-prescription / % resolution / missed / partial / compound / wave / unparseable / performed-only
- [ ] Manual simulator verification (pending user)

## Files touched
- `packages/peaktrack-services/src/programService.ts` — added `fetchProgramProgressionData`, `ProgramProgressionData`, `ProgramProgressionSessionRow`
- `apps/mobile/PeakTrack/lib/progressionLayout.ts` — new
- `apps/mobile/PeakTrack/lib/__tests__/progressionLayout.test.ts` — new
- `apps/mobile/PeakTrack/app/program-progression.tsx` — new
- `apps/mobile/PeakTrack/app/_layout.tsx` — registered new screen
- `apps/mobile/PeakTrack/app/program-detail.tsx` — added per-exercise progression link + style
- `apps/mobile/PeakTrack/package.json` — added `react-native-svg`

## Verification
- `pnpm typecheck --force`: 11/11 successful
- `pnpm test`: 208/208 mobile tests pass + 9 new progressionLayout tests
- `pnpm lint`: no new warnings; pre-existing warnings unchanged
- `pnpm build --force`: 7/7 successful

## Notes
- Current program-detail.tsx renders only `s.exs[0]` per session (single exercise in plan-editor flow). Progression link will appear once per exercise when the UI surfaces multiple exercises per session.
- Weight resolution reuses `resolveWeightsFromSnapshot` so % prescriptions align with program RM snapshot.
- Fetch pattern is 4 sequential→parallel queries mirroring the existing `fetchProgramSessionsForDateRange` shape. Can move to nested select later if perf demands it.
