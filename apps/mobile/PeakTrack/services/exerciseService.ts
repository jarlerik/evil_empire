import { supabase } from '../lib/supabase';
import { Exercise } from '../types/workout';
import { ServiceResult } from './types';

export async function fetchExercisesByWorkoutId(
	workoutId: string,
): Promise<ServiceResult<Exercise[]>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('exercises')
		.select('*')
		.eq('workout_id', workoutId)
		.order('created_at', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function createExercise(
	name: string,
	workoutId: string,
): Promise<ServiceResult<Exercise>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('exercises')
		.insert([{ name, workout_id: workoutId }])
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function deleteExercise(
	exerciseId: string,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('exercises')
		.delete()
		.eq('id', exerciseId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function updateExerciseName(
	exerciseId: string,
	name: string,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('exercises')
		.update({ name })
		.eq('id', exerciseId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function fetchExercisesByWorkoutIds(
	workoutIds: string[],
): Promise<ServiceResult<Exercise[]>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('exercises')
		.select('*')
		.in('workout_id', workoutIds)
		.order('created_at', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}
