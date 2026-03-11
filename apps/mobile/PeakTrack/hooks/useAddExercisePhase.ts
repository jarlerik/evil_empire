import { useState, useCallback } from 'react';
import { parseSetInput } from '../lib/parseSetInput';
import { useExercisePhases } from './useExercisePhases';
import { useRmLookup, RmMatch } from './useRmLookup';

interface UseAddExercisePhaseProps {
	exerciseId: string | string[] | undefined;
	exerciseName: string;
	userId: string | undefined;
}

interface AddPhaseResult {
	success: boolean;
	error?: string;
	needsRm?: boolean;
	partialMatches?: RmMatch[];
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
		editingPhaseId: string | null,
		rmWeightOverride?: number,
		rmSourceName?: string,
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
			parsedData,
			rmWeightOverride,
			rmSourceName,
		);

		if (!weightResult.success) {
			setIsLoading(false);
			return {
				success: false,
				error: weightResult.error,
				needsRm: true,
				partialMatches: weightResult.partialMatches,
			};
		}

		const { weight, weightMin, weightMax, weights: calculatedWeights } = weightResult.weights;
		const weightRange = weightMin !== undefined && weightMax !== undefined
			? { min: weightMin, max: weightMax }
			: undefined;

		// Override parsedData.weights with calculated kg values if RM lookup converted percentages
		let finalParsedData = calculatedWeights
			? { ...parsedData, weights: calculatedWeights }
			: parsedData;

		// Add RM source note for percentage-based exercises
		if (parsedData.needsRmLookup && weightResult.weights.rmWeight) {
			const rmName = weightResult.weights.rmSourceName || exerciseName;
			const rmW = weightResult.weights.rmWeight;
			const pct = parsedData.weightPercentage;
			const pctMin = parsedData.weightMinPercentage;
			const pctMax = parsedData.weightMaxPercentage;

			let pctLabel: string;
			if (pctMin !== undefined && pctMax !== undefined) {
				pctLabel = `${pctMin}-${pctMax}%`;
			} else if (parsedData.weights && parsedData.weights.length > 1) {
				pctLabel = parsedData.weights.map(w => `${w}%`).join(', ');
			} else if (pct !== undefined) {
				pctLabel = `${pct}%`;
			} else {
				pctLabel = '';
			}

			const note = pctLabel
				? `${pctLabel} of ${rmName} 1RM (${rmW}kg)`
				: `${rmName} 1RM (${rmW}kg)`;

			finalParsedData = { ...finalParsedData, notes: note };
		}

		// For wave phases with per-phase percentages, resolve weights from RM
		if (finalParsedData.wavePhases && finalParsedData.needsRmLookup) {
			const rmWeight = weightResult.weights.rmWeight;
			const resolvedPhases = finalParsedData.wavePhases.map(phase => {
				if (phase.weightPercentage !== undefined && rmWeight) {
					return {
						...phase,
						weight: Math.round((rmWeight * phase.weightPercentage) / 100),
					};
				}
				return { ...phase, weight: weight };
			});
			finalParsedData = { ...finalParsedData, wavePhases: resolvedPhases };
		}

		let result: AddPhaseResult;

		if (editingPhaseId) {
			// Update existing phase
			result = await updatePhase(editingPhaseId, finalParsedData, weight, weightRange);
		} else {
			// Add new phase
			result = await addPhase(finalParsedData, weight, weightRange);
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
