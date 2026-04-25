import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchRepetitionMaximums,
  createRepetitionMaximum as createRmSvc,
  updateRepetitionMaximum as updateRmSvc,
  deleteRepetitionMaximum as deleteRmSvc,
  type RepetitionMaximum,
} from '@evil-empire/peaktrack-services';

export const rmKeys = {
  all: ['rms'] as const,
  byUser: (userId: string) => [...rmKeys.all, 'user', userId] as const,
};

export function useRms(userId: string | undefined) {
  return useQuery({
    queryKey: rmKeys.byUser(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<RepetitionMaximum[]> => {
      if (!userId) return [];
      const { data, error } = await fetchRepetitionMaximums(userId);
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export interface SaveRmVars {
  exerciseName: string;
  reps: number;
  weight: number;
  date: string;
}

export function useCreateRm(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SaveRmVars) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await createRmSvc({ userId, ...vars });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rmKeys.all });
    },
  });
}

export function useUpdateRm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string } & SaveRmVars) => {
      const { error } = await updateRmSvc(vars.id, {
        exercise_name: vars.exerciseName,
        reps: vars.reps,
        weight: vars.weight,
        date: vars.date,
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rmKeys.all });
    },
  });
}

export function useDeleteRm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteRmSvc(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rmKeys.all });
    },
  });
}
