export interface Workout {
	id: string;
	name: string;
	user_id: string;
	created_at?: string;
	workout_date?: string;
}

export interface Exercise {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

export interface WorkoutRating {
	id: string;
	workout_id: string;
	rating: number;
	created_at?: string;
}
