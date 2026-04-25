import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkoutsWithNestedForDateRange,
  type WorkoutWithNested,
  createWorkout as createWorkoutSvc,
  deleteWorkout as deleteWorkoutSvc,
  updateWorkoutDate as updateWorkoutDateSvc,
  copyWorkout as copyWorkoutSvc,
} from '@evil-empire/peaktrack-services';

export const workoutKeys = {
  all: ['workouts'] as const,
  range: (userId: string, start: string, end: string) =>
    [...workoutKeys.all, 'range', userId, start, end] as const,
};

export function useWorkoutsForDateRange(
  userId: string | undefined,
  start: string,
  end: string,
) {
  return useQuery({
    queryKey: workoutKeys.range(userId ?? '', start, end),
    enabled: !!userId,
    queryFn: async (): Promise<WorkoutWithNested[]> => {
      if (!userId) return [];
      const { data, error } = await fetchWorkoutsWithNestedForDateRange(userId, start, end);
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export function useCreateWorkout(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; date: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await createWorkoutSvc(vars.name, userId, vars.date);
      if (error || !data) throw new Error(error ?? 'Failed to create workout');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await deleteWorkoutSvc(workoutId);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useUpdateWorkoutDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { workoutId: string; newDate: string }) => {
      const { data, error } = await updateWorkoutDateSvc(vars.workoutId, vars.newDate);
      if (error || !data) throw new Error(error ?? 'Failed to update workout');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useCopyWorkout(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workoutId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await copyWorkoutSvc(workoutId, userId);
      if (error || !data) throw new Error(error ?? 'Failed to copy workout');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}
