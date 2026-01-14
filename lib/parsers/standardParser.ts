import { ParserResult, invalidResult, validResult } from './types';

/**
 * Pattern 1: Simple format "sets x reps @weightkg"
 * Example: "4 x 3 @50kg"
 */
export function parseStandard(cleanInput: string, restTimeSeconds?: number): ParserResult {
	// Skip if input contains "rir" (handled by RIR parser)
	if (cleanInput.includes('rir')) {
		return { matched: false };
	}

	// First check if there are multiple numbers after @ - if so, it's likely multiple weights
	const atIndex = cleanInput.indexOf('@');
	if (atIndex === -1) {
		return { matched: false };
	}

	const afterAtCheck = cleanInput.substring(atIndex + 1).trim();
	const numbersAfterAt = afterAtCheck.match(/\d+(?:\.\d+)?/g);
	const hasMultipleNumbers = numbersAfterAt && numbersAfterAt.length > 1;
	const hasKgInMiddle = /kg\s+\d/i.test(afterAtCheck);
	const hasKgAtEnd = /\d+\s*kg\s*$/i.test(afterAtCheck);

	// Only skip simple pattern if there are multiple numbers AND no "kg" (which indicates multiple weights)
	// Cases like "4 x 3 @50kg" should still match simple pattern
	if (hasMultipleNumbers && !hasKgInMiddle && !hasKgAtEnd) {
		return { matched: false };
	}

	// Standard simple pattern - requires "kg" unit
	const simpleMatch = cleanInput.match(/^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*kg/i);

	if (simpleMatch) {
		const sets = parseInt(simpleMatch[1]);
		const reps = parseInt(simpleMatch[2]);
		const weight = parseFloat(simpleMatch[3]);

		// Check if there's any trailing content that wasn't parsed as rest time
		// If there is, it's invalid (rest time requires unit)
		const afterKg = cleanInput.substring(cleanInput.indexOf('kg') + 2).trim();
		if (afterKg && restTimeSeconds === undefined) {
			// There's trailing content but no valid rest time parsed
			return {
				matched: true,
				data: invalidResult('Invalid format. Rest time requires a unit (s, m, sec, min, etc.). Use "4 x 3 @50kg 120s" or "4 x 3 @50kg 2m"')
			};
		}

		return {
			matched: true,
			data: validResult({
				sets,
				reps,
				weight,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	}

	return { matched: false };
}

/**
 * Pattern 1a: Absolute weight range format "sets x reps@85-89kg"
 * Example: "4 x 3 @85-89kg"
 */
export function parseWeightRange(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const weightRangePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*kg$/i;
	const match = cleanInput.match(weightRangePattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const minWeight = parseFloat(match[3]);
	const maxWeight = parseFloat(match[4]);

	// Validate weights are positive
	if (minWeight <= 0 || maxWeight <= 0) {
		return {
			matched: true,
			data: invalidResult('Weight must be positive')
		};
	}

	// Validate min <= max
	if (minWeight > maxWeight) {
		return {
			matched: true,
			data: invalidResult('Minimum weight must be less than or equal to maximum weight')
		};
	}

	return {
		matched: true,
		data: validResult({
			sets,
			reps,
			weight: minWeight, // Use min for backward compatibility
			weightMin: minWeight,
			weightMax: maxWeight,
			...(restTimeSeconds !== undefined && { restTimeSeconds })
		})
	};
}

/**
 * Pattern 1b: Multiple weights format "sets x reps @weight1 weight2 weight3...kg" or "...%"
 * Example: "3 x 1 @50 60 70kg"
 */
export function parseMultipleWeights(cleanInput: string, restTimeSeconds?: number): ParserResult {
	// Skip if input contains "rir" (handled by RIR parser)
	if (cleanInput.includes('rir')) {
		return { matched: false };
	}

	const multipleWeightsPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*((?:\d+(?:\.\d+)?\s+)+)(?:\d+(?:\.\d+)?)\s*(kg|%)\s*$/i;
	const match = cleanInput.match(multipleWeightsPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const unit = match[4]?.toLowerCase() || '';

	// Extract all numbers after @ (before unit)
	const atIndex = cleanInput.indexOf('@');
	const afterAt = cleanInput.substring(atIndex + 1).trim();
	const beforeUnit = afterAt.replace(/\s*(kg|%)\s*$/i, '').trim();

	// Split by whitespace and parse
	const weightStrings = beforeUnit.split(/\s+/);
	const weights = weightStrings.map(w => parseFloat(w));

	// Check for empty values (NaN from empty strings or invalid numbers)
	const hasEmptyValues = weightStrings.some(w => w.trim() === '' || isNaN(parseFloat(w)));
	if (hasEmptyValues) {
		return {
			matched: true,
			data: invalidResult('Invalid weight values. Please use numbers only.')
		};
	}

	// Filter out invalid weights and check if we have multiple
	const validWeights = weights.filter(w => !isNaN(w) && w > 0);

	// Only process as multiple weights if there are actually multiple weights
	if (validWeights.length <= 1) {
		return { matched: false };
	}

	// Validate that number of weights matches number of sets
	if (validWeights.length !== sets) {
		return {
			matched: true,
			data: invalidResult(`Expected ${sets} weights for ${sets} sets, but got ${validWeights.length}`)
		};
	}

	if (!validWeights.every(w => !isNaN(w) && w > 0)) {
		return {
			matched: true,
			data: invalidResult('Invalid weight values. Please use numbers only.')
		};
	}

	if (unit === 'kg') {
		return {
			matched: true,
			data: validResult({
				sets,
				reps,
				weight: validWeights[0], // Keep for backward compatibility
				weights: validWeights,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	} else if (unit === '%') {
		// Validate percentages are between 0 and 100
		if (validWeights.some(w => w <= 0 || w > 100)) {
			return {
				matched: true,
				data: invalidResult('Percentage must be between 0 and 100')
			};
		}
		// For percentage multiple weights, use the first one as weightPercentage
		return {
			matched: true,
			data: validResult({
				sets,
				reps,
				weight: 0, // Will be calculated after RM lookup
				weights: validWeights, // Store all percentages
				weightPercentage: validWeights[0], // Use first for backward compatibility
				needsRmLookup: true,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	}

	return { matched: false };
}
