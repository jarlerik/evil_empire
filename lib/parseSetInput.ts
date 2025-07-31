export interface ParsedSetData {
	sets: number;
	reps: number;
	weight: number;
	isValid: boolean;
}

/**
 * Parses a string input in the format "sets x reps @weight" or "sets x reps @weightkg"
 * @param input - The input string to parse (e.g., "4 x 3 @50kg")
 * @returns ParsedSetData object with parsed values and validity status
 */
export function parseSetInput(input: string): ParsedSetData {
	// Remove any extra spaces and convert to lowercase for easier parsing
	const cleanInput = input.trim().toLowerCase();
	
	// Pattern: "sets x reps @weight" or "sets x reps @weightkg"
	// Excludes zero values and accepts any case for "kg"
	const pattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*(?:kg)?$/i;
	const match = cleanInput.match(pattern);
	
	if (match) {
		const sets = parseInt(match[1]);
		const reps = parseInt(match[2]);
		const weight = parseFloat(match[3]);
		
		return {
			sets,
			reps,
			weight,
			isValid: true
		};
	}
	
	return {
		sets: 0,
		reps: 0,
		weight: 0,
		isValid: false
	};
} 