import { useState, useEffect, useCallback } from 'react';
import { ExercisePhase } from '@evil-empire/parsers';
import { ParsedSetData } from '@evil-empire/parsers';
import { buildPhaseData } from '@evil-empire/peaktrack-services';
import { fetchPhasesByExerciseId, insertPhase, updatePhase as updatePhaseService, deletePhase as deletePhaseService } from '@evil-empire/peaktrack-services';
import { useUserSettings } from '../contexts/UserSettingsContext';

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

export function useExercisePhases({ exerciseId }: UseExercisePhasesProps): UseExercisePhasesReturn {
	const [exercisePhases, setExercisePhases] = useState<ExercisePhase[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const { settings } = useUserSettings();
	const defaultRestSeconds = settings?.default_rest_seconds ?? null;

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

		const insertData = buildPhaseData(exerciseIdStr, parsedData, calculatedWeight, weightRange, false, defaultRestSeconds);

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
	}, [exerciseId, fetchExercisePhases, defaultRestSeconds]);

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
		const updateData = buildPhaseData(exerciseIdStr, parsedData, calculatedWeight, weightRange, true, defaultRestSeconds);

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
	}, [exerciseId, fetchExercisePhases, defaultRestSeconds]);

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
