// Workout types
export type { Workout, Exercise, WorkoutRating } from './workout';

// Program types
export type {
	Program,
	ProgramSession,
	ProgramExercise,
	ProgramRepetitionMaximum,
	ProgramSessionForDate,
} from './program';

// Re-export parser types for convenience
export type { ParsedSetData, ExercisePhase } from '@evil-empire/parsers';

// Coach types are also available via the `@evil-empire/types/coach` subpath
// for consumers that want the narrower import surface.
export type {
	CoachRole,
	CoachMessage,
	CoachPromptRequest,
	CoachPromptResponse,
	CoachFinishReason,
	CoachStreamEvent,
} from './coach';
