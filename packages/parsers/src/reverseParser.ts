interface CircuitExercise {
	reps: string;
	name: string;
}

interface PhaseData {
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
	exercise_type?: string;
	target_rm?: number;
	rir_min?: number;
	rir_max?: number;
	circuit_exercises?: CircuitExercise[] | string; // Can be JSONB string from DB
	weight_min?: number;
	weight_max?: number;
	weight_min_percentage?: number;
	weight_max_percentage?: number;
	rest_time_seconds?: number;
	notes?: string;
}

/**
 * Helper function to append rest time to output string
 */
function appendRestTime(str: string, restTimeSeconds?: number | null): string {
	if (restTimeSeconds !== undefined && restTimeSeconds !== null) {
		return `${str} ${restTimeSeconds}s`;
	}
	return str;
}

/**
 * Helper function to append notes as a second line
 */
function appendNotes(str: string, notes?: string | null): string {
	if (notes) {
		return `${str}\n${notes}`;
	}
	return str;
}

/**
 * Converts an ExercisePhase back to the input format for editing
 * @param phase - The exercise phase to convert
 * @returns A string in the input format (e.g., "3 x 5 @50kg", "3 x 2 + 2 @50kg", "3 x 1 @50 60 70", etc.)
 *          Notes are appended as a second line if present.
 */
export function reverseParsePhase(phase: PhaseData): string {
	let result: string;

	// Handle RM build format
	if (phase.exercise_type === 'rm_build' && phase.target_rm) {
		result = appendRestTime(`Build to ${phase.target_rm}RM`, phase.rest_time_seconds);
		return appendNotes(result, phase.notes);
	}

	// Handle circuit format
	if (phase.exercise_type === 'circuit' && phase.circuit_exercises) {
		let circuitExercises: CircuitExercise[] = [];

		// Handle JSONB string from database
		if (typeof phase.circuit_exercises === 'string') {
			try {
				circuitExercises = JSON.parse(phase.circuit_exercises);
			} catch (e) {
				console.error('Error parsing circuit exercises:', e);
				// If parsing fails, return a fallback
				result = appendRestTime(`${phase.sets} sets of ${phase.circuit_exercises}`, phase.rest_time_seconds);
				return appendNotes(result, phase.notes);
			}
		} else {
			circuitExercises = phase.circuit_exercises;
		}

		if (circuitExercises.length > 0) {
			const exercisesStr = circuitExercises.map(ex => {
				if (ex.reps && ex.name) {
					return `${ex.reps} ${ex.name}`;
				} else if (ex.name) {
					return ex.name;
				} else {
					return '';
				}
			}).filter(s => s.length > 0).join(', ');

			result = appendRestTime(`${phase.sets} x ${exercisesStr}`, phase.rest_time_seconds);
			return appendNotes(result, phase.notes);
		}
	}

	// Handle RIR format (with or without weight)
	if (phase.rir_min !== undefined && phase.rir_min !== null) {
		const rirStr = phase.rir_max && phase.rir_max !== phase.rir_min
			? `${phase.rir_min}-${phase.rir_max}RIR`
			: `${phase.rir_min}RIR`;

		// If there's a weight, include it
		if (phase.weight > 0) {
			result = appendRestTime(`${phase.sets} x ${phase.repetitions} @${phase.weight}kg, ${rirStr}`, phase.rest_time_seconds);
		} else {
			result = appendRestTime(`${phase.sets} x ${phase.repetitions}, ${rirStr}`, phase.rest_time_seconds);
		}
		return appendNotes(result, phase.notes);
	}

	// Handle weight ranges (absolute) - percentage ranges are converted to absolute values when stored
	if (phase.weight_min !== undefined && phase.weight_max !== undefined && phase.weight_min !== null && phase.weight_max !== null) {
		if (phase.compound_reps && phase.compound_reps.length >= 2) {
			const repsStr = phase.compound_reps.join(' + ');
			result = appendRestTime(`${phase.sets} x ${repsStr} @${phase.weight_min}-${phase.weight_max}kg`, phase.rest_time_seconds);
		} else {
			result = appendRestTime(`${phase.sets} x ${phase.repetitions} @${phase.weight_min}-${phase.weight_max}kg`, phase.rest_time_seconds);
		}
		return appendNotes(result, phase.notes);
	}

	// Handle compound exercises
	if (phase.compound_reps && phase.compound_reps.length >= 2) {
		const repsStr = phase.compound_reps.join(' + ');
		result = appendRestTime(`${phase.sets} x ${repsStr} @${phase.weight}kg`, phase.rest_time_seconds);
		return appendNotes(result, phase.notes);
	}

	// Handle multiple weights
	if (phase.weights && phase.weights.length > 1) {
		const weightsStr = phase.weights.map(w => w.toString()).join(' ');
		result = appendRestTime(`${phase.sets} x ${phase.repetitions} @${weightsStr}`, phase.rest_time_seconds);
		return appendNotes(result, phase.notes);
	}

	// Handle simple format
	result = appendRestTime(`${phase.sets} x ${phase.repetitions} @${phase.weight}kg`, phase.rest_time_seconds);
	return appendNotes(result, phase.notes);
}
