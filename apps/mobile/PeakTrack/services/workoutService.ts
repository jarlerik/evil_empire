import { supabase } from '../lib/supabase';
import { Workout } from '../types/workout';
import { ServiceResult } from './types';

export async function fetchWorkoutsByUserId(
	userId: string,
): Promise<ServiceResult<Workout[]>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('workouts')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function createWorkout(
	name: string,
	userId: string,
	workoutDate: string,
): Promise<ServiceResult<Workout>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('workouts')
		.insert([{ name, user_id: userId, workout_date: workoutDate }])
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function deleteWorkout(
	workoutId: string,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('workouts')
		.delete()
		.eq('id', workoutId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function fetchWorkoutsByIds(
	workoutIds: string[],
	userId: string,
): Promise<ServiceResult<Workout[]>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('workouts')
		.select('*')
		.in('id', workoutIds)
		.eq('user_id', userId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}
