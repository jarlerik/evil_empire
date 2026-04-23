import { getSupabaseClient } from './client';
import { ServiceResult } from './types';

/**
 * One completed execution log for an exercise-progression chart point.
 * Mirrors the subset of `workout_execution_logs` needed for tile + volume
 * rendering — no circuit / RIR / notes metadata.
 */
export interface ExerciseProgressionLog {
	id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights: number[] | null;
	compound_reps: number[] | null;
	executed_at: string;
}

export interface ExerciseProgressionRow {
	logId: string;
	workoutId: string;
	/** ISO date (YYYY-MM-DD). */
	workoutDate: string;
	/** ISO timestamp, used as secondary sort key. */
	executedAt: string;
	/** Original compound-preserving exercise name, e.g. `"Power clean + Power jerk"`. */
	exerciseName: string;
	/** Position of the analysed target within the compound (0 for non-compound). */
	segmentIndex: number;
	isCompound: boolean;
	log: ExerciseProgressionLog;
}

export interface FetchExerciseProgressionOptions {
	/** Rolling window in months. Default 24. Pass `Infinity` for all history. */
	monthsBack?: number;
}

/**
 * Escape the literal % and _ wildcards (and the escape char itself) so a user
 * entering e.g. `"50%"` as an exercise name does not turn into a LIKE wildcard.
 */
export function escapeIlike(target: string): string {
	return target.replace(/[\\%_]/g, '\\$&');
}

function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

export function splitCompoundName(name: string): string[] {
	return name
		.split(/\s*\+\s*/)
		.map(s => s.trim())
		.filter(Boolean);
}

function computeCutoffDate(monthsBack: number): string | null {
	if (!Number.isFinite(monthsBack) || monthsBack <= 0) {
		return null;
	}
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - monthsBack);
	return cutoff.toISOString().slice(0, 10);
}

interface RawLog {
	id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights: number[] | null;
	compound_reps: number[] | null;
	execution_status: string;
	executed_at: string;
}

interface RawExercise {
	id: string;
	name: string;
	workout_execution_logs: RawLog[];
}

interface RawWorkout {
	id: string;
	workout_date: string | null;
	exercises: RawExercise[];
}

/**
 * Fetch every completed execution log for the target exercise (direct or as a
 * compound segment) within the rolling window. Emits one row per log — an
 * exercise with three phase logs in one workout produces three adjacent chart
 * points. Rows are sorted `(workout_date, executed_at, logId)`.
 */
export async function fetchExerciseProgressionData(
	userId: string,
	exerciseName: string,
	options: FetchExerciseProgressionOptions = {},
): Promise<ServiceResult<ExerciseProgressionRow[]>> {
	const target = normalizeName(exerciseName);
	if (!target) {
		return { data: [], error: null };
	}
	const escaped = escapeIlike(target);

	const supabase = getSupabaseClient();
	const cutoffDate = computeCutoffDate(options.monthsBack ?? 24);

	let query = supabase
		.from('workouts')
		.select(
			`
			id,
			workout_date,
			exercises!inner (
				id,
				name,
				workout_execution_logs!inner (
					id,
					sets,
					repetitions,
					weight,
					weights,
					compound_reps,
					execution_status,
					executed_at
				)
			)
		`,
		)
		.eq('user_id', userId)
		.ilike('exercises.name', `%${escaped}%`)
		.eq('exercises.workout_execution_logs.execution_status', 'completed')
		.order('workout_date', { ascending: true });

	if (cutoffDate) {
		query = query.gte('workout_date', cutoffDate);
	}

	const { data, error } = await query;
	if (error) {
		return { data: null, error: error.message };
	}

	const rows: ExerciseProgressionRow[] = [];
	for (const w of (data ?? []) as RawWorkout[]) {
		const workoutDate = w.workout_date;
		for (const ex of w.exercises ?? []) {
			const segments = splitCompoundName(ex.name).map(normalizeName);
			const segmentIndex = segments.findIndex(s => s === target);
			if (segmentIndex < 0) {
				continue;
			}
			const isCompound = segments.length > 1;
			for (const log of ex.workout_execution_logs ?? []) {
				if (log.execution_status !== 'completed') {
					continue;
				}
				const effectiveDate = workoutDate ?? log.executed_at.slice(0, 10);
				rows.push({
					logId: log.id,
					workoutId: w.id,
					workoutDate: effectiveDate,
					executedAt: log.executed_at,
					exerciseName: ex.name,
					segmentIndex,
					isCompound,
					log: {
						id: log.id,
						sets: log.sets,
						repetitions: log.repetitions,
						weight: log.weight,
						weights: log.weights,
						compound_reps: log.compound_reps,
						executed_at: log.executed_at,
					},
				});
			}
		}
	}

	rows.sort((a, b) => {
		if (a.workoutDate !== b.workoutDate) {
			return a.workoutDate < b.workoutDate ? -1 : 1;
		}
		if (a.executedAt !== b.executedAt) {
			return a.executedAt < b.executedAt ? -1 : 1;
		}
		if (a.logId !== b.logId) {
			return a.logId < b.logId ? -1 : 1;
		}
		return 0;
	});

	return { data: rows, error: null };
}

/**
 * Fetch the set of exercise-segment names the user has at least one completed
 * execution log for. Compound names are split on `+`, so "Power clean + Power
 * jerk" contributes both `"power clean"` and `"power jerk"`. Used by the RMs
 * screen to decide which RM groups get a "View progression" button.
 */
export async function fetchCompletedExerciseNameSet(
	userId: string,
): Promise<ServiceResult<Set<string>>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('exercises')
		.select(
			`
			name,
			workouts!inner ( user_id ),
			workout_execution_logs!inner ( id, execution_status )
		`,
		)
		.eq('workouts.user_id', userId)
		.eq('workout_execution_logs.execution_status', 'completed');

	if (error) {
		return { data: null, error: error.message };
	}

	const names = new Set<string>();
	for (const row of (data ?? []) as Array<{ name: string }>) {
		for (const seg of splitCompoundName(row.name).map(normalizeName)) {
			if (seg) {
				names.add(seg);
			}
		}
	}
	return { data: names, error: null };
}
