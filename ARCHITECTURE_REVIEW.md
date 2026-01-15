# Architecture Review: Evil Empire Workout App

**Review Date:** 2026-01-14
**Phase:** 3 (Screen Component Extraction Complete)

## Summary

Screen component extraction is now complete. All critical files (>400 lines) have been refactored under threshold except `start-workout.tsx` (508 lines), which requires further state machine extraction. Test coverage remains the primary gap.

## Severity Levels

- 🔴 Critical - Must fix before merge
- 🟡 Warning - Should address soon
- 🟢 Suggestion - Consider for improvement

---

## 1. Parser Module Decomposition

### 🟢 `lib/parseSetInput.ts` - Refactored (COMPLETED)

**Location:** `lib/parsers/`
**Status:** ✅ Completed - Split into 11 focused modules

- [x] Create `lib/parsers/` directory structure
- [x] Extract `types.ts` - ParsedSetData interface
- [x] Extract `standardParser.ts` - "4 x 3 @50kg" patterns
- [x] Extract `percentageParser.ts` - "@80%" and "@80-85%" patterns
- [x] Extract `compoundParser.ts` - "4 x 2 + 2 @50kg" patterns
- [x] Extract `waveParser.ts` - "3-2-1-1-1 65kg" patterns
- [x] Extract `circuitParser.ts` - Circuit/superset patterns
- [x] Extract `rirParser.ts` - RIR notation patterns
- [x] Extract `rmBuildParser.ts` - "Build to 8RM" patterns
- [x] Extract `restTimeParser.ts` - Rest time parsing utility
- [x] Extract `reverseParser.ts` - reverseParsePhase function
- [x] Create `index.ts` - Main parseSetInput with pattern registry

---

## 2. Screen Component Extraction

### 🟢 `app/edit-exercise.tsx` - 348 lines (COMPLETED)

**Status:** ✅ Completed - Reduced from 685 lines to 348 lines

- [x] Create `hooks/useAddExercisePhase.ts`
- [x] Move phase data construction logic to hook
- [x] Move RM lookup integration to hook
- [x] Move database insert/update operations to hook
- [x] Update `edit-exercise.tsx` to use new hook

### 🟢 `app/repetition-maximums.tsx` - 334 lines (COMPLETED)

**Status:** ✅ Completed - Reduced from 495 lines to 334 lines

- [x] Replace inline Modal with `components/RmFormModal.tsx`
- [x] Remove duplicated modal styles
- [x] Verify modal functionality after replacement

### 🟡 `app/start-workout.tsx` - 508 lines (Warning)

**Status:** Partially complete - Reduced from 695 lines to 508 lines

- [x] Extract `WorkoutExerciseItem` component
- [x] Extract `WorkoutTimerDisplay` component
- [ ] Further extraction requires refactoring workout state machine to hook

### 🟢 `app/index.tsx` - 321 lines (COMPLETED)

**Status:** ✅ Completed - Reduced from 472 lines to 321 lines

- [x] Analyze file for extraction opportunities
- [x] Extract `WorkoutCard` component
- [x] Extract `WeekDaySelector` component

### 🟢 `app/add-exercises.tsx` - 272 lines (COMPLETED)

**Status:** ✅ Completed - Reduced from 365 lines to 272 lines

- [x] Review for extraction opportunities
- [x] Use shared `formatExercisePhase` from `lib/formatExercisePhase.ts`

### 🟢 `app/settings.tsx` - 342 lines (OK)

**Status:** ✅ Under threshold - No changes needed

- [x] Review for extraction opportunities (none required)

---

## 3. Test Coverage Gaps

### 🟢 Hook Tests (COMPLETED)

**Status:** ✅ Completed - All custom hooks have comprehensive tests

- [x] Create `hooks/__tests__/useExercisePhases.test.ts` (18 tests)
- [x] Create `hooks/__tests__/useWorkoutState.test.ts` (20 tests)
- [x] Create `hooks/__tests__/useWorkoutTimer.test.ts` (14 tests)
- [x] Create `hooks/__tests__/useRmLookup.test.ts` (11 tests)

### 🟢 Component Tests (COMPLETED)

**Status:** ✅ Completed - Key components have comprehensive tests

- [x] Create `components/__tests__/RmFormModal.test.tsx` (22 tests)
- [x] Create `components/__tests__/EditExecutionModal.test.tsx` (20 tests)
- [x] Create `components/__tests__/Button.test.tsx` (7 tests)

### 🟢 Context Tests (COMPLETED)

**Status:** ✅ Completed - Context providers have comprehensive tests

- [x] Create `contexts/__tests__/AuthContext.test.tsx` (16 tests)
- [x] Create `contexts/__tests__/UserSettingsContext.test.tsx` (12 tests)

### 🟢 `lib/__tests__/parseSetInput.test.ts` - Split Tests (COMPLETED)

**Status:** ✅ Completed - Split into 8 pattern-specific test files (163 tests)

- [x] Create `lib/parsers/__tests__/standardParser.test.ts`
- [x] Create `lib/parsers/__tests__/percentageParser.test.ts`
- [x] Create `lib/parsers/__tests__/compoundParser.test.ts`
- [x] Create `lib/parsers/__tests__/waveParser.test.ts`
- [x] Create `lib/parsers/__tests__/circuitParser.test.ts`
- [x] Create `lib/parsers/__tests__/rirParser.test.ts`
- [x] Create `lib/parsers/__tests__/restTimeParser.test.ts`
- [x] Create `lib/parsers/__tests__/integration.test.ts`

**Note:** Original `lib/__tests__/parseSetInput.test.ts` (133 tests) preserved for backward compatibility. rmBuildParser and reverseParser tests not needed as they have no existing test coverage in the original file.

---

## 4. Pattern Consistency Issues

### 🟡 Duplicated Styles

**Issue:** Common styles (container, headerRow, backButton, etc.) duplicated across screens
**Recommendation:** Extract to shared styles module

- [ ] Create `styles/common.ts` with shared styles
- [ ] Update `app/start-workout.tsx` to use shared styles
- [ ] Update `app/edit-exercise.tsx` to use shared styles
- [ ] Update `app/repetition-maximums.tsx` to use shared styles
- [ ] Update `app/add-exercises.tsx` to use shared styles
- [ ] Update `app/index.tsx` to use shared styles
- [ ] Update `app/settings.tsx` to use shared styles

### 🟢 Interface Location

**Issue:** `ExerciseDB` interface defined inline in `start-workout.tsx:12`
**Recommendation:** Move shared interfaces to `types/` directory

- [ ] Create `types/` directory
- [ ] Move `ExerciseDB` interface to `types/exercise.ts`
- [ ] Move `RepetitionMaximum` interface to `types/rm.ts`
- [ ] Move other shared interfaces to appropriate type files
- [ ] Update imports across codebase

---

## Refactoring Priority Order

| Priority | Task | Impact | Effort | Status |
|----------|------|--------|--------|--------|
| 1 | Split `parseSetInput.ts` | High | Medium | [x] |
| 2 | Use `RmFormModal` in repetition-maximums | Medium | Low | [x] |
| 3 | Extract `useAddExercisePhase` hook | High | Medium | [x] |
| 4 | Add hook tests | High | Medium | [x] |
| 5 | Add component tests | High | Medium | [x] |
| 6 | Split parser tests | Medium | Low | [x] |
| 7 | Extract common styles | Low | Low | [ ] |

---

## Test Coverage Summary

| Module | Current | Target | Status |
|--------|---------|--------|--------|
| `lib/parseSetInput.ts` | Excellent (296 tests) | Split tests | [x] |
| `hooks/*` | Good (63 tests) | Full coverage | [x] |
| `components/*` | Good (49 tests) | Full coverage | [x] |
| `contexts/*` | Good (28 tests) | Full coverage | [x] |
| `app/*` screens | None | Integration tests | [ ] |

---

## Phase History

### Phase 1: Exercise Phases Implementation
- [x] exercise_phases migrations
- [x] Render phases in add exercise view
- [x] Persist the exercise phases
- [x] Add edit phase functionality

### Phase 2: Hook Extraction & Component Refactoring
- [x] Create `useExercisePhases.ts` hook
- [x] Create `useWorkoutState.ts` hook
- [x] Create `useWorkoutTimer.ts` hook
- [x] Create `useRmLookup.ts` hook
- [x] Create `RmFormModal.tsx` component
- [x] Create `EditExecutionModal.tsx` component
- [x] Migrate to `Alert.alert()` API

### Phase 3: Parser Decomposition & Screen Component Extraction (Current)
- [x] Split parseSetInput.ts into modules
- [x] Complete screen component extraction (5/6 files under threshold)
  - [x] Extract `useAddExercisePhase` hook (edit-exercise.tsx: 685→348 lines)
  - [x] Use `RmFormModal` in repetition-maximums (495→334 lines)
  - [x] Extract `WorkoutExerciseItem` and `WorkoutTimerDisplay` components (start-workout.tsx: 695→508 lines)
  - [x] Extract `WorkoutCard` and `WeekDaySelector` components (index.tsx: 472→321 lines)
  - [x] Use shared `formatExercisePhase` (add-exercises.tsx: 365→272 lines)
- [x] Add comprehensive test coverage (436 tests total: hooks 63, components 49, contexts 28, parsers 296)
- [x] Split parser tests into pattern-specific files (163 new tests)
- [ ] Extract shared styles and types
