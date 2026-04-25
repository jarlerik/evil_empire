import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import {
  fetchRecentExecutionLogs,
  fetchExecutionLogsByExerciseIds,
  fetchWorkoutsByIds,
  fetchExercisesByWorkoutIds,
  fetchWorkoutRatings,
} from '@evil-empire/peaktrack-services';
import type { Workout, Exercise } from '@evil-empire/types';
import type { ExercisePhase } from '@evil-empire/parsers';

export interface HistoryEntry {
  workout: Workout;
  exercises: Exercise[];
  phasesByExerciseId: Record<string, ExercisePhase[]>;
  executedAt: string;
  rating: number | null;
}

export const historyKeys = {
  all: ['history'] as const,
  recent: (userId: string, days: number) => [...historyKeys.all, userId, days] as const,
};

export function useHistory(userId: string | undefined, days = 90) {
  return useQuery({
    queryKey: historyKeys.recent(userId ?? '', days),
    enabled: !!userId,
    queryFn: async (): Promise<HistoryEntry[]> => {
      if (!userId) return [];
      const cutoffISO = subDays(new Date(), days).toISOString();
      const { data: logs, error: logsError } = await fetchRecentExecutionLogs(cutoffISO);
      if (logsError) throw new Error(logsError);
      if (!logs || logs.length === 0) return [];

      const workoutMap = new Map<string, string>();
      for (const log of logs) {
        if (!workoutMap.has(log.workout_id)) {
          workoutMap.set(log.workout_id, log.executed_at);
        }
      }
      const workoutIds = [...workoutMap.keys()];

      const [{ data: workouts }, { data: allExercises }, { data: ratings }] = await Promise.all([
        fetchWorkoutsByIds(workoutIds, userId),
        fetchExercisesByWorkoutIds(workoutIds),
        fetchWorkoutRatings(workoutIds),
      ]);

      if (!workouts) return [];

      const exerciseIds = (allExercises ?? []).map((e) => e.id);
      const { data: allLogs } = await fetchExecutionLogsByExerciseIds(exerciseIds);

      const phasesByExerciseId: Record<string, ExercisePhase[]> = {};
      for (const log of allLogs ?? []) {
        const list = (phasesByExerciseId[log.exercise_id] ??= []);
        list.push({
          id: log.id,
          exercise_id: log.exercise_id,
          sets: log.sets,
          repetitions: log.repetitions,
          weight: log.weight,
          weights: log.weights ?? undefined,
          compound_reps: log.compound_reps ?? undefined,
          rest_time_seconds: log.rest_time_seconds ?? undefined,
          emom_interval_seconds: log.emom_interval_seconds ?? undefined,
          exercise_type: log.exercise_type ?? undefined,
          circuit_exercises:
            (log.circuit_exercises as { reps: string; name: string }[] | undefined) ?? undefined,
          target_rm: log.target_rm ?? undefined,
          rir_min: log.rir_min ?? undefined,
          rir_max: log.rir_max ?? undefined,
          created_at: log.executed_at,
        });
      }

      const ratingsMap = new Map<string, number>();
      for (const r of ratings ?? []) {
        ratingsMap.set(r.workout_id, r.rating);
      }

      return workoutIds
        .map<HistoryEntry | null>((id) => {
          const workout = workouts.find((w) => w.id === id);
          if (!workout) return null;
          const exercises = (allExercises ?? []).filter((e) => e.workout_id === id);
          const workoutPhases: Record<string, ExercisePhase[]> = {};
          for (const ex of exercises) {
            const phases = phasesByExerciseId[ex.id];
            if (phases) workoutPhases[ex.id] = phases;
          }
          return {
            workout,
            exercises,
            phasesByExerciseId: workoutPhases,
            executedAt: workoutMap.get(id) ?? '',
            rating: ratingsMap.get(id) ?? null,
          };
        })
        .filter((e): e is HistoryEntry => e !== null);
    },
  });
}

export function formatExecutedDate(iso: string): string {
  return format(parseISO(iso), 'EEEE, LLLL d');
}
