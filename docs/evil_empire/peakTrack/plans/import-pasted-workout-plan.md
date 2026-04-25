# Plan: Import Workouts/Exercises from Pasted Text

## Status
Approved - 2026-04-16 (open questions resolved by user)

## Decisions
- **Entry point:** home screen quick-action (next to existing inline "Add exercise" input).
- **Target workout:** all parsed blocks land in the workout for the date currently selected on the home screen. Multi-workout paste = single PeakTrack workout with N exercises (matches the reference screenshot, which is one Snatch session with three movements).
- **`@light weight` semantics:** map to `@60%` and route through the existing RM-lookup flow. No separate intensity-descriptor data model needed. (`@moderate` / `@heavy` / `@RPE` deferred — not on the critical path.)
- **Date selection:** none — uses the home-screen date. The import screen is review-only, no date picker.

## Context
Users currently coach from other platforms (e.g. the Hyrox/CrossFit-style feed shown in the reference screenshot). To bring a session into PeakTrack today, they have to retype each exercise name, sets, reps, and weight — even though the source already contains all of that information in a structured-ish text form.

Examples of the kind of text we want to accept verbatim:

```
High hang muscle snatch + push press BTN + OHS
4 x 3+3+3 @light weight
pause in lockout of each push press & in the bottom of OHS
```

```
Snatch pull + hang power snatch
8 x 3+3 @70-75%
```

```
Snatch grip DL with pause
4 x 5 @95% of 1RM
pause at knee for 3 sec
```

## Goal
Let the user paste raw workout text once and produce one or more `Exercise` + `ExercisePhase` rows with the **minimum number of additional inputs**. Where ambiguity is unavoidable, surface a small, focused prompt instead of a blank form.

## Non-Goals
- Importing from APIs / OAuth integrations with other apps. This is paste-only.
- OCR / image import. Text only.
- Importing historical results (weights actually lifted). We are importing the *prescription* only.

---

## What the Current System Already Handles

Confirmed by reading the parser, hooks, and DB schema:

- **Compound rep schemes** like `4 x 3+3+3` parse cleanly into `compoundReps: [3,3,3]` (`packages/parsers/src/compoundParser.ts`).
- **Percentage ranges** like `@70-75%` parse and set `needsRmLookup: true` (`packages/parsers/src/percentageParser.ts`).
- **Notes** on a second line of the set input are stored in `ExercisePhase.notes` (`packages/parsers/src/index.ts:55-58`).
- **RM resolution** with fuzzy partial match on compound names already exists (`apps/mobile/PeakTrack/hooks/useRmLookup.ts:50-73`) — splits on `+` and matches against the user's stored RMs, surfacing `RmSelectModal` when only partial matches are found.
- **Rest time** like `120s` / `2m` is parsed as a suffix.

So the parser core is in good shape. The gaps are at **two layers**: a preprocessor that turns multi-line free-form text into the parser's expected single-line input, and three small extensions for cases the parser doesn't know about today.

---

## Gaps to Close

1. **No multi-line / free-form preprocessor.** The parser today expects `"4 x 3 @50kg"` plus an optional newline of notes. The pasted text has the exercise name on its own line above the set spec.
2. **`@light weight` doesn't parse.** Decision: rewrite it to `@60%` in the preprocessor — no parser change needed, and it flows through the existing RM-lookup path automatically.
3. **`of 1RM` suffix.** `@95% of 1RM` is functionally identical to `@95%`, but the literal text breaks the percentage parser's regex.
4. **No explicit "which lift is this % calculated from?" prompt at import time.** The existing flow only prompts inside `edit-exercise.tsx` when the user adds a single phase. For an import of N exercises we need this to be a per-exercise step in the review screen.
5. **No paste-and-review UI.** No entry point currently exists.

---

## Design Overview

```
[Paste screen] → [Preprocessor] → [Review screen] → [Bulk save]
                       │                  │
                       │                  └─ Per-exercise prompts:
                       │                       • intensity descriptor → pick weight or RIR
                       │                       • percentage with no exact RM → pick source lift
                       │
                       └─ Splits text into blocks; each block emits
                          { rawName, parsed: ParsedSetData, notes, warnings[] }
```

Two distinct units:

- **Block** — one pasted exercise. Roughly: a name line + a set-spec line + zero or more note lines. Blocks are separated by a blank line OR by a non-numeric line that is followed by another set-spec line (heuristic).
- **Block parse result** — `{ rawText, suggestedName, parsedSet: ParsedSetData, notesText, missing: MissingField[] }`.

`MissingField` is one of: `'weight'` (intensity descriptor used), `'rmSource'` (percentage used and no exact RM match), `'unparseable'` (couldn't extract sets/reps at all → user must edit raw).

---

## Phases

### Phase 1 — Parser micro-fix

Only one change needed in `packages/parsers/src/percentageParser.ts`: strip a trailing ` of 1RM` / ` of 1rm` from the input before regex matching. One-line change.

Extend `percentageParser.test.ts` with the `of 1RM` suffix variants.

No DB migration. No `ParsedSetData` shape change. The `@light weight` → `@60%` rewrite happens in the preprocessor (Phase 2), not the parser.

### Phase 2 — Text preprocessor

**New file:** `packages/parsers/src/workoutTextPreprocessor.ts`.

**Function:** `preprocessWorkoutText(raw: string): PreprocessedBlock[]`

```ts
interface PreprocessedBlock {
  rawText: string;            // original lines for this block
  suggestedName: string;      // best guess at exercise name
  setSpecLine: string;        // the line that looks like "4 x 3 @..."
  notesText?: string;         // remaining lines joined
  parseError?: string;        // if no set spec line was found
}
```

**Heuristics (in order):**

1. Split input on blank lines into raw blocks.
2. For each block, find the first line matching the regex `/\b\d+\s*[x×]\s*\d/i` — that's the **set-spec line**.
3. Lines *before* the set-spec line → joined as `suggestedName` (strip trailing `—`, `–`, `-`, `:`).
4. Lines *after* it → joined as `notesText`.
5. **Token rewrites on the set-spec line, before handing to `parseSetInput`:**
   - `@light(?:\s*weight)?` → `@60%`
   - ` of\s*1\s*RM` → `` (drop the suffix)
   - Normalise unicode dashes (`—` / `–`) to ASCII `-` outside of separator-handling.
6. If no set-spec line is found → `parseError: 'no_set_spec'`; the block is surfaced in the review UI for manual editing.
7. Inline-separator fallback: if a single line contains both name and spec separated by `—` / `–` / ` - ` / `:`, split on the separator.

**Tests:** `packages/parsers/__tests__/workoutTextPreprocessor.test.ts` covering the three example screenshots verbatim plus inline-separator and multi-block variants. Verify `@light weight` rewrites to `@60%` and `@95% of 1RM` rewrites to `@95%`.

### Phase 3 — Combined high-level API

**New function** in `packages/parsers/src/index.ts`:

```ts
export function parseWorkoutText(raw: string): ParsedWorkoutBlock[]

interface ParsedWorkoutBlock {
  suggestedName: string;
  parsed: ParsedSetData;       // result of parseSetInput on setSpecLine
  notes?: string;
  missing: ('rmSource' | 'unparseable')[];
  rawText: string;             // for "edit raw" fallback
}
```

`missing` is computed from `parsed`:
- `parsed.needsRmLookup === true` → `'rmSource'` (resolved later against the user's RMs at the UI layer; only stays in `missing` if no exact match)
- `parsed.isValid === false` → `'unparseable'`

`@light weight` no longer needs a "weight needed" branch — the preprocessor rewrites it to `@60%`, so it surfaces as `'rmSource'` if the lift has no exact RM, exactly like any other percentage exercise.

This is the only function the mobile app needs to call.

### Phase 4 — Mobile UI: paste entry point

**Entry point:** add a "Paste workout" quick-action on the home screen, next to the existing inline "Add exercise" input. Tapping it pushes the import route, carrying the home screen's currently-selected date as a navigation param.

**New route:** `apps/mobile/PeakTrack/app/import-workout.tsx` (accepts `?date=YYYY-MM-DD`)

UI:

1. **Step 1 — Paste.** Multi-line `TextInput` (autosize, monospace). "Parse" button calls `parseWorkoutText`.
2. **Step 2 — Review.** A scrollable list of detected blocks. Each card shows:
   - Editable exercise name (`suggestedName` prefilled).
   - Read-only summary of the parsed set spec (e.g. "4 × 3+3+3 @ 60%"), with an "Edit raw" affordance that swaps to a single-line `TextInput` bound to the raw set spec for power-users.
   - Notes field (prefilled from `notesText`).
   - Inline missing-info chips:
     - **% reference needed** chip → opens existing `RmSelectModal` / `RmFormModal` pre-filled with the parsed exercise name. Reuse the partial-match logic from `useRmLookup.lookupRm` to pre-suggest matches.
     - **Couldn't parse** chip → highlights the block in red; the user must edit the raw text.
   - Per-block "Skip" toggle (excludes from import without losing the text).
3. **Step 3 — Confirm & save.** "Add to workout" button at the bottom (uses the date passed in via nav param — no in-screen date picker). Disabled until every non-skipped block has zero `missing` entries.

**Save path:** for each non-skipped block, in order:
1. Create or reuse the `Workout` row for the selected date (use the same upsert path the home screen uses when adding an inline exercise).
2. Create `Exercise` row (same path as `add-exercises.tsx:54-73`).
3. Create `ExercisePhase` via `useAddExercisePhase.addExercisePhase` — but extend the hook to accept a `prefilled` argument so it skips re-parsing when the import screen has already produced a `ParsedSetData` (avoids double work and avoids the modal flow firing twice).

**Reused components:** `RmSelectModal`, `RmFormModal`.

### Phase 5 — Polish / edge cases

- Handle Unicode dashes (`—` / `–`) and stray middots in the preprocessor.
- Strip a leading line that is the workout type label (e.g. `"Snatch WORKOUT"` from the screenshot). Heuristic: ignore a line consisting only of a single capitalised word + the literal `WORKOUT`.
- Strip a leading "Last done at …" line if present (also visible in the source feed).
- Optional follow-up (not blocking): persist the original raw `@light weight` text as a note on the phase so the user can see where the 60% number came from. Skip for v1.

---

## Risks

- **Heuristic preprocessor will mis-split unfamiliar formats.** Mitigated by: review screen always editable; raw-edit fallback per block; the parser's existing `isValid === false` path surfaces failures clearly rather than silently dropping data.
- **`@light weight` → 60% is a hardcoded heuristic.** Some sources mean "empty bar" by "light", others mean "warm-up sets". Acceptable for v1 since the user can always edit the raw spec on the review screen before saving.
- **No data-model changes** in this v1 — pure UI + preprocessor work. Lowest possible blast radius.

---

## Deliverables Checklist

- [x] Strip `of 1RM` in `percentageParser` + tests (commit 8bc984f)
- [x] `workoutTextPreprocessor` (with `@light weight` → `@60%` and `of 1RM` rewrites) + tests on all three reference screenshots (commit 8bc984f)
- [x] `parseWorkoutText` high-level API + tests (commit 8bc984f)
- [x] `app/import-workout.tsx` review screen (accepts `?selectedDate=` nav param)
- [x] "Paste workout from another app" entry point on home screen, passing the selected date
- [x] Extracted `buildPhaseData` to `lib/buildPhaseData.ts` for reuse (replaces the originally-planned `useAddExercisePhase` shortcut — cleaner separation since import flow loops over N exerciseIds while the hook is bound to a single one)
- [x] Reuse `RmSelectModal` / `RmFormModal` for the "% reference" prompt (with eager exact-match resolution so the chip only appears when user input is genuinely required)
- [ ] Manual smoke test on device: paste the full three-exercise Snatch session from the screenshot and import successfully into a single workout

## Links
- Source screenshot: pasted by user 2026-04-16 (Hyrox-style feed)
- Related: [Percentage-Based Exercise Input RM Handling Flow](../Percentage-Based%20Exercise%20Input%20RM%20Handling%20Flow.md)
- Related: [Open issues](../Open%20issues.md) — "Could the flow to create workout and exercises be simpler?"
