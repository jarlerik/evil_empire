import { useState, useEffect, useCallback } from 'react';
import { ExercisePhase } from '../lib/formatExercisePhase';
import { ParsedSetData } from '../lib/parseSetInput';
import {
	fetchPhasesByExerciseId,
	insertPhase,
	updatePhase as updatePhaseService,
	deletePhase as deletePhaseService,
	PhaseInsertData,
} from '../services/exercisePhaseService';

interface UseExercisePhasesProps {
	exerciseId: string | string[] | undefined;
}

interface UseExercisePhasesReturn {
	exercisePhases: ExercisePhase[];
	isLoading: boolean;
	fetchExercisePhases: () => Promise<void>;
	addPhase: (
		parsedData: ParsedSetData,
		calculatedWeight: number,
		weightRange?: { min: number; max: number }
	) => Promise<{ success: boolean; error?: string }>;
	updatePhase: (
		phaseId: string,
		parsedData: ParsedSetData,
		calculatedWeight: number,
		weightRange?: { min: number; max: number }
	) => Promise<{ success: boolean; error?: string }>;
	deletePhase: (phaseId: string) => Promise<{ success: boolean; error?: string }>;
}

function buildPhaseData(
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

	// Add compound_reps if it's a compound exercise
	if (parsedData.compoundReps) {
		data.compound_reps = parsedData.compoundReps;
	} else if (isUpdate) {
		data.compound_reps = null;
	}

	// Add weights array if multiple weights are specified
	if (parsedData.weights) {
		data.weights = parsedData.weights;
	} else if (isUpdate) {
		data.weights = null;
	}

	// Add exercise type
	data.exercise_type = parsedData.exerciseType || 'standard';

	// Add notes if present
	if (parsedData.notes) {
		data.notes = parsedData.notes;
	} else if (isUpdate) {
		data.notes = null;
	}

	// Add target RM if present
	if (parsedData.targetRm) {
		data.target_rm = parsedData.targetRm;
	} else if (isUpdate) {
		data.target_rm = null;
	}

	// Add RIR values if present
	if (parsedData.rirMin !== undefined) {
		data.rir_min = parsedData.rirMin;
		data.rir_max = parsedData.rirMax || parsedData.rirMin;
	} else if (isUpdate) {
		data.rir_min = null;
		data.rir_max = null;
	}

	// Add circuit exercises if present
	if (parsedData.circuitExercises && parsedData.circuitExercises.length > 0) {
		data.circuit_exercises = parsedData.circuitExercises;
	} else if (isUpdate) {
		data.circuit_exercises = null;
	}

	// Add weight ranges if present
	if (weightRange) {
		data.weight_min = weightRange.min;
		data.weight_max = weightRange.max;
	} else if (isUpdate) {
		data.weight_min = null;
		data.weight_max = null;
	}

	// Add rest time if present
	if (parsedData.restTimeSeconds !== undefined) {
		data.rest_time_seconds = parsedData.restTimeSeconds;
	} else if (isUpdate) {
		data.rest_time_seconds = null;
	}

	// Add EMOM interval if present
	if (parsedData.emomIntervalSeconds !== undefined) {
		data.emom_interval_seconds = parsedData.emomIntervalSeconds;
	} else if (isUpdate) {
		data.emom_interval_seconds = null;
	}

	return data;
}

export function useExercisePhases({ exerciseId }: UseExercisePhasesProps): UseExercisePhasesReturn {
	const [exercisePhases, setExercisePhases] = useState<ExercisePhase[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const fetchExercisePhases = useCallback(async () => {
		if (!exerciseId) {return;}

		const exerciseIdStr = Array.isArray(exerciseId) ? exerciseId[0] : exerciseId;
		const { data, error } = await fetchPhasesByExerciseId(exerciseIdStr);

		if (!error && data) {
			setExercisePhases(data);
		}
	}, [exerciseId]);

	useEffect(() => {
		if (exerciseId) {
			fetchExercisePhases();
		}
	}, [exerciseId, fetchExercisePhases]);

	const addPhase = useCallback(async (
		parsedData: ParsedSetData,
		calculatedWeight: number,
		weightRange?: { min: number; max: number },
	): Promise<{ success: boolean; error?: string }> => {
		if (!exerciseId) {
			return { success: false, error: 'Database not available' };
		}

		setIsLoading(true);

		const exerciseIdStr = Array.isArray(exerciseId) ? exerciseId[0] : exerciseId;

		// Handle wave phases separately
		if (parsedData.wavePhases) {
			for (const phase of parsedData.wavePhases) {
				const phaseData: PhaseInsertData = {
					exercise_id: exerciseIdStr,
					sets: phase.sets,
					repetitions: phase.reps,
					weight: phase.weight,
				};

				if (parsedData.restTimeSeconds !== undefined) {
					phaseData.rest_time_seconds = parsedData.restTimeSeconds;
				}

				const { error: phaseError } = await insertPhase(phaseData);

				if (phaseError) {
					setIsLoading(false);
					return {
						success: false,
						error: 'Error adding wave phase: ' + phaseError,
					};
				}
			}

			await fetchExercisePhases();
			setIsLoading(false);
			return { success: true };
		}

		const insertData = buildPhaseData(exerciseIdStr, parsedData, calculatedWeight, weightRange, false);

		const { error } = await insertPhase(insertData);

		if (error) {
			setIsLoading(false);
			return {
				success: false,
				error: 'Error adding phase: ' + error,
			};
		}

		await fetchExercisePhases();
		setIsLoading(false);
		return { success: true };
	}, [exerciseId, fetchExercisePhases]);

	const updatePhase = useCallback(async (
		phaseId: string,
		parsedData: ParsedSetData,
		calculatedWeight: number,
		weightRange?: { min: number; max: number },
	): Promise<{ success: boolean; error?: string }> => {
		if (!exerciseId) {
			return { success: false, error: 'Database not available' };
		}

		setIsLoading(true);

		const exerciseIdStr = Array.isArray(exerciseId) ? exerciseId[0] : exerciseId;
		const updateData = buildPhaseData(exerciseIdStr, parsedData, calculatedWeight, weightRange, true);

		// Remove exercise_id from update data as it shouldn't be updated
		const { exercise_id: _, ...dataWithoutExerciseId } = updateData;

		const { error } = await updatePhaseService(phaseId, dataWithoutExerciseId);

		if (error) {
			setIsLoading(false);
			return { success: false, error: 'Error updating phase' };
		}

		await fetchExercisePhases();
		setIsLoading(false);
		return { success: true };
	}, [exerciseId, fetchExercisePhases]);

	const deletePhase = useCallback(async (phaseId: string): Promise<{ success: boolean; error?: string }> => {
		const { error } = await deletePhaseService(phaseId);

		if (error) {
			return { success: false, error: 'Error deleting phase' };
		}

		await fetchExercisePhases();
		return { success: true };
	}, [fetchExercisePhases]);

	return {
		exercisePhases,
		isLoading,
		fetchExercisePhases,
		addPhase,
		updatePhase,
		deletePhase,
	};
}
