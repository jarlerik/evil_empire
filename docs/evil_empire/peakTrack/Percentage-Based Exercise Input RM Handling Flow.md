---
title: Percentage-Based Exercise Input RM Handling Flow
type: note
permalink: evil-empire/percentage-based-exercise-input-rm-handling-flow
---

# Percentage-Based Exercise Input RM Handling

## Overview
When a user enters an exercise input like "4x6 @80%", the app detects this requires an RM (Repetition Maximum) lookup and fetches the user's 1RM for that exercise before converting the percentage to an absolute weight.

---

## 1. Error/Warning Display Location

**File**: `/apps/mobile/PeakTrack/app/edit-exercise.tsx` (lines 59-65)

```typescript
const handleAddSet = async () => {
    const result = await addExercisePhase(setInput, editingPhaseId);

    if (!result.success) {
        Alert.alert('Error', result.error || 'Unknown error');
        return;
    }
    // ...
};
```

The error is shown via **Alert.alert()** when the user taps "Add" or "Update" button in the edit-exercise screen. The error message is piped from the weight calculation step.

---

## 2. RM Lookup & Calculation Flow

### Step 1: Input Parsing
**File**: `/packages/parsers/src/percentageParser.ts`

When the parser encounters percentage syntax like "@80%", it identifies it needs RM lookup:

```typescript
// parseSimplePercentage function sets these flags:
return validResult({
    sets,
    reps,
    weight: 0, // Placeholder, will be calculated after RM lookup
    weightPercentage: value,
    needsRmLookup: true, // ← FLAG SET
    ...(restTimeSeconds !== undefined && { restTimeSeconds }),
});
```

The parser returns a `ParsedSetData` object with `needsRmLookup: true`.

### Step 2: Weight Calculation with RM Lookup
**File**: `/apps/mobile/PeakTrack/hooks/useAddExercisePhase.ts` (lines 32-100)

The `useAddExercisePhase` hook handles the full flow:

1. Parses input: `parseSetInput(setInput)` 
2. Checks if parsing is valid (line 38-42)
3. Calls `calculateWeightsFromParsedData()` if RM lookup is needed (lines 52-56)
4. Returns error if weight calculation fails (lines 58-61)

### Step 3: RM Lookup & Percentage Resolution
**File**: `/apps/mobile/PeakTrack/hooks/useRmLookup.ts` (lines 22-68)

The `lookupRm()` function:

```typescript
const lookupRm = async (
    userId: string,
    exerciseName: string,
): Promise<RmLookupResult> => {
    // First try exact match on exercise name
    const { data: rmData, error: rmError } = await lookupExactRm(userId, exerciseName, 1);
    
    let foundWeight: number | null = rmData?.weight ?? null;
    
    // Fallback: for compound exercises, try partial matching
    if ((rmError || !foundWeight) && exerciseName.includes('+')) {
        // ... compound exercise handling ...
    }
    
    // If no RM found, return error
    if (rmError || !foundWeight) {
        return {
            weight: 0,
            found: false,
            error: `No 1RM found for "${exerciseName}". Please set your 1RM first.`,
        };
    }
    
    return { weight: foundWeight, found: true };
};
```

**Key error message** (line 63): `No 1RM found for "${exerciseName}". Please set your 1RM first.`

### Step 4: Percentage-to-Weight Conversion
**File**: `/apps/mobile/PeakTrack/hooks/useRmLookup.ts` (lines 83-149)

The `calculateWeightsFromParsedData()` function:

```typescript
if (parsedData.needsRmLookup) {
    const rmResult = await lookupRm(userId, exerciseName);
    
    if (!rmResult.found) {
        return {
            success: false,
            weights: { weight: 0 },
            error: rmResult.error, // ← ERROR RETURNED HERE
        };
    }
    
    rawRmWeight = rmResult.weight;
    
    // Convert percentages to absolute weights
    if (parsedData.weights && parsedData.weights.length > 1) {
        calculatedWeights = parsedData.weights.map(p => 
            calculateWeightFromPercentage(rmResult.weight, p)
        );
    } else if (parsedData.weightMinPercentage !== undefined && 
               parsedData.weightMaxPercentage !== undefined) {
        // Range: e.g., "4x6 @80-85%"
        calculatedWeightMin = calculateWeightFromPercentage(rmResult.weight, parsedData.weightMinPercentage);
        calculatedWeightMax = calculateWeightFromPercentage(rmResult.weight, parsedData.weightMaxPercentage);
    } else if (parsedData.weightPercentage !== undefined) {
        // Single: e.g., "4x6 @80%"
        calculatedWeight = calculateWeightFromPercentage(rmResult.weight, parsedData.weightPercentage);
    }
}
```

---

## 3. RM Fetching (Lookup Service)

**File**: `/apps/mobile/PeakTrack/services/repetitionMaximumService.ts` (lines 93-117)

```typescript
export async function lookupExactRm(
    userId: string,
    exerciseName: string,
    reps: number,
): Promise<ServiceResult<{ weight: number } | null>> {
    const { data, error } = await supabase
        .from('repetition_maximums')
        .select('weight')
        .eq('user_id', userId)
        .ilike('exercise_name', exerciseName.trim()) // Case-insensitive match
        .eq('reps', reps) // reps = 1 for 1RM lookup
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (error) {
        return { data: null, error: error.message };
    }
    
    return { data, error: null };
}
```

**Database Query**:
- Searches `repetition_maximums` table
- Filters by `user_id` and `exercise_name` (case-insensitive)
- Looks for reps = 1 (always fetches 1RM)
- Returns most recent entry if multiple exist
- Returns `null` if no match found

---

## 4. Repetition Maximums Page Structure

**File**: `/apps/mobile/PeakTrack/app/repetition-maximums.tsx`

### Page Features:
- **Title**: "Max reps" (line 154)
- **Add Button**: Opens `RmFormModal` (lines 156-162)
- **Grouping Logic** (lines 111-132):
  - Groups RMs by exercise name
  - Within each exercise, groups by rep count
  - Shows best (highest weight) for each exercise/reps combo
  - Handles ties by picking most recent entry

### Data Display (lines 171-202):
```
Exercise Name (e.g., "Squat")
├─ 1RM: 150kg (date: Mar 10, 2026)
├─ 3RM: 140kg (date: Feb 28, 2026)
└─ 5RM: 130kg (date: Feb 15, 2026)
```

### RM Form Modal
**File**: `/apps/mobile/PeakTrack/components/RmFormModal.tsx`

Fields:
- Exercise Name (text, autocapitalize)
- Reps (numeric)
- Weight (kg, decimal-pad)
- Date (format: yyyy-MM-dd)

Validation (lines 51-67):
- All fields required
- Reps > 0
- Weight > 0

---

## 5. Edit-Exercise Page Integration

**File**: `/apps/mobile/PeakTrack/app/edit-exercise.tsx`

### Flow:
1. User enters exercise input (line 166): `placeholder="4 x 3 @100kg 120s"`
2. User taps "Add" (line 174)
3. `handleAddSet()` calls `addExercisePhase(setInput, editingPhaseId)` (line 60)
4. Error handling (lines 62-65):
   ```typescript
   if (!result.success) {
       Alert.alert('Error', result.error || 'Unknown error');
       return;
   }
   ```
5. On success, input cleared and phase added to list (lines 67-68)

### Error Sources for Percentage Inputs:
1. **No RM found**: `No 1RM found for "Squat". Please set your 1RM first.`
2. **Invalid percentage**: `Percentage must be between 0 and 100` (from parser)
3. **Range validation**: `Minimum percentage must be less than or equal to maximum percentage`

---

## 6. Key Locations Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| Percentage Parser | `packages/parsers/src/percentageParser.ts` | Sets `needsRmLookup: true` flag |
| RM Lookup Hook | `apps/mobile/PeakTrack/hooks/useRmLookup.ts` | Fetches 1RM and calculates weights |
| Add Exercise Hook | `apps/mobile/PeakTrack/hooks/useAddExercisePhase.ts` | Orchestrates parsing → calculation |
| Exercise Screen | `apps/mobile/PeakTrack/app/edit-exercise.tsx` | Displays error via Alert.alert() |
| RM Service | `apps/mobile/PeakTrack/services/repetitionMaximumService.ts` | Database queries |
| RM Page | `apps/mobile/PeakTrack/app/repetition-maximums.tsx` | User adds/edits RMs |
| RM Form | `apps/mobile/PeakTrack/components/RmFormModal.tsx` | Form for adding RM data |

---

## 7. Testing

**File**: `/apps/mobile/PeakTrack/hooks/__tests__/useRmLookup.test.ts`

Test case for missing RM (lines 153-170):
```typescript
it('should fail when RM lookup fails', async () => {
    mockLookupExactRm.mockResolvedValue({ data: null, error: null });
    
    const calcResult = await result.current.calculateWeightsFromParsedData(
        'user-1',
        'Unknown Exercise',
        {
            weight: 0,
            needsRmLookup: true,
            weightPercentage: 80,
        },
    );
    
    expect(calcResult.success).toBe(false);
    expect(calcResult.error).toContain('No 1RM found');
});
```