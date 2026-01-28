import { renderHook, act } from '@testing-library/react-native';
import { useWorkoutState } from '../useWorkoutState';
import { ExercisePhase } from '../../lib/formatExercisePhase';
import { LayoutAnimation } from 'react-native';

// Mock LayoutAnimation
jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
jest.spyOn(LayoutAnimation, 'create').mockImplementation(() => ({
	duration: 300,
	create: { type: 'easeInEaseOut', property: 'opacity' },
	update: { type: 'easeInEaseOut' },
	delete: { type: 'easeInEaseOut', property: 'opacity' },
}));

const mockExercise = (id: string, name: string) => ({
	id,
	name,
	workout_id: 'workout-1',
});

const mockPhase = (id: string, sets: number, reps: number, weight: number, restTime?: number): ExercisePhase => ({
	id,
	exercise_id: 'ex-1',
	sets,
	repetitions: reps,
	weight,
	rest_time_seconds: restTime,
	created_at: '2024-01-01',
});

describe('useWorkoutState', () => {
	const defaultProps = {
		exercises: [mockExercise('ex-1', 'Squat'), mockExercise('ex-2', 'Bench Press')],
		exercisePhases: {
			'ex-1': [mockPhase('p1', 3, 5, 100, 120)],
			'ex-2': [mockPhase('p2', 3, 8, 60, 90)],
		},
		onStartRestTimer: jest.fn(),
		onClearRestTimer: jest.fn(),
		onSetRestTimeRemaining: jest.fn(),
		restTimeRemaining: 0,
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('initial state', () => {
		it('should start in idle state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			expect(result.current.workoutState).toBe('idle');
			expect(result.current.currentExerciseIndex).toBe(-1);
			expect(result.current.currentSetNumber).toBe(1);
		});
	});

	describe('getTotalSetsForExercise', () => {
		it('should return total sets for an exercise', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			expect(result.current.getTotalSetsForExercise('ex-1')).toBe(3);
			expect(result.current.getTotalSetsForExercise('ex-2')).toBe(3);
		});

		it('should return 0 for unknown exercise', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			expect(result.current.getTotalSetsForExercise('unknown')).toBe(0);
		});

		it('should sum sets across multiple phases', () => {
			const props = {
				...defaultProps,
				exercisePhases: {
					'ex-1': [mockPhase('p1', 2, 5, 100), mockPhase('p2', 3, 3, 110)],
					'ex-2': [mockPhase('p3', 3, 8, 60)],
				},
			};

			const { result } = renderHook(() => useWorkoutState(props));

			expect(result.current.getTotalSetsForExercise('ex-1')).toBe(5); // 2 + 3
		});
	});

	describe('handleStartWorkout', () => {
		it('should transition to work state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.workoutState).toBe('work');
			expect(result.current.currentExerciseIndex).toBe(0);
			expect(result.current.currentSetNumber).toBe(1);
		});

		it('should not start if no exercises', () => {
			const props = { ...defaultProps, exercises: [] };
			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.workoutState).toBe('idle');
		});

		it('should call onSetRestTimeRemaining with 0', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(defaultProps.onSetRestTimeRemaining).toHaveBeenCalledWith(0);
		});
	});

	describe('getCurrentExercisePhase', () => {
		it('should return null when workout not started', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			expect(result.current.getCurrentExercisePhase()).toBeNull();
		});

		it('should return current phase after starting workout', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			const phase = result.current.getCurrentExercisePhase();
			expect(phase).not.toBeNull();
			expect(phase?.id).toBe('p1');
		});

		it('should return correct phase for set in multi-phase exercise', () => {
			const props = {
				...defaultProps,
				exercisePhases: {
					'ex-1': [mockPhase('p1', 2, 5, 100), mockPhase('p2', 2, 3, 110)],
					'ex-2': [mockPhase('p3', 3, 8, 60)],
				},
			};

			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
			});

			// Set 1 and 2 should be in phase p1
			expect(result.current.getCurrentExercisePhase()?.id).toBe('p1');
		});
	});

	describe('isLastExercise', () => {
		it('should return false when not on last exercise', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.isLastExercise()).toBe(false);
		});

		it('should return true when on last exercise', () => {
			const props = {
				...defaultProps,
				exercises: [mockExercise('ex-1', 'Squat')],
			};

			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.isLastExercise()).toBe(true);
		});
	});

	describe('isLastSet', () => {
		it('should return false when not on last set', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.isLastSet()).toBe(false);
		});

		it('should return true when on last set', () => {
			const props = {
				...defaultProps,
				exercisePhases: {
					'ex-1': [mockPhase('p1', 1, 5, 100)],
					'ex-2': [mockPhase('p2', 3, 8, 60)],
				},
			};

			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.isLastSet()).toBe(true);
		});
	});

	describe('isWorkoutComplete', () => {
		it('should return false during workout', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.isWorkoutComplete()).toBe(false);
		});

		it('should return true on last set of last exercise', () => {
			const props = {
				...defaultProps,
				exercises: [mockExercise('ex-1', 'Squat')],
				exercisePhases: {
					'ex-1': [mockPhase('p1', 1, 5, 100)],
				},
			};

			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.isWorkoutComplete()).toBe(true);
		});
	});

	describe('getButtonText', () => {
		it('should return "Start workout" in idle state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			expect(result.current.getButtonText()).toBe('Start workout');
		});

		it('should return "Rest" in work state when not last set', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.getButtonText()).toBe('Rest');
		});

		it('should return "Exercise done" in work state when on last set', () => {
			const props = {
				...defaultProps,
				exercisePhases: {
					'ex-1': [mockPhase('p1', 1, 5, 100)],
					'ex-2': [mockPhase('p2', 3, 8, 60)],
				},
			};

			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
			});

			expect(result.current.getButtonText()).toBe('Exercise done');
		});

		it('should return "Next set" in rest state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.setWorkoutState('rest');
			});

			expect(result.current.getButtonText()).toBe('Next set');
		});

		it('should return "Next exercise" in exercise_done state when not last exercise', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
				result.current.setWorkoutState('exercise_done');
			});

			expect(result.current.getButtonText()).toBe('Next exercise');
		});

		it('should return "Finish exercise" in exercise_done state when on last exercise', () => {
			const props = {
				...defaultProps,
				exercises: [mockExercise('ex-1', 'Squat')],
			};

			const { result } = renderHook(() => useWorkoutState(props));

			act(() => {
				result.current.handleStartWorkout();
				result.current.setWorkoutState('exercise_done');
			});

			expect(result.current.getButtonText()).toBe('Finish exercise');
		});

		it('should return "Finish workout" in workout_done state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.setWorkoutState('workout_done');
			});

			expect(result.current.getButtonText()).toBe('Finish workout');
		});
	});

	describe('handleButtonPress', () => {
		it('should start workout when in idle state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleButtonPress();
			});

			expect(result.current.workoutState).toBe('work');
		});

		it('should transition to rest state from work state', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.handleStartWorkout();
			});

			act(() => {
				result.current.handleButtonPress();
			});

			// Should transition to rest (since there's a rest_time_seconds)
			expect(result.current.workoutState).toBe('rest');
			expect(defaultProps.onStartRestTimer).toHaveBeenCalledWith(120);
		});
	});

	describe('setWorkoutState', () => {
		it('should allow manual state changes', () => {
			const { result } = renderHook(() => useWorkoutState(defaultProps));

			act(() => {
				result.current.setWorkoutState('work');
			});

			expect(result.current.workoutState).toBe('work');

			act(() => {
				result.current.setWorkoutState('rest');
			});

			expect(result.current.workoutState).toBe('rest');
		});
	});
});
