import { supabase } from '../lib/supabase';
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
	execution_status: string;
	executed_at: string;
}

export interface ExecutionLogRow {
	workout_id: string;
	executed_at: string;
}

export async function insertExecutionLog(
	data: ExecutionLogInsert,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

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
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

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

export async function fetchRecentExecutionLogs(
	cutoffDate: string,
): Promise<ServiceResult<ExecutionLogRow[]>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

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
