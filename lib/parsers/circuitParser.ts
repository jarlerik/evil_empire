import { ParserResult, validResult } from './types';

interface CircuitExercise {
	reps: string;
	name: string;
}

/**
 * Parses circuit exercises from a comma-separated string
 */
function parseCircuitExercises(exercisesStr: string): CircuitExercise[] {
	const exercises = exercisesStr.split(',').map(ex => ex.trim()).filter(ex => ex.length > 0);
	const circuitExercises: CircuitExercise[] = [];

	for (const exercise of exercises) {
		// Match pattern: "10/10 exercise name" or "10 exercise name"
		const exerciseMatch = exercise.match(/^(\d+(?:\/\d+)?)\s+(.+)$/);
		if (exerciseMatch) {
			circuitExercises.push({
				reps: exerciseMatch[1],
				name: exerciseMatch[2]
			});
		} else {
			// If no match, treat entire string as exercise name with no reps
			circuitExercises.push({
				reps: '',
				name: exercise
			});
		}
	}

	return circuitExercises;
}

/**
 * Pattern 4: Circuit format with "sets of"
 * Example: "2 sets of 10/10 banded side step, 10 banded skated walk forward..."
 */
export function parseCircuitSetsOf(remainingInput: string, cleanInput: string, restTimeSeconds?: number): ParserResult {
	// Skip if input contains "rir" (handled by RIR parser)
	if (cleanInput.includes('rir')) {
		return { matched: false };
	}

	const circuitSetsOfPattern = /^([1-9]\d*)\s+sets?\s+of\s+(.+)$/i;
	const match = remainingInput.match(circuitSetsOfPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const exercisesStr = match[2];

	const circuitExercises = parseCircuitExercises(exercisesStr);

	if (circuitExercises.length > 0) {
		return {
			matched: true,
			data: validResult({
				sets,
				reps: 0, // Circuits don't have a single rep count
				weight: 0, // Circuits typically don't have weights
				exerciseType: 'circuit',
				circuitExercises,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	}

	return { matched: false };
}

/**
 * Pattern 5: Circuit format with "x"
 * Example: "2 x 10/10 banded side step, 10 banded skated walk forward..."
 */
export function parseCircuitX(remainingInput: string, cleanInput: string, restTimeSeconds?: number): ParserResult {
	// Skip if input contains "rir" (handled by RIR parser)
	if (cleanInput.includes('rir')) {
		return { matched: false };
	}

	const circuitXPattern = /^([1-9]\d*)\s+x\s+(.+)$/i;
	const match = remainingInput.match(circuitXPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const exercisesStr = match[2];

	// Check if this looks like a circuit (has commas and text) vs standard format (has @ and numbers)
	// Standard format would be "2 x 10 @50" which we already handled
	// Also exclude patterns that look like "4 x 3 50kg" (missing @) - these should be invalid
	const looksLikeMissingAt = /^\d+\s*\d*kg?$/i.test(exercisesStr.trim());
	if (looksLikeMissingAt) {
		// This looks like "sets x reps weight" without @, should be invalid
		return { matched: false };
	}

	if (!exercisesStr.includes(',') && (exercisesStr.includes('@') || !/[a-zA-Z]/.test(exercisesStr))) {
		return { matched: false };
	}

	const circuitExercises = parseCircuitExercises(exercisesStr);

	if (circuitExercises.length > 0) {
		return {
			matched: true,
			data: validResult({
				sets,
				reps: 0, // Circuits don't have a single rep count
				weight: 0, // Circuits typically don't have weights
				exerciseType: 'circuit',
				circuitExercises,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			})
		};
	}

	return { matched: false };
}
