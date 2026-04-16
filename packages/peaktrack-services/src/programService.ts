import { parseSetInput } from '@evil-empire/parsers';
import {
	Program,
	ProgramSession,
	ProgramExercise,
	ProgramRepetitionMaximum,
	ProgramSessionForDate,
} from '@evil-empire/types';
import { getSupabaseClient } from './client';
import { ServiceResult } from './types';
import { PhaseInsertData } from './exercisePhaseService';

// ============================================================================
// Programs CRUD
// ============================================================================

export async function fetchProgramsByUserId(
	userId: string,
): Promise<ServiceResult<Program[]>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('programs')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function fetchProgramById(
	programId: string,
): Promise<ServiceResult<Program>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('programs')
		.select('*')
		.eq('id', programId)
		.maybeSingle();

	if (error) {
		return { data: null, error: error.message };
	}
	if (!data) {
		return { data: null, error: 'Program not found' };
	}
	return { data, error: null };
}

export async function createProgram(input: {
	user_id: string;
	name: string;
	description?: string | null;
	duration_weeks: number;
}): Promise<ServiceResult<Program>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('programs')
		.insert([
			{
				user_id: input.user_id,
				name: input.name.trim(),
				description: input.description ?? null,
				duration_weeks: input.duration_weeks,
				status: 'draft',
			},
		])
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function updateProgram(
	programId: string,
	patch: Partial<
		Pick<
			Program,
			| 'name'
			| 'description'
			| 'duration_weeks'
			| 'status'
			| 'start_iso_year'
			| 'start_iso_week'
		>
	>,
): Promise<ServiceResult<Program>> {
	const supabase = getSupabaseClient();
	const normalized: typeof patch = { ...patch };
	if (normalized.name !== undefined) {
		normalized.name = normalized.name.trim();
	}
	const { data, error } = await supabase
		.from('programs')
		.update(normalized)
		.eq('id', programId)
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function deleteProgram(
	programId: string,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();
	const { error } = await supabase.from('programs').delete().eq('id', programId);
	if (error) {
		return { data: null, error: error.message };
	}
	return { data: null, error: null };
}

export async function assignProgramStart(
	programId: string,
	isoYear: number,
	isoWeek: number,
): Promise<ServiceResult<Program>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('programs')
		.update({
			start_iso_year: isoYear,
			start_iso_week: isoWeek,
			status: 'active',
		})
		.eq('id', programId)
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

// ============================================================================
// Sessions
// ============================================================================

export async function fetchProgramSessionsByProgramId(
	programId: string,
): Promise<ServiceResult<ProgramSession[]>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('program_sessions')
		.select('*')
		.eq('program_id', programId)
		.order('week_offset', { ascending: true })
		.order('day_of_week', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function upsertProgramSession(input: {
	id?: string;
	program_id: string;
	week_offset: number;
	day_of_week: number;
	name?: string | null;
}): Promise<ServiceResult<ProgramSession>> {
	const supabase = getSupabaseClient();
	if (input.id) {
		const { data, error } = await supabase
			.from('program_sessions')
			.update({
				week_offset: input.week_offset,
				day_of_week: input.day_of_week,
				name: input.name ?? null,
			})
			.eq('id', input.id)
			.select()
			.single();

		if (error) {
			return { data: null, error: error.message };
		}
		return { data, error: null };
	}

	const { data, error } = await supabase
		.from('program_sessions')
		.insert([
			{
				program_id: input.program_id,
				week_offset: input.week_offset,
				day_of_week: input.day_of_week,
				name: input.name ?? null,
			},
		])
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function deleteProgramSession(
	sessionId: string,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();
	const { error } = await supabase
		.from('program_sessions')
		.delete()
		.eq('id', sessionId);
	if (error) {
		return { data: null, error: error.message };
	}
	return { data: null, error: null };
}

/**
 * Idempotent "find-or-create" for a session keyed on (program_id, week_offset, day_of_week).
 * Used by the matrix editor when adding an exercise to a day that has no row yet.
 */
export async function getOrCreateProgramSession(input: {
	program_id: string;
	week_offset: number;
	day_of_week: number;
}): Promise<ServiceResult<ProgramSession>> {
	const supabase = getSupabaseClient();
	const { data: existing, error: fetchErr } = await supabase
		.from('program_sessions')
		.select('*')
		.eq('program_id', input.program_id)
		.eq('week_offset', input.week_offset)
		.eq('day_of_week', input.day_of_week)
		.maybeSingle();

	if (fetchErr) {
		return { data: null, error: fetchErr.message };
	}
	if (existing) {
		return { data: existing, error: null };
	}

	return upsertProgramSession({
		program_id: input.program_id,
		week_offset: input.week_offset,
		day_of_week: input.day_of_week,
	});
}

// ============================================================================
// Exercises
// ============================================================================

export async function fetchProgramExercisesBySessionIds(
	sessionIds: string[],
): Promise<ServiceResult<ProgramExercise[]>> {
	if (sessionIds.length === 0) {
		return { data: [], error: null };
	}
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('program_exercises')
		.select('*')
		.in('program_session_id', sessionIds)
		.order('order_index', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function upsertProgramExercise(input: {
	id?: string;
	program_session_id: string;
	order_index: number;
	name: string;
	raw_input: string;
	notes?: string | null;
}): Promise<ServiceResult<ProgramExercise>> {
	const trimmedName = input.name.trim();
	if (trimmedName.length === 0) {
		return { data: null, error: 'Exercise name cannot be empty' };
	}
	const trimmedInput = input.raw_input.trim();
	const parsed = parseSetInput(trimmedInput);
	if (!parsed.isValid) {
		return {
			data: null,
			error: parsed.errorMessage ?? 'Unrecognized set format',
		};
	}

	const supabase = getSupabaseClient();
	if (input.id) {
		const { data, error } = await supabase
			.from('program_exercises')
			.update({
				program_session_id: input.program_session_id,
				order_index: input.order_index,
				name: trimmedName,
				raw_input: trimmedInput,
				notes: input.notes ?? null,
			})
			.eq('id', input.id)
			.select()
			.single();

		if (error) {
			return { data: null, error: error.message };
		}
		return { data, error: null };
	}

	const { data, error } = await supabase
		.from('program_exercises')
		.insert([
			{
				program_session_id: input.program_session_id,
				order_index: input.order_index,
				name: trimmedName,
				raw_input: trimmedInput,
				notes: input.notes ?? null,
			},
		])
		.select()
		.single();

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function deleteProgramExercise(
	exerciseId: string,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();
	const { error } = await supabase
		.from('program_exercises')
		.delete()
		.eq('id', exerciseId);
	if (error) {
		return { data: null, error: error.message };
	}
	return { data: null, error: null };
}

// ============================================================================
// Program RMs (snapshots)
// ============================================================================

export async function fetchProgramRmsByProgramId(
	programId: string,
): Promise<ServiceResult<ProgramRepetitionMaximum[]>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('program_repetition_maximums')
		.select('*')
		.eq('program_id', programId)
		.order('exercise_name', { ascending: true });

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function fetchProgramRmsByProgramIds(
	programIds: string[],
): Promise<ServiceResult<ProgramRepetitionMaximum[]>> {
	if (programIds.length === 0) {
		return { data: [], error: null };
	}
	const supabase = getSupabaseClient();
	const { data, error } = await supabase
		.from('program_repetition_maximums')
		.select('*')
		.in('program_id', programIds);

	if (error) {
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function upsertProgramRm(input: {
	program_id: string;
	exercise_name: string;
	weight: number;
	tested_at?: string | null;
	source: 'lookup' | 'partial_match' | 'manual';
}): Promise<ServiceResult<ProgramRepetitionMaximum>> {
	const trimmedName = input.exercise_name.trim();
	if (trimmedName.length === 0) {
		return { data: null, error: 'exercise_name cannot be empty' };
	}
	if (!Number.isFinite(input.weight) || input.weight <= 0) {
		return { data: null, error: 'weight must be a positive number' };
	}

	const supabase = getSupabaseClient();

	// Hand-rolled upsert on (program_id, LOWER(exercise_name)) — PostgREST
	// doesn't expose ON CONFLICT on functional unique indexes, so do
	// fetch-then-write and catch unique_violation (23505) to handle races.
	const findExisting = async () => {
		const { data: rows, error: fetchErr } = await supabase
			.from('program_repetition_maximums')
			.select('id, exercise_name')
			.eq('program_id', input.program_id);
		if (fetchErr) {
			return { existing: null, error: fetchErr.message };
		}
		const needle = trimmedName.toLowerCase();
		const match =
			(rows ?? []).find(r => r.exercise_name.trim().toLowerCase() === needle) ?? null;
		return { existing: match, error: null };
	};

	const { existing, error: findErr } = await findExisting();
	if (findErr) {
		return { data: null, error: findErr };
	}

	if (existing) {
		const { data, error } = await supabase
			.from('program_repetition_maximums')
			.update({
				exercise_name: trimmedName,
				weight: input.weight,
				tested_at: input.tested_at ?? null,
				source: input.source,
			})
			.eq('id', existing.id)
			.select()
			.single();
		if (error) {
			return { data: null, error: error.message };
		}
		return { data, error: null };
	}

	const { data, error } = await supabase
		.from('program_repetition_maximums')
		.insert([
			{
				program_id: input.program_id,
				exercise_name: trimmedName,
				weight: input.weight,
				tested_at: input.tested_at ?? null,
				source: input.source,
			},
		])
		.select()
		.single();

	if (error) {
		// Unique violation — concurrent write won. Re-find and update.
		const code = (error as { code?: string }).code;
		if (code === '23505') {
			const { existing: racer, error: refindErr } = await findExisting();
			if (refindErr || !racer) {
				return { data: null, error: refindErr ?? 'Unique violation but row not found' };
			}
			const { data: updated, error: updateErr } = await supabase
				.from('program_repetition_maximums')
				.update({
					exercise_name: trimmedName,
					weight: input.weight,
					tested_at: input.tested_at ?? null,
					source: input.source,
				})
				.eq('id', racer.id)
				.select()
				.single();
			if (updateErr) {
				return { data: null, error: updateErr.message };
			}
			return { data: updated, error: null };
		}
		return { data: null, error: error.message };
	}
	return { data, error: null };
}

export async function deleteProgramRm(
	programRmId: string,
): Promise<ServiceResult<null>> {
	const supabase = getSupabaseClient();
	const { error } = await supabase
		.from('program_repetition_maximums')
		.delete()
		.eq('id', programRmId);
	if (error) {
		return { data: null, error: error.message };
	}
	return { data: null, error: null };
}

// ============================================================================
// Read the joined shape used by the home screen
// ============================================================================

/**
 * Compute, for the given date range, all program sessions the user has active.
 * Returns one entry per (session, calendar_date) tuple, joined with exercises
 * and per-program RM snapshots.
 *
 * Bounded 5-query shape: programs, sessions, exercises, materialized-links, rms.
 *
 * Date math happens client-side to keep SQL simple and predictable; mobile
 * date-fns is the canonical ISO week oracle.
 */
export async function fetchProgramSessionsForDateRange(
	userId: string,
	startDate: Date,
	endDate: Date,
	scheduling: {
		resolveSessionsInRange: (
			program: Pick<Program, 'start_iso_year' | 'start_iso_week' | 'duration_weeks'>,
			startDate: Date,
			endDate: Date,
		) => Array<{ date: Date; week_offset: number; day_of_week: number }>;
		formatDate: (d: Date) => string; // yyyy-MM-dd
	},
): Promise<ServiceResult<ProgramSessionForDate[]>> {
	const supabase = getSupabaseClient();

	// 1. Active programs for the user
	const { data: programs, error: pErr } = await supabase
		.from('programs')
		.select('*')
		.eq('user_id', userId)
		.eq('status', 'active');

	if (pErr) {
		return { data: null, error: pErr.message };
	}
	if (!programs || programs.length === 0) {
		return { data: [], error: null };
	}

	// Client-side: for each program, compute which (week_offset, day_of_week)
	// tuples inside [startDate, endDate] intersect the program window.
	const tuplesByProgram = new Map<
		string,
		Array<{ date: Date; week_offset: number; day_of_week: number }>
	>();
	for (const p of programs as Program[]) {
		const tuples = scheduling.resolveSessionsInRange(p, startDate, endDate);
		if (tuples.length > 0) {
			tuplesByProgram.set(p.id, tuples);
		}
	}

	const activeProgramIds = Array.from(tuplesByProgram.keys());
	if (activeProgramIds.length === 0) {
		return { data: [], error: null };
	}

	const weekOffsetSet = new Set<number>();
	const dayOfWeekSet = new Set<number>();
	for (const tuples of tuplesByProgram.values()) {
		for (const t of tuples) {
			weekOffsetSet.add(t.week_offset);
			dayOfWeekSet.add(t.day_of_week);
		}
	}

	// 2. Sessions matching any (week_offset, day_of_week) in the visible range
	const { data: sessions, error: sErr } = await supabase
		.from('program_sessions')
		.select('*')
		.in('program_id', activeProgramIds)
		.in('week_offset', Array.from(weekOffsetSet))
		.in('day_of_week', Array.from(dayOfWeekSet));

	if (sErr) {
		return { data: null, error: sErr.message };
	}
	const allSessions = (sessions ?? []) as ProgramSession[];
	if (allSessions.length === 0) {
		return { data: [], error: null };
	}

	const sessionIds = allSessions.map(s => s.id);

	// 3. Exercises for those sessions
	const { data: exercises, error: eErr } = await supabase
		.from('program_exercises')
		.select('*')
		.in('program_session_id', sessionIds)
		.order('order_index', { ascending: true });

	if (eErr) {
		return { data: null, error: eErr.message };
	}
	const exercisesBySession = new Map<string, ProgramExercise[]>();
	for (const ex of (exercises ?? []) as ProgramExercise[]) {
		const list = exercisesBySession.get(ex.program_session_id) ?? [];
		list.push(ex);
		exercisesBySession.set(ex.program_session_id, list);
	}

	// 4. Materialized workout links
	const { data: materialized, error: mErr } = await supabase
		.from('workouts')
		.select('id, program_session_id')
		.in('program_session_id', sessionIds);

	if (mErr) {
		return { data: null, error: mErr.message };
	}
	const materializedBySession = new Map<string, string>();
	for (const m of (materialized ?? []) as Array<{ id: string; program_session_id: string }>) {
		materializedBySession.set(m.program_session_id, m.id);
	}

	// 5. RM snapshots
	const { data: rms, error: rErr } = await supabase
		.from('program_repetition_maximums')
		.select('*')
		.in('program_id', activeProgramIds);

	if (rErr) {
		return { data: null, error: rErr.message };
	}
	const rmsByProgram = new Map<string, ProgramRepetitionMaximum[]>();
	for (const r of (rms ?? []) as ProgramRepetitionMaximum[]) {
		const list = rmsByProgram.get(r.program_id) ?? [];
		list.push(r);
		rmsByProgram.set(r.program_id, list);
	}

	// Merge: for each tuple under each program, find the matching session row (if any).
	const programById = new Map<string, Program>();
	for (const p of programs as Program[]) {
		programById.set(p.id, p);
	}
	const sessionByKey = new Map<string, ProgramSession>();
	for (const s of allSessions) {
		sessionByKey.set(`${s.program_id}|${s.week_offset}|${s.day_of_week}`, s);
	}

	const out: ProgramSessionForDate[] = [];
	for (const [programId, tuples] of tuplesByProgram.entries()) {
		const program = programById.get(programId);
		if (!program) {
			continue;
		}
		for (const t of tuples) {
			const session = sessionByKey.get(`${programId}|${t.week_offset}|${t.day_of_week}`);
			if (!session) {
				continue; // no row for this slot → no prescription for this day
			}
			const sessionExercises = exercisesBySession.get(session.id) ?? [];
			if (sessionExercises.length === 0) {
				continue; // session row exists but has no exercises → nothing to show
			}
			out.push({
				program,
				session,
				exercises: sessionExercises,
				rms: rmsByProgram.get(programId) ?? [],
				date: scheduling.formatDate(t.date),
				materializedWorkoutId: materializedBySession.get(session.id) ?? null,
			});
		}
	}

	return { data: out, error: null };
}

// ============================================================================
// Materialize (thin RPC wrapper)
// ============================================================================

export interface MaterializeExerciseInput {
	name: string;
	order_index: number;
	phase: Omit<PhaseInsertData, 'exercise_id'>;
}

export async function materializeProgramSession(input: {
	session_id: string;
	target_date: string; // yyyy-MM-dd
	name: string;
	exercises: MaterializeExerciseInput[];
}): Promise<ServiceResult<{ workout_id: string }>> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase.rpc('materialize_program_session', {
		p_session_id: input.session_id,
		p_target_date: input.target_date,
		p_name: input.name,
		p_exercises: input.exercises,
	});

	if (error) {
		return { data: null, error: error.message };
	}
	if (!data) {
		return { data: null, error: 'materialize_program_session returned no workout id' };
	}
	return { data: { workout_id: data as string }, error: null };
}
