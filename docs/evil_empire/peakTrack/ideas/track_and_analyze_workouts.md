Reference images:
![[analytics2.png]]

![[analytics1.png]]

## Goal

Track progression of a main lift across a multi-week program so the user can see, at a glance, how volume and intensity evolve over time.

## Use case: Russian back squat program (9 weeks)

Example prescription:

| Week | Mon        | Thu           |
| ---- | ---------- | ------------- |
| 1    | 6 × 2 @80% | 6 × 3 @80%    |
| 2    | 6 × 2 @80% | 6 × 4 @80%    |
| 3    | 6 × 2 @80% | 6 × 5 @80%    |
| 4    | 6 × 2 @80% | 6 × 6 @80%    |
| 5    | 6 × 2 @80% | 5 × 5 @85%    |
| …    | …          | …             |

Monday = speed/volume day at a fixed %, Thursday = progressive overload day.
The app should make it easy to answer: *"Am I actually getting stronger week over week?"*

## View

### Per-session tile view

Each session for the tracked exercise renders as a tile showing sets × reps.

e.g.
- 3 × 5
- 3 × 3
- 3 × 4

### Per-session volume line

Below (or next to) the tile, show total volume for that session.

e.g.
- 3 × 5 × 85 = 1275
- 3 × 3 × 100 = 900
- 3 × 4 × 95 = 1140

### Progression across the program

Stack sessions chronologically (grouped by week) so the user can scan:

- **Volume trend** — total kg lifted per session, per week, and per program.
- **Intensity trend** — top set weight and %1RM used.
- **Completion** — prescribed vs. actually performed (e.g. prescribed 6 × 5, performed 5 × 5 → flag the missed rep).

Optional sparkline / mini-chart per exercise showing volume and top-set weight over the weeks of the program.

## Data it should surface

- Prescribed sets/reps/weight (from the program)
- Performed sets/reps/weight (from the logged workout)
- Volume per set, per session, per week, per program
- Top set (heaviest working set) per session
- %1RM used (derived from current RM)
- Deviation from prescription (missed reps, added reps, weight changes)

## Volume rules

- **Compound sets** (e.g. `3 × 2 + 2 @50kg`) are flattened to total reps at the same weight — treated as `3 × 4 @50kg` for volume. Tile can still render the original `3 × 2 + 2` for readability, but volume = sets × total_reps × weight.
- **Wave loading** pairs each rep bucket with its own weight via a `weights[]` array aligned to the rep scheme. Volume is the sum per position.

  e.g. `3-2-1-3-2-1` with `weights = [60, 65, 70, 65, 75, 80]`:

  `3×60 + 2×65 + 1×70 + 3×65 + 2×75 + 1×80 = 180 + 130 + 70 + 195 + 150 + 80 = 805`

  Tile renders the rep scheme; volume line sums the per-position products. One tile per session (not per wave).

## Placement

Own route and view (e.g. `app/program-progression.tsx`), reached via a link from the program detail view. Keeps the program view uncluttered and leaves room to grow the progression view (charts, filters, per-exercise drill-down) without crowding the program edit flow.

## Rendering

![[Pasted image 20260421_trend_reference.png]]

### Layout

One column per session, laid out left-to-right in chronological order. Each column has two stacked layers sharing the same x-axis:

1. **Top: volume trend line** — polyline connecting the total volume of each session, with the number rendered above each node.
2. **Bottom: tile stack** — a grid of `sets × reps` squares. Columns within the stack = sets, rows = reps (or transpose, whichever reads better once we prototype). The stack grows taller with higher reps and wider with more sets, giving a natural visual weight that tracks the session's effort.

### Tile color encoding

- **Bright orange** = performed as prescribed (or above).
- **Dark brown** = performed below prescription (missed reps, lighter weight).
- Optional third shade for "top-set" / PR tiles.

The shading is the main "at a glance" signal — a mostly-orange column means a clean session, brown means the user fell short.

### Horizontal scrolling

Use a horizontal `ScrollView` (or `FlatList` with `horizontal`) so the full 9-week program scrolls left-to-right. Fixed y-axis, scrolling x-axis. Pin week labels above the columns so they scroll with the data. Consider a sticky "today" marker.

### Library choices

Options, in order of preference:

1. **react-native-svg** (already transitively available via Expo) — render the trend line as an SVG `<Polyline>` or `<Path>`, tiles as plain `<View>`s. Lightweight, full control, no extra dependency for charts. Good default given the custom layout (tiles + overlaid line) doesn't match any off-the-shelf chart component.
2. **victory-native-xl** (Skia-based, modern) — overkill for v1 but worth considering if we later want pinch-zoom, animated transitions, or per-exercise multi-line charts.
3. **react-native-skia** directly — only if we hit perf issues with SVG on long programs (100+ sessions). Not needed for a 9-week program with ~18 sessions.

Start with `react-native-svg` + native `ScrollView`. Revisit if we outgrow it.
