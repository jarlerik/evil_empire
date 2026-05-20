# Daily Log 20.05.2026

## feat(mobile): shareable exercise progress image
Added a share-to-Story flow on the exercise-progression and RMs screens. Tapping share renders a 1080×1920 transparent PNG with the exercise name, latest 1-rep max badge, 7d/30d volume stats, and the volume tiles + trend line, then hands it to the native share sheet. Extracted the tile/trend rendering into a reusable `VolumeTiles` component (parameterized dimensions) so the on-screen view and the larger share canvas share one code path. New deps: `react-native-view-shot`, `expo-sharing`.

## chore: gitignore root-level Expo CNG artifacts
Stray `/android`, `/ios`, and `/app.json` siblings appear at the repo root after a misplaced `expo install` or prebuild. The real Expo config lives at `apps/mobile/PeakTrack/app.json`, so the root ones are noise — added them to `.gitignore` to keep accidental commits out.
