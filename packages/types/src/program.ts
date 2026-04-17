export interface Program {
	id: string;
	user_id: string;
	name: string;
	description: string | null;
	duration_weeks: number;
	start_iso_year: number | null;
	start_iso_week: number | null;
	status: 'draft' | 'active' | 'archived';
	created_at?: string;
	updated_at?: string;
}

export interface ProgramSession {
	id: string;
	program_id: string;
	/** DB-managed: trigger copies user_id from parent programs row. */
	user_id: string;
	week_offset: number; // 0-indexed
	day_of_week: number; // 1..7 ISO (Mon=1)
	name: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface ProgramExercise {
	id: string;
	program_session_id: string;
	/** DB-managed: trigger copies user_id from parent program_sessions row. */
	user_id: string;
	order_index: number;
	name: string;
	raw_input: string;
	notes: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface ProgramRepetitionMaximum {
	id: string;
	program_id: string;
	/** DB-managed: trigger copies user_id from parent programs row. */
	user_id: string;
	exercise_name: string;
	weight: number;
	tested_at: string | null; // yyyy-MM-dd, nullable
	source: 'lookup' | 'partial_match' | 'manual';
	created_at?: string;
	updated_at?: string;
}

/** Computed, never persisted. What the home screen renders. */
export interface ProgramSessionForDate {
	program: Program;
	session: ProgramSession;
	exercises: ProgramExercise[];
	rms: ProgramRepetitionMaximum[];
	date: string; // yyyy-MM-dd
	materializedWorkoutId: string | null;
}
