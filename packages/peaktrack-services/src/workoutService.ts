import { format } from 'date-fns';
import { Workout } from '@evil-empire/types';
import { getSupabaseClient } from './client';
import { ServiceResult } from './types';
import { createExercise, fetchExercisesByWorkoutId } from './exerciseService';
import { fetchPhasesByExerciseIds, insertPhase, PhaseInsertData } from './exercisePhaseService';

export async function fetchWorkoutsByUserId(
	userId: string,
): Promise<ServiceResult<Workout[]>> {
	const supabase = getSupabaseClient();

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
	const supabase = getSupabaseClient();

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
	const supabase = getSupabaseClient();

	const { error } = await supabase
		.from('workouts')
		.delete()
		.eq('id', workoutId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}

export async function updateWorkoutDate(
	workoutId: string,
	newDate: string,
): Promise<ServiceResult<Workout>> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('workouts')
		.update({ workout_date: newDate })
		.eq('id', workoutId)
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function fetchWorkoutsByIds(
	workoutIds: string[],
	userId: string,
): Promise<ServiceResult<Workout[]>> {
	const supabase = getSupabaseClient();

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

export async function copyWorkout(
	sourceWorkoutId: string,
	userId: string,
): Promise<ServiceResult<string>> {
	const today = format(new Date(), 'yyyy-MM-dd');
	const workoutName = `Workout - ${format(new Date(), 'LLLL d, yyyy')}`;

	// Create the new workout
	const { data: newWorkout, error: createError } = await createWorkout(workoutName, userId, today);
	if (createError || !newWorkout) {
		return { data: null, error: createError ?? 'Failed to create workout' };
	}

	// Fetch source exercises
	const { data: sourceExercises, error: exercisesError } = await fetchExercisesByWorkoutId(sourceWorkoutId);
	if (exercisesError || !sourceExercises) {
		return { data: null, error: exercisesError ?? 'Failed to fetch exercises' };
	}

	// Fetch original exercise phases for all source exercises
	const sourceExerciseIds = sourceExercises.map((e) => e.id);
	const { data: sourcePhases, error: phasesError } = await fetchPhasesByExerciseIds(sourceExerciseIds);
	if (phasesError) {
		return { data: null, error: phasesError };
	}

	// Group phases by exercise_id
	const phasesByExerciseId = new Map<string, typeof sourcePhases>();
	for (const phase of sourcePhases ?? []) {
		const existing = phasesByExerciseId.get(phase.exercise_id) ?? [];
		existing.push(phase);
		phasesByExerciseId.set(phase.exercise_id, existing);
	}

	// Copy each exercise and its phases
	for (const exercise of sourceExercises) {
		const { data: newExercise, error: newExError } = await createExercise(exercise.name, newWorkout.id);
		if (newExError || !newExercise) {
			return { data: null, error: newExError ?? 'Failed to create exercise' };
		}

		const phases = phasesByExerciseId.get(exercise.id) ?? [];
		for (const phase of phases) {
			const phaseData: PhaseInsertData = {
				exercise_id: newExercise.id,
				sets: phase.sets,
				repetitions: phase.repetitions,
				weight: phase.weight,
				compound_reps: phase.compound_reps ?? null,
				weights: phase.weights ?? null,
				exercise_type: phase.exercise_type ?? undefined,
				notes: phase.notes ?? null,
				target_rm: phase.target_rm ?? null,
				rir_min: phase.rir_min ?? null,
				rir_max: phase.rir_max ?? null,
				circuit_exercises: Array.isArray(phase.circuit_exercises) ? phase.circuit_exercises : null,
				rest_time_seconds: phase.rest_time_seconds ?? null,
				emom_interval_seconds: phase.emom_interval_seconds ?? null,
			};
			const { error: phaseError } = await insertPhase(phaseData);
			if (phaseError) {
				return { data: null, error: phaseError };
			}
		}
	}

	return { data: newWorkout.id, error: null };
}
