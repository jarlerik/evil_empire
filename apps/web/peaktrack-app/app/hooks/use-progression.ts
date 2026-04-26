import { useQuery } from '@tanstack/react-query';
import {
  fetchExerciseProgressionData,
  fetchProgramProgressionData,
  type ExerciseProgressionRow,
  type ProgramProgressionData,
} from '@evil-empire/peaktrack-services';

export const progressionKeys = {
  all: ['progression'] as const,
  exercise: (userId: string, name: string) =>
    [...progressionKeys.all, 'exercise', userId, name] as const,
  program: (programId: string, name: string) =>
    [...progressionKeys.all, 'program', programId, name] as const,
};

export function useExerciseProgression(userId: string | undefined, exerciseName: string) {
  return useQuery({
    queryKey: progressionKeys.exercise(userId ?? '', exerciseName),
    enabled: !!userId && !!exerciseName,
    queryFn: async (): Promise<ExerciseProgressionRow[]> => {
      if (!userId) return [];
      const { data, error } = await fetchExerciseProgressionData(userId, exerciseName);
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export function useProgramProgression(programId: string, exerciseName: string) {
  return useQuery({
    queryKey: progressionKeys.program(programId, exerciseName),
    enabled: !!programId && !!exerciseName,
    queryFn: async (): Promise<ProgramProgressionData | null> => {
      const { data, error } = await fetchProgramProgressionData(programId, exerciseName);
      if (error) throw new Error(error);
      return data ?? null;
    },
  });
}
