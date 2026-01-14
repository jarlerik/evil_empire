export interface ParsedSetData {
	sets: number;
	reps: number;
	weight: number;
	weights?: number[]; // For multiple weights (e.g., [50, 60, 70])
	wavePhases?: Array<{sets: number, reps: number, weight: number}>; // For wave exercises
	isValid: boolean;
	errorMessage?: string; // Error message when parsing fails
	compoundReps?: number[]; // For compound exercises like "2 + 2"
	exerciseType?: 'standard' | 'circuit' | 'superset' | 'rm_build'; // Type of exercise
	notes?: string; // Free-form text for special instructions
	targetRm?: number; // Target repetition maximum for "Build to XRM" format
	rirMin?: number; // Minimum Reps in Reserve
	rirMax?: number; // Maximum Reps in Reserve (for ranges like "2-3RIR")
	circuitExercises?: Array<{reps: string, name: string}>; // Array of exercise descriptions for circuits/supersets
	weightPercentage?: number; // Percentage value (e.g., 80 for 80%)
	needsRmLookup?: boolean; // Flag indicating RM lookup is needed
	weightMin?: number; // Minimum weight for ranges (e.g., 80 for "80-85%" or 85 for "85-89kg")
	weightMax?: number; // Maximum weight for ranges (e.g., 85 for "80-85%" or 89 for "85-89kg")
	weightMinPercentage?: number; // Minimum percentage for percentage ranges (e.g., 80 for "80-85%")
	weightMaxPercentage?: number; // Maximum percentage for percentage ranges (e.g., 85 for "80-85%")
	restTimeSeconds?: number; // Rest time between sets in seconds (e.g., 120 for 2 minutes)
}

export interface ParserResult {
	matched: boolean;
	data?: ParsedSetData;
}

export type Parser = (cleanInput: string, restTimeSeconds?: number) => ParserResult;

/**
 * Creates an invalid ParsedSetData response with an error message
 */
export function invalidResult(errorMessage: string): ParsedSetData {
	return {
		sets: 0,
		reps: 0,
		weight: 0,
		isValid: false,
		errorMessage
	};
}

/**
 * Creates a valid ParsedSetData response
 */
export function validResult(data: Omit<ParsedSetData, 'isValid'>): ParsedSetData {
	return {
		...data,
		isValid: true
	};
}
