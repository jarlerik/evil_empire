import { getSupabaseClient } from './client';
import { ServiceResult } from './types';

export interface WorkoutRatingRow {
	id: string;
	workout_id: string;
	rating: number;
	created_at: string;
}

export async function saveWorkoutRating(
	workoutId: string,
	rating: number,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();

	const { error } = await supabase
		.from('workout_ratings')
		.upsert(
			{ workout_id: workoutId, rating },
			{ onConflict: 'workout_id' },
		);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function fetchWorkoutRatings(
	workoutIds: string[],
): Promise<ServiceResult<WorkoutRatingRow[]>> {
	const supabase = getSupabaseClient();

	if (workoutIds.length === 0) {
		return { data: [], error: null };
	}

	const { data, error } = await supabase
		.from('workout_ratings')
		.select('id, workout_id, rating, created_at')
		.in('workout_id', workoutIds);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}
