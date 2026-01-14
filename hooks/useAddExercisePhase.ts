import { useState, useCallback } from 'react';
import { parseSetInput, ParsedSetData } from '../lib/parseSetInput';
import { useExercisePhases } from './useExercisePhases';
import { useRmLookup } from './useRmLookup';

interface UseAddExercisePhaseProps {
	exerciseId: string | string[] | undefined;
	exerciseName: string;
	userId: string | undefined;
}

interface AddPhaseResult {
	success: boolean;
	error?: string;
}

export function useAddExercisePhase({
	exerciseId,
	exerciseName,
	userId,
}: UseAddExercisePhaseProps) {
	const [isLoading, setIsLoading] = useState(false);
	const { calculateWeightsFromParsedData } = useRmLookup();
	const {
		exercisePhases,
		addPhase,
		updatePhase,
		deletePhase,
		fetchExercisePhases,
	} = useExercisePhases({ exerciseId });

	const addExercisePhase = useCallback(async (
		setInput: string,
		editingPhaseId: string | null
	): Promise<AddPhaseResult> => {
		const parsedData = parseSetInput(setInput);

		if (!parsedData.isValid) {
			return {
				success: false,
				error: parsedData.errorMessage || 'Invalid input format',
			};
		}

		if (!exerciseId || !userId) {
			return { success: false, error: 'Missing exercise or user' };
		}

		setIsLoading(true);

		// Calculate weights (handles RM lookup if needed)
		const weightResult = await calculateWeightsFromParsedData(
			userId,
			exerciseName,
			parsedData
		);

		if (!weightResult.success) {
			setIsLoading(false);
			return { success: false, error: weightResult.error };
		}

		const { weight, weightMin, weightMax } = weightResult.weights;
		const weightRange = weightMin !== undefined && weightMax !== undefined
			? { min: weightMin, max: weightMax }
			: undefined;

		let result: AddPhaseResult;

		if (editingPhaseId) {
			// Update existing phase
			result = await updatePhase(editingPhaseId, parsedData, weight, weightRange);
		} else {
			// Add new phase
			result = await addPhase(parsedData, weight, weightRange);
		}

		setIsLoading(false);
		return result;
	}, [exerciseId, exerciseName, userId, calculateWeightsFromParsedData, addPhase, updatePhase]);

	return {
		exercisePhases,
		isLoading,
		addExercisePhase,
		deletePhase,
		fetchExercisePhases,
	};
}
