export interface ServiceResult<T> {
	data: T | null;
	error: string | null;
}

export interface RepetitionMaximum {
	id: string;
	user_id: string;
	exercise_name: string;
	reps: number;
	weight: number;
	date: string;
	created_at: string;
	updated_at: string;
}

export interface UserSettingsRow {
	id?: string;
	user_id: string;
	weight_unit: 'kg' | 'lbs';
	user_weight: string;
	updated_at?: string;
}
