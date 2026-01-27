import { supabase } from '../lib/supabase';
import { ExercisePhase } from '../lib/formatExercisePhase';
import { ServiceResult } from './types';

export interface PhaseInsertData {
	exercise_id: string;
	sets: number;
	repetitions: number;
	weight: number;
	compound_reps?: number[] | null;
	weights?: number[] | null;
	exercise_type?: string;
	notes?: string | null;
	target_rm?: number | null;
	rir_min?: number | null;
	rir_max?: number | null;
	circuit_exercises?: Array<{ reps: string; name: string }> | null;
	weight_min?: number | null;
	weight_max?: number | null;
	rest_time_seconds?: number | null;
}

export async function fetchPhasesByExerciseId(
	exerciseId: string,
): Promise<ServiceResult<ExercisePhase[]>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('exercise_phases')
		.select('*')
		.eq('exercise_id', exerciseId)
		.order('created_at', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function insertPhase(
	data: PhaseInsertData,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('exercise_phases')
		.insert([data]);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function updatePhase(
	phaseId: string,
	data: Omit<PhaseInsertData, 'exercise_id'>,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('exercise_phases')
		.update(data)
		.eq('id', phaseId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function deletePhase(
	phaseId: string,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('exercise_phases')
		.delete()
		.eq('id', phaseId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}
