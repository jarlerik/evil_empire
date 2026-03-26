export interface ExercisePhase {
	id: string;
	exercise_id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
	exercise_type?: string;
	notes?: string;
	target_rm?: number;
	rir_min?: number;
	rir_max?: number;
	circuit_exercises?: Array<{reps: string, name: string}> | string;
	weight_min?: number;
	weight_max?: number;
	weight_min_percentage?: number;
	weight_max_percentage?: number;
	rest_time_seconds?: number;
	emom_interval_seconds?: number;
	created_at: string;
}

export function formatExercisePhase(phase: ExercisePhase, unit: 'kg' | 'lbs' = 'kg'): string {
	// Helper function to prepend EMOM prefix
	const prependEmom = (str: string): string => {
		if (phase.emom_interval_seconds !== undefined && phase.emom_interval_seconds !== null) {
			const seconds = phase.emom_interval_seconds;
			if (seconds >= 60 && seconds % 60 === 0) {
				return `EMOM ${seconds / 60}min: ${str}`;
			}
			return `EMOM ${seconds}s: ${str}`;
		}
		return str;
	};

	// Helper function to append rest time
	const appendRestTime = (str: string): string => {
		if (phase.rest_time_seconds !== undefined && phase.rest_time_seconds !== null) {
			return `${str} ${phase.rest_time_seconds}s`;
		}
		return str;
	};

	// Combined helper: prepend EMOM then append rest time
	const wrapResult = (str: string): string => prependEmom(appendRestTime(str));

	// Handle RM build format
	if (phase.exercise_type === 'rm_build' && phase.target_rm) {
		return wrapResult(`Build to ${phase.target_rm}RM`);
	}

	// Handle circuit format
	if (phase.exercise_type === 'circuit' && phase.circuit_exercises) {
		let circuitExercises: Array<{reps: string, name: string}> = [];

		// Handle JSONB string from database
		if (typeof phase.circuit_exercises === 'string') {
			try {
				circuitExercises = JSON.parse(phase.circuit_exercises);
			} catch (e) {
				console.error('Error parsing circuit exercises:', e);
				return wrapResult(`${phase.sets} sets of ${phase.circuit_exercises}`);
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
				}
				return '';
			}).filter(s => s.length > 0).join(', ');

			return wrapResult(`${phase.sets} x ${exercisesStr}`);
		}
	}

	// Handle RIR format
	if (phase.rir_min !== undefined && phase.rir_min !== null) {
		const rirStr = phase.rir_max && phase.rir_max !== phase.rir_min
			? `${phase.rir_min}-${phase.rir_max}RIR`
			: `${phase.rir_min}RIR`;

		// If there's a weight, include it
		if (phase.weight > 0) {
			let weightStr: string;
			if (phase.weight_min !== undefined && phase.weight_max !== undefined && phase.weight_min !== null && phase.weight_max !== null) {
				weightStr = `${phase.weight_min}-${phase.weight_max}${unit}`;
			} else if (phase.weights && phase.weights.length > 1) {
				weightStr = phase.weights.map(w => `${w}${unit}`).join(' ');
			} else {
				weightStr = `${phase.weight}${unit}`;
			}
			return wrapResult(`${phase.sets} x ${phase.repetitions} @${weightStr}, ${rirStr}`);
		} else {
			return wrapResult(`${phase.sets} x ${phase.repetitions}, ${rirStr}`);
		}
	}

	// Handle wave exercises
	if (phase.exercise_type === 'wave' && phase.compound_reps && phase.compound_reps.length > 0) {
		const repsStr = phase.compound_reps.join('-');
		let weightStr: string;
		if (phase.weights && phase.weights.length > 1) {
			weightStr = phase.weights.map(w => `${w}`).join(', ') + unit;
		} else {
			weightStr = `${phase.weight}${unit}`;
		}
		return wrapResult(`${repsStr} @${weightStr}`);
	}

	// Handle compound exercises
	if (phase.compound_reps && phase.compound_reps.length > 0) {
		const compoundRepsStr = phase.compound_reps.join(' + ');
		let weightStr: string;
		const hasRange = phase.weight_min !== undefined && phase.weight_max !== undefined
			&& phase.weight_min !== null && phase.weight_max !== null
			&& phase.weight_min !== phase.weight_max;
		if (phase.weights && phase.weights.length > 1 && hasRange) {
			// Per-set weights with trailing range (e.g., "52kg 55kg 57-59kg")
			const parts = phase.weights.map((w, i) => {
				if (i === phase.weights!.length - 1) {
					return `${phase.weight_min}-${phase.weight_max}${unit}`;
				}
				return `${w}${unit}`;
			});
			weightStr = parts.join(' ');
		} else if (phase.weight_min !== undefined && phase.weight_max !== undefined && phase.weight_min !== null && phase.weight_max !== null) {
			weightStr = `${phase.weight_min}-${phase.weight_max}${unit}`;
		} else if (phase.weights && phase.weights.length > 1) {
			weightStr = phase.weights.map(w => `${w}${unit}`).join(' ');
		} else {
			weightStr = `${phase.weight}${unit}`;
		}
		return wrapResult(`${phase.sets} x ${compoundRepsStr} @${weightStr}`);
	}

	// Handle multiple weights (with optional trailing range)
	if (phase.weights && phase.weights.length > 1) {
		const hasRange = phase.weight_min !== undefined && phase.weight_max !== undefined
			&& phase.weight_min !== null && phase.weight_max !== null
			&& phase.weight_min !== phase.weight_max;
		if (hasRange) {
			const parts = phase.weights.map((w, i) => {
				if (i === phase.weights!.length - 1) {
					return `${phase.weight_min}-${phase.weight_max}${unit}`;
				}
				return `${w}${unit}`;
			});
			return wrapResult(`${phase.sets} x ${phase.repetitions} @${parts.join(' ')}`);
		}
		const weightStr = phase.weights.map(w => `${w}${unit}`).join(' ');
		return wrapResult(`${phase.sets} x ${phase.repetitions} @${weightStr}`);
	}

	// Handle weight ranges (absolute)
	if (phase.weight_min !== undefined && phase.weight_max !== undefined && phase.weight_min !== null && phase.weight_max !== null) {
		return wrapResult(`${phase.sets} x ${phase.repetitions} @${phase.weight_min}-${phase.weight_max}${unit}`);
	}

	// Handle simple format
	const weightStr = phase.weights ? phase.weights.map(w => `${w}${unit}`).join(' ') : `${phase.weight}${unit}`;
	return wrapResult(`${phase.sets} x ${phase.repetitions} @${weightStr}`);
}
