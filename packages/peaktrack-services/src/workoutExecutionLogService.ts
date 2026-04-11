import { getSupabaseClient } from './client';
import { ServiceResult } from './types';

export interface ExecutionLogInsert {
	workout_id: string;
	exercise_id: string;
	exercise_phase_id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[] | null;
	compound_reps?: number[] | null;
	rest_time_seconds?: number | null;
	emom_interval_seconds?: number | null;
	exercise_type?: string | null;
	circuit_exercises?: Array<{ reps: string; name: string }> | string | null;
	target_rm?: number | null;
	rir_min?: number | null;
	rir_max?: number | null;
	execution_status: string;
	executed_at: string;
}

export interface ExecutionLogRow {
	workout_id: string;
	executed_at: string;
}

export interface ExecutionLogDetail {
	id: string;
	workout_id: string;
	exercise_id: string;
	exercise_phase_id: string | null;
	sets: number;
	repetitions: number;
	weight: number;
	weights: number[] | null;
	compound_reps: number[] | null;
	rest_time_seconds: number | null;
	emom_interval_seconds: number | null;
	exercise_type: string | null;
	circuit_exercises: Array<{ reps: string; name: string }> | string | null;
	target_rm: number | null;
	rir_min: number | null;
	rir_max: number | null;
	execution_status: string;
	executed_at: string;
}

export async function insertExecutionLog(
	data: ExecutionLogInsert,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();

	const { error } = await supabase
		.from('workout_execution_logs')
		.insert(data);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function fetchCompletedWorkoutIds(
	workoutIds: string[],
): Promise<ServiceResult<string[]>> {
	const supabase = getSupabaseClient();

	if (workoutIds.length === 0) {
		return { data: [], error: null };
	}

	const { data, error } = await supabase
		.from('workout_execution_logs')
		.select('workout_id')
		.in('workout_id', workoutIds);

	if (error) {
		return { data: null, error: error.message };
	}

	const uniqueIds = [...new Set((data ?? []).map((row: { workout_id: string }) => row.workout_id))];
	return { data: uniqueIds, error: null };
}

export async function fetchExecutionLogsByExerciseIds(
	exerciseIds: string[],
): Promise<ServiceResult<ExecutionLogDetail[]>> {
	const supabase = getSupabaseClient();

	if (exerciseIds.length === 0) {
		return { data: [], error: null };
	}

	const { data, error } = await supabase
		.from('workout_execution_logs')
		.select('id, workout_id, exercise_id, exercise_phase_id, sets, repetitions, weight, weights, compound_reps, rest_time_seconds, emom_interval_seconds, exercise_type, circuit_exercises, target_rm, rir_min, rir_max, execution_status, executed_at')
		.in('exercise_id', exerciseIds)
		.order('executed_at', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function fetchRecentExecutionLogs(
	cutoffDate: string,
): Promise<ServiceResult<ExecutionLogRow[]>> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('workout_execution_logs')
		.select('workout_id, executed_at')
		.gte('executed_at', cutoffDate)
		.order('executed_at', { ascending: false });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}
