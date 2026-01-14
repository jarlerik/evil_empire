# Architecture Review: Evil Empire Workout App

**Review Date:** 2026-01-13
**Phase:** 3 (Post Phase 2 Hook Extraction)

## Summary

The codebase has made significant progress with Phase 2 refactoring (hook extraction), but several critical files still exceed size thresholds and require further decomposition. Test coverage is severely lacking outside of `parseSetInput`.

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

### 🔴 `app/edit-exercise.tsx` - 685 lines (Critical: >400)

**Issue:** `handleAddSet` function is ~280 lines with mixed concerns
**Recommendation:** Extract to `useAddExercisePhase` hook

- [ ] Create `hooks/useAddExercisePhase.ts`
- [ ] Move phase data construction logic to hook
- [ ] Move RM lookup integration to hook
- [ ] Move database insert/update operations to hook
- [ ] Update `edit-exercise.tsx` to use new hook

### 🔴 `app/repetition-maximums.tsx` - 495 lines (Critical: >400)

**Issue:** Inline Modal component not using extracted `RmFormModal`
**Recommendation:** Replace inline Modal (lines 250-322) with existing component

- [ ] Replace inline Modal with `components/RmFormModal.tsx`
- [ ] Remove duplicated modal styles
- [ ] Verify modal functionality after replacement

### 🟡 `app/start-workout.tsx` - 695 lines (Warning)

**Issue:** Still contains significant logic despite hook extraction
**Recommendation:** Extract presentational components

- [ ] Extract `WorkoutExerciseList` component
- [ ] Extract `WorkoutTimerDisplay` component
- [ ] Move exercise item rendering to separate component

### 🟡 `app/index.tsx` - 472 lines (Warning)

**Recommendation:** Review for extractable components/hooks

- [ ] Analyze file for extraction opportunities
- [ ] Extract identified components/hooks

### 🟡 `app/add-exercises.tsx` - 365 lines (Warning)

- [ ] Review for extraction opportunities

### 🟡 `app/settings.tsx` - 342 lines (Warning)

- [ ] Review for extraction opportunities

---

## 3. Test Coverage Gaps

### 🔴 Missing Hook Tests

**Issue:** No tests for custom hooks

- [ ] Create `hooks/__tests__/useExercisePhases.test.ts`
- [ ] Create `hooks/__tests__/useWorkoutState.test.ts`
- [ ] Create `hooks/__tests__/useWorkoutTimer.test.ts`
- [ ] Create `hooks/__tests__/useRmLookup.test.ts`

### 🔴 Missing Component Tests

**Issue:** Only `ThemedText` has tests (9 lines)

- [ ] Create `components/__tests__/RmFormModal.test.tsx`
- [ ] Create `components/__tests__/EditExecutionModal.test.tsx`
- [ ] Create `components/__tests__/Button.test.tsx`

### 🔴 Missing Context Tests

**Issue:** No tests for context providers

- [ ] Create `contexts/__tests__/AuthContext.test.tsx`
- [ ] Create `contexts/__tests__/UserSettingsContext.test.tsx`

### 🟡 `lib/__tests__/parseSetInput.test.ts` - 1423 lines (Critical: >500)

**Recommendation:** Split into pattern-specific test files

- [ ] Create `lib/parsers/__tests__/standardParser.test.ts`
- [ ] Create `lib/parsers/__tests__/percentageParser.test.ts`
- [ ] Create `lib/parsers/__tests__/compoundParser.test.ts`
- [ ] Create `lib/parsers/__tests__/waveParser.test.ts`
- [ ] Create `lib/parsers/__tests__/circuitParser.test.ts`
- [ ] Create `lib/parsers/__tests__/rirParser.test.ts`
- [ ] Create `lib/parsers/__tests__/rmBuildParser.test.ts`
- [ ] Create `lib/parsers/__tests__/restTimeParser.test.ts`
- [ ] Create `lib/parsers/__tests__/reverseParser.test.ts`

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
| 2 | Use `RmFormModal` in repetition-maximums | Medium | Low | [ ] |
| 3 | Extract `useAddExercisePhase` hook | High | Medium | [ ] |
| 4 | Add hook tests | High | Medium | [ ] |
| 5 | Split parser tests | Medium | Low | [ ] |
| 6 | Extract common styles | Low | Low | [ ] |

---

## Test Coverage Summary

| Module | Current | Target | Status |
|--------|---------|--------|--------|
| `lib/parseSetInput.ts` | Good | Split tests | [ ] |
| `hooks/*` | None | Full coverage | [ ] |
| `components/*` | Minimal | Full coverage | [ ] |
| `contexts/*` | None | Full coverage | [ ] |
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

### Phase 3: Parser Decomposition & Test Coverage (Current)
- [x] Split parseSetInput.ts into modules
- [ ] Complete screen component extraction
- [ ] Add comprehensive test coverage
- [ ] Extract shared styles and types
