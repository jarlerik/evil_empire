# Shareable Progress Image (Strava-style)

## Context

Strava generates a shareable image with route + stats that users post to social media — a powerful organic growth loop. PeakTrack should offer the same: tap "share" on an exercise's progression view and get a **1080×1920 PNG with transparent background** showing volume tiles, the volume trend line, recent volume stat cards, and a hero 1-rep-max badge. Transparent background means the user can drop it directly into an Instagram Story over their own backdrop.

Everything needed already exists in the app — the exercise-progression screen renders the tiles + chart + stat cards, and `lookupExactRm` returns the latest 1RM. The work is (1) extracting the tile/chart renderer so it can be reused at a much larger scale, (2) composing a fixed off-screen 1080×1920 layout, (3) capturing it as a transparent PNG, and (4) handing the PNG to the native share sheet.

## Approach

### Decisions (locked with the user)

| Decision            | Choice                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| Entry points        | Both: header button on `exercise-progression` + per-row button on `repetition-maximums` |
| Image size          | 1080×1920 (9:16 Instagram Story)                                                        |
| 1RM display         | Hero badge with latest 1-rep max + date (hidden if user has no 1RM logged)              |
| Capture composition | Dedicated off-screen layout (not the live screen)                                       |
| Background          | Transparent PNG                                                                         |

### Architecture

1. **Extract tile/chart rendering** — `SessionStack`, `layoutGeometry`, `intrinsicSessionWidth`, `maxStackHeightTiles`, `tileBackground`, and the SVG trend line currently live inline in `app/exercise-progression.tsx`. Move into a new shared component `components/VolumeTiles.tsx` with dimensions (`tileSize`, `tileGap`, `columnGap`, `setColumnGap`, `minSessionWidth`, `trendHeight`) parameterized as props. Defaults preserve the current on-screen look; the shareable card passes large values (`tileSize: 36`, `trendHeight: 360`, etc.).

2. **Shareable card** — new component composing the wordmark, exercise title, 1RM hero badge, `StatCard` pair (7d/30d volume), `<VolumeTiles>` at large dimensions, and a footer "peaktrack.app" wordmark. Wrapping `View` has `backgroundColor: 'transparent'` and no opaque ancestors.

3. **Off-screen mount + capture** — share button press toggles `capturing=true`, which mounts the card in a sibling `View` styled `{ position: 'absolute', left: -100000, top: 0, width: 1080, height: 1920, pointerEvents: 'none' }` with `collapsable={false}` (Android requirement for `captureRef`). After `onLayout` + one `requestAnimationFrame`, call `captureRef(ref, { format: 'png', result: 'tmpfile', width: 1080, height: 1920 })`. Then `Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' })`. Unmount on completion or error.

4. **From the RMs list** — the row-level share button only knows `exerciseName`, so the hook itself calls `fetchExerciseProgressionData` + `lookupExactRm` on demand. From the progression screen, the hook reuses the already-loaded layouts and only fetches the 1RM.

5. **Tile cap** — cap visible sessions in the shareable card to the most recent 12 so the 1080-wide canvas isn't overflowed.

## Files

### New
- `apps/mobile/PeakTrack/components/VolumeTiles.tsx` — shared tiles + SVG trend renderer; parameterized dimensions; exports `VolumeTiles`, `layoutGeometry`, `intrinsicSessionWidth`, `tileBackground`.
- `apps/mobile/PeakTrack/components/share/ShareableExerciseCard.tsx` — 1080×1920 transparent layout (wordmark, title, 1RM badge, stat cards, `<VolumeTiles>`, footer).
- `apps/mobile/PeakTrack/components/share/ShareButton.tsx` — small `Pressable` with `Ionicons` share icon used at both entry points.
- `apps/mobile/PeakTrack/hooks/useShareExerciseImage.ts` — orchestrates 1RM fetch (and progression fetch when called from RMs list), off-screen mount, `captureRef`, and `Sharing.shareAsync`. Returns `{ share(exerciseName, prefetchedLayouts?), capturing, OffscreenCard }`.

### Modify
- `apps/mobile/PeakTrack/app/exercise-progression.tsx` — replace inline `SessionStack`/`layoutGeometry`/`tileBackground` with `<VolumeTiles>`; add `<ShareButton>` to `headerRow`; wire `useShareExerciseImage`; render the hook's `OffscreenCard`.
- `apps/mobile/PeakTrack/app/repetition-maximums.tsx` — add per-exercise `<ShareButton>` next to each exercise group header (~line 123); wire `useShareExerciseImage` and render its `OffscreenCard` once at the root of the screen.
- `apps/mobile/PeakTrack/package.json` — add `react-native-view-shot` and `expo-sharing` (install via `npx expo install` to pin SDK-54-compatible versions).

### Reuse (no changes)
- `packages/peaktrack-services/src/repetitionMaximumService.ts` — `lookupExactRm(userId, exerciseName, 1)` returns latest 1RM.
- `packages/peaktrack-services/src/exerciseProgressionService.ts` — `fetchExerciseProgressionData` for the RMs-list flow.
- `packages/peaktrack-services/src/exerciseProgressionLayout.ts` — `buildExerciseSessionLayout` produces layouts.
- `apps/mobile/PeakTrack/lib/volumeStats.ts` — `bucketByDate` for trend points.
- `apps/mobile/PeakTrack/components/VolumeStatCardRow.tsx` + `apps/evil_ui/src/components/stat-card/StatCard.tsx` — stat cards (the card itself can be reused; font scaling for the share canvas may need a scaled wrapper).
- `apps/mobile/PeakTrack/styles/common.ts` — `colors.primary` for tiles and accents.

## Dependencies

```
npx expo install react-native-view-shot expo-sharing
```

`expo-sharing` works in Expo Go; `react-native-view-shot` requires a dev-client rebuild (this project uses CNG, so EAS rebuild is needed before testing on a fresh device).

## Verification

1. `pnpm --filter @evil-empire/mobile typecheck` and `pnpm --filter @evil-empire/mobile test` — extraction must not break existing tests.
2. Build a dev client (`pnpm dev:mobile`) and run on a device.
3. From exercise-progression, tap share → confirm OS share sheet opens with a PNG attached.
4. Save to Files, open in Preview/macOS → confirm transparent background (alpha visible against a checker pattern).
5. Repeat from a row on `repetition-maximums.tsx`.
6. Edge cases:
   - User has no 1RM → badge is hidden, layout still balanced.
   - Single session → trend line skipped (already guarded by `trendPoints.length > 1`).
   - Long exercise name → wraps or truncates gracefully.
   - Compound exercise → faded tiles render correctly.
   - More than 12 sessions → only the most recent 12 are shown.
7. Screen-record during capture and scrub → off-screen card must never flash into the viewport.
