export interface ParsedSetData {
	sets: number;
	reps: number;
	weight: number;
	weights?: number[]; // For multiple weights (e.g., [50, 60, 70])
	wavePhases?: Array<{sets: number, reps: number, weight: number}>; // For wave exercises
	isValid: boolean;
	errorMessage?: string; // Error message when parsing fails
	compoundReps?: number[]; // For compound exercises like "2 + 2"
}

/**
 * Parses a string input in the format "sets x reps @weight" or "sets x reps @weightkg"
 * Also supports compound exercises like "sets x reps1 + reps2 @weight"
 * @param input - The input string to parse (e.g., "4 x 3 @50kg" or "4 x 2 + 2@50kg")
 * @returns ParsedSetData object with parsed values and validity status
 */
export function parseSetInput(input: string): ParsedSetData {
	// Handle empty or whitespace-only input
	if (!input || !input.trim()) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Please enter a valid format (e.g., "3 x 5 @50kg")'
		};
	}

	// Remove any extra spaces and convert to lowercase for easier parsing
	const cleanInput = input.trim().toLowerCase();
	
	// Pattern 1: Simple format "sets x reps @weight" or "sets x reps @weightkg"
	const simplePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*(?:kg)?$/i;
	const simpleMatch = cleanInput.match(simplePattern);
	
	if (simpleMatch) {
		const sets = parseInt(simpleMatch[1]);
		const reps = parseInt(simpleMatch[2]);
		const weight = parseFloat(simpleMatch[3]);
		
		return {
			sets,
			reps,
			weight,
			isValid: true
		};
	}
	
	// Pattern 1b: Multiple weights format "sets x reps @weight1 weight2 weight3..."
	const multipleWeightsPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*((?:\d+(?:\.\d+)?\s*)+)(?:\s*kg)?$/i;
	const multipleWeightsMatch = cleanInput.match(multipleWeightsPattern);
	
	if (multipleWeightsMatch) {
		const sets = parseInt(multipleWeightsMatch[1]);
		const reps = parseInt(multipleWeightsMatch[2]);
		const weightsStr = multipleWeightsMatch[3];
		
		// Parse multiple weights
		const weights = weightsStr.trim().split(/\s+/).map(w => parseFloat(w));
		
		// Only process as multiple weights if there are actually multiple weights
		if (weights.length > 1) {
			// Validate that number of weights matches number of sets
			if (weights.length === sets && weights.every(w => !isNaN(w) && w > 0)) {
				return {
					sets,
					reps,
					weight: weights[0], // Keep for backward compatibility
					weights,
					isValid: true
				};
			} else if (weights.length !== sets) {
				return {
					sets: 0,
					reps: 0,
					weight: 0,
					isValid: false,
					errorMessage: `Expected ${sets} weights for ${sets} sets, but got ${weights.length}`
				};
			} else {
				return {
					sets: 0,
					reps: 0,
					weight: 0,
					isValid: false,
					errorMessage: 'Invalid weight values. Please use numbers only.'
				};
			}
		}
		// If only one weight, let it fall through to simple pattern
	}
	
	// Pattern 2: Compound format "sets x reps1 + reps2 @weight"
	const compoundPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*\+\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*(?:kg)?$/i;
	const compoundMatch = cleanInput.match(compoundPattern);
	
	if (compoundMatch) {
		const sets = parseInt(compoundMatch[1]);
		const reps1 = parseInt(compoundMatch[2]);
		const reps2 = parseInt(compoundMatch[3]);
		const weight = parseFloat(compoundMatch[4]);
		
		return {
			sets,
			reps: reps1 + reps2, // Total reps for display
			weight,
			isValid: true,
			compoundReps: [reps1, reps2]
		};
	}
	
	// Pattern 3: Wave format "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")
	// More flexible pattern to handle extra spaces
	const wavePattern = /^((?:\d+\s*\-?\s*)+)\s+(\d+(?:\.\d+)?)\s*(?:kg)?$/i;
	const waveMatch = cleanInput.match(wavePattern);
	
	if (waveMatch) {
		const repsStr = waveMatch[1];
		const weight = parseFloat(waveMatch[2]);
		
		// Validate weight is positive
		if (weight <= 0) {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")'
			};
		}
		
		// Parse wave reps (split by hyphens)
		const waveReps = repsStr.split('-').map(r => parseInt(r.trim()));
		
		// Validate that all reps are valid numbers
		if (waveReps.every(r => !isNaN(r) && r > 0)) {
			// Create individual phases for each set in the wave
			const wavePhases = waveReps.map((reps) => ({
				sets: 1,
				reps,
				weight: weight // All phases get the same weight
			}));
			
			return {
				sets: waveReps.length,
				reps: waveReps[0], // First rep count for backward compatibility
				weight,
				wavePhases,
				isValid: true
			};
		} else {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")'
			};
		}
	}
	
	// Check for multiple weights-like patterns that failed validation (check this first)
	const multipleWeightsLikePattern = /^\d+\s*x\s*\d+\s*@\s*[\d\s]+/i;
	if (multipleWeightsLikePattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid weight values. Please use numbers only.'
		};
	}
	
	// Check for wave-like patterns that failed validation
	const waveLikePattern = /^[\d\-\s]+[\d\.]+/i;
	if (waveLikePattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")'
		};
	}
	
	// Check for wave-like patterns with non-numeric characters
	const waveWithNonNumericPattern = /^[\d\-\s]*[a-zA-Z][\d\-\s]*[\d\.]+/i;
	if (waveWithNonNumericPattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")'
		};
	}
	
	// Check for any pattern that looks like wave but failed validation
	const anyWaveLikePattern = /^[\d\-\s]*[a-zA-Z][\d\-\s]*\d+/i;
	if (anyWaveLikePattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")'
		};
	}
	
	// If we get here, none of the patterns matched
	return {
		sets: 0,
		reps: 0,
		weight: 0,
		isValid: false,
		errorMessage: 'Invalid format. Use "sets x reps @weight" (e.g., "3 x 5 @50kg"), "sets x reps @weight1 weight2..." for multiple weights, or "reps1-reps2-reps3... weight" for wave exercises'
	};
}

/**
 * Converts an ExercisePhase back to the input format for editing
 * @param phase - The exercise phase to convert
 * @returns A string in the input format (e.g., "3 x 5 @50kg", "3 x 2 + 2 @50kg", "3 x 1 @50 60 70")
 */
export function reverseParsePhase(phase: {
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
}): string {
	// Handle compound exercises
	if (phase.compound_reps && phase.compound_reps.length === 2) {
		return `${phase.sets} x ${phase.compound_reps[0]} + ${phase.compound_reps[1]} @${phase.weight}kg`;
	}
	
	// Handle multiple weights
	if (phase.weights && phase.weights.length > 1) {
		const weightsStr = phase.weights.map(w => w.toString()).join(' ');
		return `${phase.sets} x ${phase.repetitions} @${weightsStr}`;
	}
	
	// Handle simple format
	return `${phase.sets} x ${phase.repetitions} @${phase.weight}kg`;
} 