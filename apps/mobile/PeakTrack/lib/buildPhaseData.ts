import { ParsedSetData } from './parseSetInput';
import { PhaseInsertData } from '@evil-empire/peaktrack-services';

/**
 * Translate a `ParsedSetData` (from `@evil-empire/parsers`) plus the resolved
 * weight numbers into the row shape expected by `insertPhase` / `updatePhase`.
 *
 * Used by both `useExercisePhases` (live edit-exercise flow) and the paste-import
 * flow so phase rows always look the same regardless of how they were created.
 *
 * `isUpdate` toggles whether absent optional fields are written as `null`
 * (clearing the column on update) vs. omitted (using the column default on insert).
 */
export function buildPhaseData(
	exerciseId: string,
	parsedData: ParsedSetData,
	calculatedWeight: number,
	weightRange?: { min: number; max: number },
	isUpdate = false,
): PhaseInsertData {
	const data: PhaseInsertData = {
		exercise_id: exerciseId,
		sets: parsedData.sets,
		repetitions: parsedData.reps,
		weight: calculatedWeight,
	};

	if (parsedData.compoundReps) {
		data.compound_reps = parsedData.compoundReps;
	} else if (isUpdate) {
		data.compound_reps = null;
	}

	if (parsedData.weights) {
		data.weights = parsedData.weights;
	} else if (isUpdate) {
		data.weights = null;
	}

	data.exercise_type = parsedData.exerciseType || 'standard';

	if (parsedData.notes) {
		data.notes = parsedData.notes;
	} else if (isUpdate) {
		data.notes = null;
	}

	if (parsedData.targetRm) {
		data.target_rm = parsedData.targetRm;
	} else if (isUpdate) {
		data.target_rm = null;
	}

	if (parsedData.rirMin !== undefined) {
		data.rir_min = parsedData.rirMin;
		data.rir_max = parsedData.rirMax || parsedData.rirMin;
	} else if (isUpdate) {
		data.rir_min = null;
		data.rir_max = null;
	}

	if (parsedData.circuitExercises && parsedData.circuitExercises.length > 0) {
		data.circuit_exercises = parsedData.circuitExercises;
	} else if (isUpdate) {
		data.circuit_exercises = null;
	}

	if (weightRange) {
		data.weight_min = weightRange.min;
		data.weight_max = weightRange.max;
	} else if (isUpdate) {
		data.weight_min = null;
		data.weight_max = null;
	}

	if (parsedData.restTimeSeconds !== undefined) {
		data.rest_time_seconds = parsedData.restTimeSeconds;
	} else if (isUpdate) {
		data.rest_time_seconds = null;
	}

	if (parsedData.emomIntervalSeconds !== undefined) {
		data.emom_interval_seconds = parsedData.emomIntervalSeconds;
	} else if (isUpdate) {
		data.emom_interval_seconds = null;
	}

	return data;
}
