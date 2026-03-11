import { lookupExactRm, fetchAllRmsByReps } from '../services/repetitionMaximumService';

export interface RmMatch {
	exerciseName: string;
	weight: number;
}

interface RmLookupResult {
	weight: number;
	found: boolean;
	error?: string;
	partialMatches?: RmMatch[];
}

interface CalculatedWeights {
	weight: number;
	weightMin?: number;
	weightMax?: number;
	weights?: number[];
	rmWeight?: number; // Raw 1RM weight used for calculations
}

export interface CalculateWeightsResult {
	success: boolean;
	weights: CalculatedWeights;
	error?: string;
	partialMatches?: RmMatch[];
}

export function useRmLookup() {
	/**
	 * Look up the 1RM for an exercise
	 * Returns exact match, or partial matches for user selection (never auto-selects)
	 */
	const lookupRm = async (
		userId: string,
		exerciseName: string,
	): Promise<RmLookupResult> => {
		// First, try exact match on exercise name
		const { data: rmData, error: rmError } = await lookupExactRm(userId, exerciseName, 1);

		const foundWeight: number | null = rmData?.weight ?? null;

		if (!rmError && foundWeight) {
			return { weight: foundWeight, found: true };
		}

		// No exact match — find partial matches for compound exercises
		const partialMatches: RmMatch[] = [];

		if (exerciseName.includes('+')) {
			const { data: allRms, error: allRmsError } = await fetchAllRmsByReps(userId, 1);

			if (!allRmsError && allRms && allRms.length > 0) {
				const exerciseParts = exerciseName.split('+').map(part => part.trim().toLowerCase());
				const seen = new Set<string>();

				for (const rm of allRms) {
					const rmNameLower = rm.exercise_name.toLowerCase();
					if (seen.has(rmNameLower)) {continue;}

					for (const part of exerciseParts) {
						if (rmNameLower.includes(part) || part.includes(rmNameLower)) {
							seen.add(rmNameLower);
							partialMatches.push({
								exerciseName: rm.exercise_name,
								weight: rm.weight,
							});
							break;
						}
					}
				}
			}
		}

		return {
			weight: 0,
			found: false,
			error: `No 1RM found for "${exerciseName}".`,
			partialMatches: partialMatches.length > 0 ? partialMatches : undefined,
		};
	};

	/**
	 * Calculate weight from percentage based on 1RM
	 */
	const calculateWeightFromPercentage = (
		rmWeight: number,
		percentage: number,
	): number => {
		return Math.round((rmWeight * percentage) / 100);
	};

	/**
	 * Apply an RM weight to parsed percentage data
	 */
	const applyRmWeight = (
		rmWeight: number,
		parsedData: {
			weight: number;
			weights?: number[];
			weightPercentage?: number;
			weightMinPercentage?: number;
			weightMaxPercentage?: number;
			weightMin?: number;
			weightMax?: number;
		},
	): { success: true; weights: CalculatedWeights } => {
		let calculatedWeight = parsedData.weight;
		let calculatedWeightMin: number | undefined;
		let calculatedWeightMax: number | undefined;
		let calculatedWeights: number[] | undefined;

		// Handle multiple per-set percentages (e.g., weights: [75, 78, 78] from "3 x 1 + 1@75, 78, 78%")
		if (parsedData.weights && parsedData.weights.length > 1) {
			calculatedWeights = parsedData.weights.map(p => calculateWeightFromPercentage(rmWeight, p));
			calculatedWeight = calculatedWeights[0];
		}
		// Handle percentage ranges
		else if (parsedData.weightMinPercentage !== undefined && parsedData.weightMaxPercentage !== undefined) {
			calculatedWeightMin = calculateWeightFromPercentage(rmWeight, parsedData.weightMinPercentage);
			calculatedWeightMax = calculateWeightFromPercentage(rmWeight, parsedData.weightMaxPercentage);
			calculatedWeight = calculatedWeightMin;
		} else if (parsedData.weightPercentage !== undefined) {
			calculatedWeight = calculateWeightFromPercentage(rmWeight, parsedData.weightPercentage);
		}

		// Handle absolute weight ranges
		if (parsedData.weightMin !== undefined && parsedData.weightMax !== undefined) {
			calculatedWeightMin = parsedData.weightMin;
			calculatedWeightMax = parsedData.weightMax;
			calculatedWeight = calculatedWeightMin;
		}

		return {
			success: true,
			weights: {
				weight: calculatedWeight,
				weightMin: calculatedWeightMin,
				weightMax: calculatedWeightMax,
				...(calculatedWeights && { weights: calculatedWeights }),
				rmWeight,
			},
		};
	};

	/**
	 * Calculate weights from parsed data that needs RM lookup
	 */
	const calculateWeightsFromParsedData = async (
		userId: string,
		exerciseName: string,
		parsedData: {
			weight: number;
			weights?: number[];
			needsRmLookup?: boolean;
			weightPercentage?: number;
			weightMinPercentage?: number;
			weightMaxPercentage?: number;
			weightMin?: number;
			weightMax?: number;
		},
		rmWeightOverride?: number,
	): Promise<CalculateWeightsResult> => {
		if (parsedData.needsRmLookup) {
			// If caller provided a specific RM weight, use it directly
			if (rmWeightOverride !== undefined) {
				return applyRmWeight(rmWeightOverride, parsedData);
			}

			const rmResult = await lookupRm(userId, exerciseName);

			if (!rmResult.found) {
				return {
					success: false,
					weights: { weight: 0 },
					error: rmResult.error,
					partialMatches: rmResult.partialMatches,
				};
			}

			return applyRmWeight(rmResult.weight, parsedData);
		}

		// No RM lookup needed — handle absolute weight ranges
		let calculatedWeight = parsedData.weight;
		let calculatedWeightMin: number | undefined;
		let calculatedWeightMax: number | undefined;

		if (parsedData.weightMin !== undefined && parsedData.weightMax !== undefined) {
			calculatedWeightMin = parsedData.weightMin;
			calculatedWeightMax = parsedData.weightMax;
			calculatedWeight = calculatedWeightMin;
		}

		return {
			success: true,
			weights: {
				weight: calculatedWeight,
				weightMin: calculatedWeightMin,
				weightMax: calculatedWeightMax,
			},
		};
	};

	return {
		lookupRm,
		calculateWeightFromPercentage,
		calculateWeightsFromParsedData,
	};
}
