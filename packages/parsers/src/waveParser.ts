import { ParserResult, invalidResult, validResult } from './types';

/**
 * Pattern 3: Wave format "reps1-reps2-reps3... weightkg" or "weight%"
 * Example: "3-2-1-1-1 65kg", "3-2-1 80%", "3-2-1-3-2-1@70, 75%", "3-2-1-3-2-1 70, 75kg"
 */
export function parseWave(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const wavePattern = /^(\d+(?:\s*-\s*\d+)+)(?:\s+@?|@)(\d+(?:\.\d+)?(?:[\s,]+\d+(?:\.\d+)?)*)\s*(kg|lbs|%)$/i;
	const match = cleanInput.match(wavePattern);

	if (!match) {
		return { matched: false };
	}

	const repsStr = match[1];
	const valuesStr = match[2];
	const unit = match[3]?.toLowerCase() || '';

	// Parse all weight/percentage values (comma or space separated)
	const values = valuesStr.split(/[\s,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));

	// Validate all values are positive
	if (!values.every(v => !isNaN(v) && v > 0)) {
		return {
			matched: true,
			data: invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")'),
		};
	}

	// Parse wave reps (split by hyphens)
	const waveReps = repsStr.split('-').map(r => parseInt(r.trim()));

	// Validate that all reps are valid numbers
	if (!waveReps.every(r => !isNaN(r) && r > 0)) {
		return {
			matched: true,
			data: invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")'),
		};
	}

	// For multiple values, validate they evenly divide the reps
	if (values.length > 1) {
		if (waveReps.length % values.length !== 0) {
			return {
				matched: true,
				data: invalidResult(`Wave has ${waveReps.length} sets but ${values.length} weights — weights must evenly divide sets.`),
			};
		}
	}

	const repsPerValue = values.length > 1 ? waveReps.length / values.length : waveReps.length;

	if (unit === 'kg' || unit === 'lbs') {
		return {
			matched: true,
			data: validResult({
				sets: waveReps.length,
				reps: waveReps[0],
				weight: values[0],
				compoundReps: waveReps,
				exerciseType: 'wave',
				...(values.length > 1 && { weights: values }),
				...(restTimeSeconds !== undefined && { restTimeSeconds }),
			}),
		};
	} else if (unit === '%') {
		// Validate all percentages are between 0 and 200
		if (!values.every(v => v > 0 && v <= 200)) {
			return {
				matched: true,
				data: invalidResult('Percentage must be between 0 and 200'),
			};
		}

		return {
			matched: true,
			data: validResult({
				sets: waveReps.length,
				reps: waveReps[0],
				weight: 0,
				compoundReps: waveReps,
				exerciseType: 'wave',
				weights: values,
				weightPercentage: values[0],
				needsRmLookup: true,
				...(restTimeSeconds !== undefined && { restTimeSeconds }),
			}),
		};
	}

	return { matched: false };
}
