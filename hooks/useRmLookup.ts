import { supabase } from '../lib/supabase';

interface RmLookupResult {
	weight: number;
	found: boolean;
	error?: string;
}

interface CalculatedWeights {
	weight: number;
	weightMin?: number;
	weightMax?: number;
}

export function useRmLookup() {
	/**
	 * Look up the 1RM for an exercise
	 * Supports exact match and compound exercise fallback matching
	 */
	const lookupRm = async (
		userId: string,
		exerciseName: string
	): Promise<RmLookupResult> => {
		if (!supabase) {
			return { weight: 0, found: false, error: 'Database not available' };
		}

		// First, try exact match on exercise name
		let { data: rmData, error: rmError } = await supabase
			.from('repetition_maximums')
			.select('weight')
			.eq('user_id', userId)
			.ilike('exercise_name', exerciseName.trim())
			.eq('reps', 1) // Always use 1RM for percentage calculations
			.order('date', { ascending: false })
			.limit(1)
			.maybeSingle();

		// If no exact match, try to find a matching base exercise
		// For compound exercises like "Muscle clean + Push press...", look for "Clean" in existing RMs
		if ((rmError || !rmData) && exerciseName.includes('+')) {
			// Get all user's 1RMs to search for partial matches
			const { data: allRms, error: allRmsError } = await supabase
				.from('repetition_maximums')
				.select('exercise_name, weight')
				.eq('user_id', userId)
				.eq('reps', 1)
				.order('date', { ascending: false });

			if (!allRmsError && allRms && allRms.length > 0) {
				// Split compound exercise name by '+' and check each part
				const exerciseParts = exerciseName.split('+').map(part => part.trim().toLowerCase());

				// Find the first RM where the exercise name is contained in any part of the compound exercise
				// or where any part of the compound exercise is contained in the RM exercise name
				for (const rm of allRms) {
					const rmNameLower = rm.exercise_name.toLowerCase();

					// Check if any part of the compound exercise matches the RM name
					for (const part of exerciseParts) {
						// Check if RM name contains the part (e.g., "Clean" in "Muscle clean")
						// or if the part contains the RM name (e.g., "clean" contains "clean")
						if (rmNameLower.includes(part) || part.includes(rmNameLower)) {
							rmData = { weight: rm.weight };
							rmError = null;
							break;
						}
					}

					if (rmData) break;
				}
			}
		}

		if (rmError || !rmData) {
			return {
				weight: 0,
				found: false,
				error: `No 1RM found for "${exerciseName}". Please set your 1RM first.`
			};
		}

		return { weight: rmData.weight, found: true };
	};

	/**
	 * Calculate weight from percentage based on 1RM
	 */
	const calculateWeightFromPercentage = (
		rmWeight: number,
		percentage: number
	): number => {
		return Math.round((rmWeight * percentage) / 100);
	};

	/**
	 * Calculate weights from parsed data that needs RM lookup
	 */
	const calculateWeightsFromParsedData = async (
		userId: string,
		exerciseName: string,
		parsedData: {
			weight: number;
			needsRmLookup?: boolean;
			weightPercentage?: number;
			weightMinPercentage?: number;
			weightMaxPercentage?: number;
			weightMin?: number;
			weightMax?: number;
		}
	): Promise<{ success: boolean; weights: CalculatedWeights; error?: string }> => {
		let calculatedWeight = parsedData.weight;
		let calculatedWeightMin: number | undefined = undefined;
		let calculatedWeightMax: number | undefined = undefined;

		if (parsedData.needsRmLookup) {
			const rmResult = await lookupRm(userId, exerciseName);

			if (!rmResult.found) {
				return {
					success: false,
					weights: { weight: 0 },
					error: rmResult.error
				};
			}

			// Handle percentage ranges
			if (parsedData.weightMinPercentage !== undefined && parsedData.weightMaxPercentage !== undefined) {
				calculatedWeightMin = calculateWeightFromPercentage(rmResult.weight, parsedData.weightMinPercentage);
				calculatedWeightMax = calculateWeightFromPercentage(rmResult.weight, parsedData.weightMaxPercentage);
				calculatedWeight = calculatedWeightMin; // Use min for backward compatibility
			} else if (parsedData.weightPercentage !== undefined) {
				// Single percentage
				calculatedWeight = calculateWeightFromPercentage(rmResult.weight, parsedData.weightPercentage);
			}
		}

		// Handle absolute weight ranges (already calculated, just need to store)
		if (parsedData.weightMin !== undefined && parsedData.weightMax !== undefined) {
			calculatedWeightMin = parsedData.weightMin;
			calculatedWeightMax = parsedData.weightMax;
			calculatedWeight = calculatedWeightMin; // Use min for backward compatibility
		}

		return {
			success: true,
			weights: {
				weight: calculatedWeight,
				weightMin: calculatedWeightMin,
				weightMax: calculatedWeightMax
			}
		};
	};

	return {
		lookupRm,
		calculateWeightFromPercentage,
		calculateWeightsFromParsedData,
	};
}
