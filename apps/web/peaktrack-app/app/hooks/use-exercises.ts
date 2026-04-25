import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExercise as createExerciseSvc,
  deleteExercise as deleteExerciseSvc,
  updateExerciseName as updateExerciseNameSvc,
  fetchExercisesByWorkoutId,
} from '@evil-empire/peaktrack-services';
import type { Exercise } from '@evil-empire/types';
import { workoutKeys } from './use-workouts';

export const exerciseKeys = {
  all: ['exercises'] as const,
  byWorkout: (workoutId: string) => [...exerciseKeys.all, 'workout', workoutId] as const,
};

export function useExercisesByWorkoutId(workoutId: string | undefined) {
  return useQuery({
    queryKey: exerciseKeys.byWorkout(workoutId ?? ''),
    enabled: !!workoutId,
    queryFn: async (): Promise<Exercise[]> => {
      if (!workoutId) return [];
      const { data, error } = await fetchExercisesByWorkoutId(workoutId);
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; workoutId: string }) => {
      const { data, error } = await createExerciseSvc(vars.name, vars.workoutId);
      if (error || !data) throw new Error(error ?? 'Failed to create exercise');
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: exerciseKeys.byWorkout(vars.workoutId) });
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exerciseId: string) => {
      const { error } = await deleteExerciseSvc(exerciseId);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exerciseKeys.all });
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useUpdateExerciseName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { exerciseId: string; name: string }) => {
      const { error } = await updateExerciseNameSvc(vars.exerciseId, vars.name);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: exerciseKeys.all });
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}
