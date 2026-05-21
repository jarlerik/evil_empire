import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPhasesByExerciseId,
  insertPhase,
  updatePhase as updatePhaseSvc,
  deletePhase as deletePhaseSvc,
  buildPhaseData,
} from '@evil-empire/peaktrack-services';
import type { ExercisePhase, ParsedSetData } from '@evil-empire/parsers';
import { useUserSettings } from '../contexts/UserSettingsContext';

export const phaseKeys = {
  all: ['phases'] as const,
  byExercise: (exerciseId: string) => [...phaseKeys.all, 'exercise', exerciseId] as const,
};

export function usePhasesByExerciseId(exerciseId: string | undefined) {
  return useQuery({
    queryKey: phaseKeys.byExercise(exerciseId ?? ''),
    enabled: !!exerciseId,
    queryFn: async (): Promise<ExercisePhase[]> => {
      if (!exerciseId) return [];
      const { data, error } = await fetchPhasesByExerciseId(exerciseId);
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export interface SavePhaseVars {
  exerciseId: string;
  phaseId?: string | null;
  parsedData: ParsedSetData;
  calculatedWeight: number;
  weightRange?: { min: number; max: number };
}

export function useSavePhase() {
  const qc = useQueryClient();
  const { settings } = useUserSettings();
  const defaultRestSeconds = settings?.default_rest_seconds ?? null;
  return useMutation({
    mutationFn: async (vars: SavePhaseVars) => {
      const isUpdate = !!vars.phaseId;
      const data = buildPhaseData(
        vars.exerciseId,
        vars.parsedData,
        vars.calculatedWeight,
        vars.weightRange,
        isUpdate,
        defaultRestSeconds,
      );
      if (isUpdate && vars.phaseId) {
        const { exercise_id: _ignored, ...updateData } = data;
        const { error } = await updatePhaseSvc(vars.phaseId, updateData);
        if (error) throw new Error(error);
      } else {
        const { error } = await insertPhase(data);
        if (error) throw new Error(error);
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: phaseKeys.byExercise(vars.exerciseId) });
    },
  });
}

export function useDeletePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (phaseId: string) => {
      const { error } = await deletePhaseSvc(phaseId);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: phaseKeys.all });
    },
  });
}
