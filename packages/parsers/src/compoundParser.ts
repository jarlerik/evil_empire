import { ParserResult, invalidResult, validResult } from './types';

/**
 * Pattern 0a: Compound format with percentage "sets x reps1 + reps2 (+ reps3 ...) @percentage%"
 * Also supports percentage range: "sets x reps1 + reps2 (+ reps3 ...) @70-85%"
 * Also supports RIR: "sets x reps1 + reps2 (+ reps3 ...) @RIRRIR"
 * Example: "4 x 2 + 2 @80%", "3 x 3 + 1 @70-85%", "4 x 2 + 2 @2RIR"
 */
export function parseCompoundPercentage(cleanInput: string, restTimeSeconds?: number): ParserResult {
	// Try percentage range first (more specific)
	const compoundPercentageRangePattern = /^([1-9]\d*)\s*x\s*((?:[1-9]\d*)(?:\s*\+\s*[1-9]\d*)+)\s*@\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%$/i;
	const rangeMatch = cleanInput.match(compoundPercentageRangePattern);

	if (rangeMatch) {
		const sets = parseInt(rangeMatch[1]);
		const repsSequence = rangeMatch[2];
		const minPercentage = parseFloat(rangeMatch[3]);
		const maxPercentage = parseFloat(rangeMatch[4]);

		const repsParts = repsSequence
			.split('+')
			.map(r => r.trim())
			.map(r => parseInt(r, 10))
			.filter(r => !isNaN(r) && r > 0);

		if (repsParts.length < 2) {
			return { matched: false };
		}

		const totalReps = repsParts.reduce((sum, r) => sum + r, 0);

		if (minPercentage <= 0 || minPercentage > 100 || maxPercentage <= 0 || maxPercentage > 100) {
			return {
				matched: true,
				data: invalidResult('Percentage must be between 0 and 100'),
			};
		}

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
				reps: totalReps,
				weight: 0,
				weightMinPercentage: minPercentage,
				weightMaxPercentage: maxPercentage,
				needsRmLookup: true,
				compoundReps: repsParts,
				...(restTimeSeconds !== undefined && { restTimeSeconds }),
			}),
		};
	}

	// Try multiple percentages (comma or space separated): "3 x 1 + 1@75, 78, 78%"
	const compoundMultiPercentPattern = /^([1-9]\d*)\s*x\s*((?:[1-9]\d*)(?:\s*\+\s*[1-9]\d*)+)\s*@\s*((?:\d+(?:\.\d+)?[\s,]+)+\d+(?:\.\d+)?)\s*%$/i;
	const multiMatch = cleanInput.match(compoundMultiPercentPattern);

	if (multiMatch) {
		const sets = parseInt(multiMatch[1]);
		const repsSequence = multiMatch[2];
		const percentagesStr = multiMatch[3];

		const repsParts = repsSequence
			.split('+')
			.map(r => r.trim())
			.map(r => parseInt(r, 10))
			.filter(r => !isNaN(r) && r > 0);

		if (repsParts.length < 2) {
			return { matched: false };
		}

		const totalReps = repsParts.reduce((sum, r) => sum + r, 0);

		const percentages = percentagesStr
			.split(/[\s,]+/)
			.filter(s => s.trim() !== '')
			.map(s => parseFloat(s));

		if (percentages.length <= 1 || percentages.some(p => isNaN(p))) {
			return { matched: false };
		}

		if (percentages.length > sets) {
			return {
				matched: true,
				data: invalidResult(`Too many percentages: got ${percentages.length} for ${sets} sets`),
			};
		}

		// Pad with the last value if fewer percentages than sets
		while (percentages.length < sets) {
			percentages.push(percentages[percentages.length - 1]);
		}

		if (percentages.some(p => p <= 0 || p > 100)) {
			return {
				matched: true,
				data: invalidResult('Percentage must be between 0 and 100'),
			};
		}

		return {
			matched: true,
			data: validResult({
				sets,
				reps: totalReps,
				weight: 0,
				weights: percentages,
				weightPercentage: percentages[0],
				needsRmLookup: true,
				compoundReps: repsParts,
				...(restTimeSeconds !== undefined && { restTimeSeconds }),
			}),
		};
	}

	const compoundPercentagePattern = /^([1-9]\d*)\s*x\s*((?:[1-9]\d*)(?:\s*\+\s*[1-9]\d*)+)\s*@\s*(\d+(?:\.\d+)?)\s*(%|rir)$/i;
	const match = cleanInput.match(compoundPercentagePattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const repsSequence = match[2];
	const value = parseFloat(match[3]);
	const unit = match[4]?.toLowerCase() || '';

	const repsParts = repsSequence
		.split('+')
		.map(r => r.trim())
		.map(r => parseInt(r, 10))
		.filter(r => !isNaN(r) && r > 0);

	if (repsParts.length < 2) {
		return { matched: false };
	}

	const totalReps = repsParts.reduce((sum, r) => sum + r, 0);

	if (unit === '%') {
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
				reps: totalReps, // Total reps for display
				weight: 0, // Will be calculated after RM lookup
				weightPercentage: value,
				needsRmLookup: true,
				compoundReps: repsParts,
				...(restTimeSeconds !== undefined && { restTimeSeconds }),
			}),
		};
	} else if (unit === 'rir') {
		// RIR format for compound exercises
		return {
			matched: true,
			data: validResult({
				sets,
				reps: totalReps, // Total reps for display
				weight: 0,
				exerciseType: 'standard',
				compoundReps: repsParts,
				rirMin: value,
				rirMax: value,
				...(restTimeSeconds !== undefined && { restTimeSeconds }),
			}),
		};
	}

	return { matched: false };
}

/**
 * Pattern 2: Compound format with 2+ rep parts "sets x reps1 + reps2 (+ reps3 ...) @weightkg"
 * Example: "4 x 2 + 2 @50kg"
 */
export function parseCompoundWeight(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const compoundPattern = /^([1-9]\d*)\s*x\s*((?:[1-9]\d*)(?:\s*\+\s*[1-9]\d*)+)\s*@\s*(\d+(?:\.\d+)?)\s*kg$/i;
	const match = cleanInput.match(compoundPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const repsSequence = match[2];
	const weight = parseFloat(match[3]);

	const repsParts = repsSequence
		.split('+')
		.map(r => r.trim())
		.map(r => parseInt(r, 10))
		.filter(r => !isNaN(r) && r > 0);

	if (repsParts.length < 2) {
		return {
			matched: true,
			data: invalidResult('Invalid compound format. Use "sets x a + b + ... @weight"'),
		};
	}

	const totalReps = repsParts.reduce((sum, r) => sum + r, 0);

	return {
		matched: true,
		data: validResult({
			sets,
			reps: totalReps, // Total reps for display
			weight,
			compoundReps: repsParts,
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}
