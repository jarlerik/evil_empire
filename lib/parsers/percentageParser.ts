import { ParserResult, invalidResult, validResult } from './types';

/**
 * Pattern 0b: Percentage range format "sets x reps@80-85%"
 * Example: "4 x 3 @80-85%"
 * Must be checked BEFORE simple percentage
 */
export function parsePercentageRange(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const percentageRangePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%$/i;
	const match = cleanInput.match(percentageRangePattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const minPercentage = parseFloat(match[3]);
	const maxPercentage = parseFloat(match[4]);

	// Validate percentages are between 0 and 100
	if (minPercentage <= 0 || minPercentage > 100 || maxPercentage <= 0 || maxPercentage > 100) {
		return {
			matched: true,
			data: invalidResult('Percentage must be between 0 and 100'),
		};
	}

	// Validate min <= max
	if (minPercentage > maxPercentage) {
		return {
			matched: true,
			data: invalidResult('Minimum percentage must be less than or equal to maximum percentage'),
		};
	}

	return {
		matched: true,
		data: validResult({
			sets,
			reps,
			weight: 0, // Will be calculated after RM lookup
			weightMinPercentage: minPercentage,
			weightMaxPercentage: maxPercentage,
			needsRmLookup: true,
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}

/**
 * Pattern 0c: Simple percentage format "sets x reps@80%"
 * Example: "4 x 3 @80%"
 * Must be checked AFTER compound percentage and percentage range
 */
export function parseSimplePercentage(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const percentagePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*%$/i;
	const match = cleanInput.match(percentagePattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const value = parseFloat(match[3]);

	// Validate percentage is between 0 and 100
	if (value <= 0 || value > 100) {
		return {
			matched: true,
			data: invalidResult('Percentage must be between 0 and 100'),
		};
	}

	return {
		matched: true,
		data: validResult({
			sets,
			reps,
			weight: 0, // Will be calculated after RM lookup
			weightPercentage: value,
			needsRmLookup: true,
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}
