import { getSupabaseClient } from './client';
import { ServiceResult, RepetitionMaximum } from './types';

export async function fetchRepetitionMaximums(
	userId: string,
): Promise<ServiceResult<RepetitionMaximum[]>> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('repetition_maximums')
		.select('*')
		.eq('user_id', userId)
		.order('exercise_name', { ascending: true })
		.order('reps', { ascending: true })
		.order('date', { ascending: false });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function createRepetitionMaximum(params: {
	userId: string;
	exerciseName: string;
	reps: number;
	weight: number;
	date: string;
}): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();

	const { error } = await supabase
		.from('repetition_maximums')
		.insert([{
			user_id: params.userId,
			exercise_name: params.exerciseName,
			reps: params.reps,
			weight: params.weight,
			date: params.date,
		}]);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function updateRepetitionMaximum(
	id: string,
	data: { exercise_name: string; reps: number; weight: number; date: string },
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();

	const { error } = await supabase
		.from('repetition_maximums')
		.update(data)
		.eq('id', id);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function deleteRepetitionMaximum(
	id: string,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();

	const { error } = await supabase
		.from('repetition_maximums')
		.delete()
		.eq('id', id);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function lookupExactRm(
	userId: string,
	exerciseName: string,
	reps: number,
): Promise<ServiceResult<{ weight: number } | null>> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('repetition_maximums')
		.select('weight')
		.eq('user_id', userId)
		.ilike('exercise_name', exerciseName.trim())
		.eq('reps', reps)
		.order('weight', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function fetchAllRmsByReps(
	userId: string,
	reps: number,
): Promise<ServiceResult<Array<{ exercise_name: string; weight: number }>>> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('repetition_maximums')
		.select('exercise_name, weight')
		.eq('user_id', userId)
		.eq('reps', reps)
		.order('weight', { ascending: false });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}
