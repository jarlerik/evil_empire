import { useState, useCallback } from 'react';
import { LayoutAnimation } from 'react-native';
import { ExercisePhase } from '../lib/formatExercisePhase';

export type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

interface Exercise {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

interface UseWorkoutStateProps {
	exercises: Exercise[];
	exercisePhases: Record<string, ExercisePhase[]>;
	onStartRestTimer: (duration: number) => void;
	onClearRestTimer: () => void;
	onSetRestTimeRemaining: (time: number) => void;
	restTimeRemaining: number;
}

interface UseWorkoutStateReturn {
	workoutState: WorkoutState;
	setWorkoutState: (state: WorkoutState) => void;
	currentExerciseIndex: number;
	currentSetNumber: number;
	getTotalSetsForExercise: (exerciseId: string) => number;
	getCurrentExercisePhase: () => ExercisePhase | null;
	isLastExercise: () => boolean;
	isLastSet: () => boolean;
	isWorkoutComplete: () => boolean;
	handleStartWorkout: () => void;
	handleButtonPress: () => void;
	getButtonText: () => string;
}

export function useWorkoutState({
	exercises,
	exercisePhases,
	onStartRestTimer,
	onClearRestTimer,
	onSetRestTimeRemaining,
	restTimeRemaining,
}: UseWorkoutStateProps): UseWorkoutStateReturn {
	const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
	const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(-1);
	const [currentSetNumber, setCurrentSetNumber] = useState<number>(1);

	// Get total sets for an exercise (sum of all phases' sets)
	const getTotalSetsForExercise = useCallback((exerciseId: string): number => {
		const phases = exercisePhases[exerciseId] || [];
		return phases.reduce((total, phase) => total + phase.sets, 0);
	}, [exercisePhases]);

	// Get current exercise phase data
	const getCurrentExercisePhase = useCallback((): ExercisePhase | null => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return null;
		}
		const currentExercise = exercises[currentExerciseIndex];
		const phases = exercisePhases[currentExercise.id] || [];

		// Find which phase the current set belongs to
		let setCount = 0;
		for (const phase of phases) {
			if (currentSetNumber <= setCount + phase.sets) {
				return phase;
			}
			setCount += phase.sets;
		}

		return phases[phases.length - 1] || null;
	}, [currentExerciseIndex, currentSetNumber, exercises, exercisePhases]);

	const isLastExercise = useCallback((): boolean => {
		return currentExerciseIndex === exercises.length - 1;
	}, [currentExerciseIndex, exercises.length]);

	const isLastSet = useCallback((): boolean => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return false;
		}
		return currentSetNumber === getTotalSetsForExercise(exercises[currentExerciseIndex].id);
	}, [currentExerciseIndex, currentSetNumber, exercises, getTotalSetsForExercise]);

	const isWorkoutComplete = useCallback((): boolean => {
		return isLastExercise() && isLastSet();
	}, [isLastExercise, isLastSet]);

	const handleStartWorkout = useCallback(() => {
		if (exercises.length === 0) return;
		LayoutAnimation.configureNext(LayoutAnimation.create(
			300,
			LayoutAnimation.Types.easeInEaseOut,
			LayoutAnimation.Properties.opacity
		));
		setWorkoutState('work');
		setCurrentExerciseIndex(0);
		setCurrentSetNumber(1);
		onSetRestTimeRemaining(0);
	}, [exercises.length, onSetRestTimeRemaining]);

	const work = useCallback(() => {
		onClearRestTimer();

		// Move to next set
		const currentExercise = exercises[currentExerciseIndex];
		const totalSets = getTotalSetsForExercise(currentExercise.id);

		if (currentSetNumber < totalSets) {
			setCurrentSetNumber(currentSetNumber + 1);
			setWorkoutState('work');
			onSetRestTimeRemaining(0);
			return;
		}
		if (!isLastExercise() || !isLastSet()) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			onSetRestTimeRemaining(0);
			return;
		}

		if (isLastExercise() && !isLastSet()) {
			setWorkoutState('exercise_done');
			onSetRestTimeRemaining(0);
			return;
		}
	}, [currentExerciseIndex, currentSetNumber, exercises, getTotalSetsForExercise, isLastExercise, isLastSet, onClearRestTimer, onSetRestTimeRemaining]);

	const rest = useCallback(() => {
		const phase = getCurrentExercisePhase();
		if (!phase) return;

		if (isLastSet()) {
			setWorkoutState('exercise_done');
			onSetRestTimeRemaining(0);
			return;
		}

		const restTime = phase.rest_time_seconds || 0;
		if (restTime > 0) {
			setWorkoutState('rest');
			onStartRestTimer(restTime);
		} else {
			// No rest time, immediately move to next set
			work();
		}
	}, [getCurrentExercisePhase, isLastSet, onSetRestTimeRemaining, onStartRestTimer, work]);

	const handleNextExercise = useCallback(() => {
		onClearRestTimer();

		if (!isLastExercise() && isLastSet()) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			onSetRestTimeRemaining(0);
		}
		if (isLastExercise()) {
			setWorkoutState('exercise_done');
			onSetRestTimeRemaining(0);
		}
		if (isLastExercise() && isLastSet()) {
			setWorkoutState('workout_done');
			onSetRestTimeRemaining(0);
		}
	}, [currentExerciseIndex, isLastExercise, isLastSet, onClearRestTimer, onSetRestTimeRemaining]);

	const handleButtonPress = useCallback(() => {
		switch (workoutState) {
			case 'idle':
				handleStartWorkout();
				break;
			case 'work':
				rest();
				break;
			case 'rest':
				if (restTimeRemaining === 0) {
					work();
				}
				break;
			case 'exercise_done':
				handleNextExercise();
				break;
			case 'workout_done':
				// Navigation handled by parent component
				break;
		}
	}, [workoutState, handleStartWorkout, rest, work, handleNextExercise, restTimeRemaining]);

	const getButtonText = useCallback((): string => {
		switch (workoutState) {
			case 'idle':
				return 'Start workout';
			case 'work':
				if (isLastSet()) {
					return 'Exercise done';
				}
				return 'Rest';
			case 'rest':
				return 'Next set';
			case 'exercise_done':
				if (isLastExercise()) {
					return 'Finish exercise';
				} else {
					return 'Next exercise';
				}
			case 'workout_done':
				return 'Finish workout';
			default:
				return 'Start workout';
		}
	}, [workoutState, isLastExercise, isLastSet]);

	return {
		workoutState,
		setWorkoutState,
		currentExerciseIndex,
		currentSetNumber,
		getTotalSetsForExercise,
		getCurrentExercisePhase,
		isLastExercise,
		isLastSet,
		isWorkoutComplete,
		handleStartWorkout,
		handleButtonPress,
		getButtonText,
	};
}
