import { ParserResult, invalidResult, validResult } from './types';

/**
 * Pattern 3: Wave format "reps1-reps2-reps3... weightkg" or "weight%"
 * Example: "3-2-1-1-1 65kg", "3-2-1 80%"
 */
export function parseWave(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const wavePattern = /^((?:\d+\s*\-?\s*)+)\s+(\d+(?:\.\d+)?)\s*(kg|%)$/i;
	const match = cleanInput.match(wavePattern);

	if (!match) {
		return { matched: false };
	}

	const repsStr = match[1];
	const value = parseFloat(match[2]);
	const unit = match[3]?.toLowerCase() || '';

	// Validate value is positive
	if (value <= 0) {
		return {
			matched: true,
			data: invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")')
		};
	}

	// Parse wave reps (split by hyphens)
	const waveReps = repsStr.split('-').map(r => parseInt(r.trim()));

	// Validate that all reps are valid numbers
	if (!waveReps.every(r => !isNaN(r) && r > 0)) {
		return {
			matched: true,
			data: invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")')
		};
	}

	if (unit === 'kg') {
		// Create individual phases for each set in the wave
		const wavePhases = waveReps.map((reps) => ({
			sets: 1,
			reps,
			weight: value // All phases get the same weight
		}));

		return {
			matched: true,
			data: validResult({
				sets: waveReps.length,
				reps: waveReps[0], // First rep count for backward compatibility
				weight: value,
				wavePhases,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	} else if (unit === '%') {
		// Validate percentage is between 0 and 100
		if (value <= 0 || value > 100) {
			return {
				matched: true,
				data: invalidResult('Percentage must be between 0 and 100')
			};
		}

		// Create individual phases for each set in the wave
		const wavePhases = waveReps.map((reps) => ({
			sets: 1,
			reps,
			weight: 0 // Will be calculated after RM lookup
		}));

		return {
			matched: true,
			data: validResult({
				sets: waveReps.length,
				reps: waveReps[0], // First rep count for backward compatibility
				weight: 0, // Will be calculated after RM lookup
				wavePhases,
				weightPercentage: value,
				needsRmLookup: true,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	}

	return { matched: false };
}
