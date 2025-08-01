export interface ParsedSetData {
	sets: number;
	reps: number;
	weight: number;
	weights?: number[]; // For multiple weights (e.g., [50, 60, 70])
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
		
		// Validate that number of weights matches number of sets
		if (weights.length === sets && weights.every(w => !isNaN(w))) {
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
	
	// If we get here, none of the patterns matched
	return {
		sets: 0,
		reps: 0,
		weight: 0,
		isValid: false,
		errorMessage: 'Invalid format. Use "sets x reps @weight" (e.g., "3 x 5 @50kg") or "sets x reps @weight1 weight2..." for multiple weights'
	};
} 