import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  fetchProgramsByUserId,
  fetchProgramById,
  fetchProgramSessionsByProgramId,
  fetchProgramExercisesBySessionIds,
  fetchProgramRmsByProgramId,
  fetchProgramSessionsForDateRange,
  createProgram as createProgramSvc,
  updateProgram as updateProgramSvc,
  deleteProgram as deleteProgramSvc,
  assignProgramStart as assignProgramStartSvc,
  upsertProgramSession,
  upsertProgramExercise,
  deleteProgramSession,
  deleteAllProgramSessions,
  upsertProgramRm as upsertProgramRmSvc,
  resolveSessionDates,
  materializeProgramSession as materializeProgramSessionSvc,
  incrementProgramSlip,
  type MaterializeExerciseInput,
} from '@evil-empire/peaktrack-services';
import type {
  Program,
  ProgramExercise,
  ProgramRepetitionMaximum,
  ProgramSession,
  ProgramSessionForDate,
} from '@evil-empire/types';
import { workoutKeys } from './use-workouts';

export const programKeys = {
  all: ['programs'] as const,
  byUser: (userId: string) => [...programKeys.all, 'user', userId] as const,
  detail: (programId: string) => [...programKeys.all, 'detail', programId] as const,
  sessionsForRange: (userId: string, start: string, end: string) =>
    [...programKeys.all, 'sessions-range', userId, start, end] as const,
};

export function usePrograms(userId: string | undefined) {
  return useQuery({
    queryKey: programKeys.byUser(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<Program[]> => {
      if (!userId) return [];
      const { data, error } = await fetchProgramsByUserId(userId);
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export interface ProgramDetail {
  program: Program;
  sessions: ProgramSession[];
  exercises: ProgramExercise[];
  rms: ProgramRepetitionMaximum[];
}

export function useProgramDetail(programId: string | undefined) {
  return useQuery({
    queryKey: programKeys.detail(programId ?? ''),
    enabled: !!programId,
    queryFn: async (): Promise<ProgramDetail> => {
      if (!programId) throw new Error('Missing programId');
      const { data: program, error: pErr } = await fetchProgramById(programId);
      if (pErr || !program) throw new Error(pErr ?? 'Program not found');

      const { data: sessions, error: sErr } =
        await fetchProgramSessionsByProgramId(programId);
      if (sErr) throw new Error(sErr);
      const sessList = sessions ?? [];

      const exsResult = sessList.length
        ? await fetchProgramExercisesBySessionIds(sessList.map((s) => s.id))
        : { data: [] as ProgramExercise[], error: null };
      if (exsResult.error) throw new Error(exsResult.error);

      const { data: rms, error: rmErr } = await fetchProgramRmsByProgramId(programId);
      if (rmErr) throw new Error(rmErr);

      return {
        program,
        sessions: sessList,
        exercises: exsResult.data ?? [],
        rms: rms ?? [],
      };
    },
  });
}

export function useCreateProgram(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; description?: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await createProgramSvc({
        user_id: userId,
        name: vars.name,
        description: vars.description ?? null,
        // Duration is updated when a plan is saved; default to 1 week so the
        // DB CHECK (> 0, ≤ 52) is satisfied.
        duration_weeks: 1,
      });
      if (error || !data) throw new Error(error ?? 'Failed to create program');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      patch: Parameters<typeof updateProgramSvc>[1];
    }) => {
      const { data, error } = await updateProgramSvc(vars.id, vars.patch);
      if (error || !data) throw new Error(error ?? 'Failed to update program');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (programId: string) => {
      const { error } = await deleteProgramSvc(programId);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}

export function useAssignProgramStart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      isoYear: number;
      isoWeek: number;
    }) => {
      const { data, error } = await assignProgramStartSvc(
        vars.id,
        vars.isoYear,
        vars.isoWeek,
      );
      if (error || !data) throw new Error(error ?? 'Failed to assign start week');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}

export interface SavePlanSession {
  weekOffset: number;
  dayOfWeek: number;
  exerciseName: string;
  rawInput: string;
}

/**
 * Replace every session in a program with the supplied list, then update the
 * program's duration_weeks. Mirrors the mobile editor's all-or-nothing save:
 * `deleteAllProgramSessions` cascades to exercises (workouts.program_session_id
 * is ON DELETE SET NULL, so already-materialized history is preserved).
 */
export function useSaveProgramPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      programId: string;
      sessions: SavePlanSession[];
      durationWeeks: number;
    }) => {
      const { error: delErr } = await deleteAllProgramSessions(vars.programId);
      if (delErr) throw new Error(delErr);

      for (const s of vars.sessions) {
        const { data: created, error: sErr } = await upsertProgramSession({
          program_id: vars.programId,
          week_offset: s.weekOffset,
          day_of_week: s.dayOfWeek,
        });
        if (sErr || !created) throw new Error(sErr ?? 'Failed to create session');
        const { error: eErr } = await upsertProgramExercise({
          program_session_id: created.id,
          order_index: 0,
          name: s.exerciseName,
          raw_input: s.rawInput,
          notes: null,
        });
        if (eErr) {
          await deleteProgramSession(created.id);
          throw new Error(eErr);
        }
      }

      const { error: updErr } = await updateProgramSvc(vars.programId, {
        duration_weeks: vars.durationWeeks,
      });
      if (updErr) throw new Error(updErr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}

/**
 * Project active programs onto a calendar date range. Returns one entry per
 * (session, date) tuple — including those already materialized into a real
 * workout (with `materializedWorkoutId` set). Callers typically render only
 * the un-materialized ones, since the real workout already shows in the
 * normal workouts list.
 */
export function useProgramSessionsForDateRange(
  userId: string | undefined,
  start: string,
  end: string,
) {
  return useQuery({
    queryKey: programKeys.sessionsForRange(userId ?? '', start, end),
    enabled: !!userId && !!start && !!end,
    queryFn: async (): Promise<ProgramSessionForDate[]> => {
      if (!userId) return [];
      const { data, error } = await fetchProgramSessionsForDateRange(
        userId,
        parseISO(start),
        parseISO(end),
        {
          resolveSessionDates,
          formatDate: (d) => format(d, 'yyyy-MM-dd'),
        },
      );
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
}

export function useMaterializeProgramSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      session_id: string;
      target_date: string;
      name: string;
      exercises: MaterializeExerciseInput[];
    }) => {
      const { data, error } = await materializeProgramSessionSvc(vars);
      if (error || !data) throw new Error(error ?? 'Failed to materialize session');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workoutKeys.all });
      qc.invalidateQueries({ queryKey: [...programKeys.all, 'sessions-range'] });
    },
  });
}

export function useSkipProgramSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (programId: string) => {
      const { data, error } = await incrementProgramSlip(programId);
      if (error || !data) throw new Error(error ?? 'Failed to skip program');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}

export function useUpsertProgramRm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      programId: string;
      exerciseName: string;
      weight: number;
      source: 'lookup' | 'partial_match' | 'manual';
      testedAt?: string | null;
    }) => {
      const { data, error } = await upsertProgramRmSvc({
        program_id: vars.programId,
        exercise_name: vars.exerciseName,
        weight: vars.weight,
        source: vars.source,
        tested_at: vars.testedAt ?? null,
      });
      if (error || !data) throw new Error(error ?? 'Failed to save RM');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: programKeys.all });
    },
  });
}
