import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, LayoutAnimation, UIManager } from 'react-native';
import { commonStyles } from '../styles/common';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';
import { ExercisePhase } from '../lib/formatExercisePhase';
import { EditExecutionModal, ExecutionLogData } from '../components/EditExecutionModal';
import { WorkoutExerciseItem } from '../components/WorkoutExerciseItem';
import { WorkoutTimerDisplay } from '../components/WorkoutTimerDisplay';
import { Exercise } from '../types/workout';
import { fetchExercisesByWorkoutId } from '../services/exerciseService';
import { fetchPhasesByExerciseId } from '../services/exercisePhaseService';
import { insertExecutionLog } from '../services/workoutExecutionLogService';
import { saveWorkoutRating } from '../services/workoutRatingService';
import { WorkoutRatingModal } from '../components/WorkoutRatingModal';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { useUserSettings } from '../contexts/UserSettingsContext';

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StartWorkout() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const { settings } = useUserSettings();
	const weightUnit = settings?.weight_unit || 'kg';
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});

	// Workout state management
	const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
	const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0);
	const [currentSetNumber, setCurrentSetNumber] = useState<number>(1);
	const scrollViewRef = useRef<ScrollView>(null);
	const exercisePositions = useRef<Record<number, number>>({});

	// Edit execution modal state
	const [isEditModalVisible, setIsEditModalVisible] = useState(false);
	const [currentExerciseSaved, setCurrentExerciseSaved] = useState(false);

	// Rating modal state
	const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);

	const getTotalSetsForExercise = (exerciseId: string): number => {
		const phases = exercisePhases[exerciseId] || [];
		return phases.reduce((total, phase) => total + phase.sets, 0);
	};

	const getCurrentExercisePhase = (): ExercisePhase | null => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return null;
		}
		const currentExercise = exercises[currentExerciseIndex];
		const phases = exercisePhases[currentExercise.id] || [];

		let setCount = 0;
		for (const phase of phases) {
			if (currentSetNumber <= setCount + phase.sets) {
				return phase;
			}
			setCount += phase.sets;
		}

		return phases[phases.length - 1] || null;
	};

	const isEmomPhase = (): boolean => {
		const phase = getCurrentExercisePhase();
		return !!(phase?.emom_interval_seconds);
	};

	const isLastExercise = (): boolean => {
		return currentExerciseIndex === exercises.length - 1;
	};

	const isLastSet = (): boolean => {
		return currentSetNumber === getTotalSetsForExercise(exercises[currentExerciseIndex].id);
	};

	// EMOM auto-advance handler — called by the timer hook when countdown reaches 0
	const handleEmomTimerZero = useCallback(() => {
		if (!isLastSet()) {
			work();
		} else {
			setWorkoutState('exercise_done');
		}
	}, [currentExerciseIndex, currentSetNumber, exercises, exercisePhases]);

	const {
		restTimeRemaining,
		blinkOpacity,
		hasActiveCountdown,
		startRestTimer,
		startEmomTimer,
		clearRestTimer,
		setRestTimeRemaining,
	} = useWorkoutTimer({
		workoutState,
		isEmom: isEmomPhase(),
		onEmomTimerZero: handleEmomTimerZero,
	});

	const getNextPhase = (): ExercisePhase | null => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return null;
		}
		const currentExercise = exercises[currentExerciseIndex];
		const phases = exercisePhases[currentExercise.id] || [];

		let setCount = 0;
		for (let i = 0; i < phases.length; i++) {
			const phase = phases[i];
			if (currentSetNumber <= setCount + phase.sets) {
				if (currentSetNumber === setCount + phase.sets) {
					return phases[i + 1] || null;
				}
				return null;
			}
			setCount += phase.sets;
		}

		return null;
	};

	const isLastSetOfCurrentPhase = (): boolean => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return false;
		}
		const currentExercise = exercises[currentExerciseIndex];
		const phases = exercisePhases[currentExercise.id] || [];

		let setCount = 0;
		for (const phase of phases) {
			if (currentSetNumber <= setCount + phase.sets) {
				return currentSetNumber === setCount + phase.sets;
			}
			setCount += phase.sets;
		}

		return false;
	};

	const getCurrentSetInPhase = (): number => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return 1;
		}
		const currentExercise = exercises[currentExerciseIndex];
		const phases = exercisePhases[currentExercise.id] || [];

		let setCount = 0;
		for (const phase of phases) {
			if (currentSetNumber <= setCount + phase.sets) {
				return currentSetNumber - setCount;
			}
			setCount += phase.sets;
		}

		return 1;
	};

	const fetchExercises = async () => {
		if (!workoutId) {return;}
		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;
		const { data, error } = await fetchExercisesByWorkoutId(workoutIdStr);
		if (!error && data) {
			setExercises(data);
			await fetchExercisePhasesForList(data);
		}
	};

	const fetchExercisePhasesForList = async (exerciseList: Exercise[]) => {
		const phasesMap: Record<string, ExercisePhase[]> = {};

		for (const exercise of exerciseList) {
			const { data, error } = await fetchPhasesByExerciseId(exercise.id);

			if (!error && data) {
				phasesMap[exercise.id] = data;
			}
		}

		setExercisePhases(phasesMap);
	};

	// Auto-scroll to current exercise
	useEffect(() => {
		if (currentExerciseIndex >= 0 && scrollViewRef.current) {
			const yPosition = exercisePositions.current[currentExerciseIndex];
			if (yPosition !== undefined) {
				const scrollOffset = Math.max(0, yPosition - 12);
				scrollViewRef.current.scrollTo({ y: scrollOffset, animated: true });
			}
		}
	}, [currentExerciseIndex]);

	useFocusEffect(
		useCallback(() => {
			fetchExercises();
		}, [workoutId]),
	);

	const handleBackPress = () => {
		if (workoutState === 'idle' || workoutState === 'workout_done') {
			router.back();
		} else {
			Alert.alert(
				'Abort Workout?',
				'Your progress will not be saved.',
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Abort', style: 'destructive', onPress: () => router.back() },
				],
			);
		}
	};

	const handleStartWorkout = () => {
		if (exercises.length === 0) {return;}
		LayoutAnimation.configureNext(LayoutAnimation.create(
			300,
			LayoutAnimation.Types.easeInEaseOut,
			LayoutAnimation.Properties.opacity,
		));
		setWorkoutState('work');
		setCurrentExerciseIndex(0);
		setCurrentSetNumber(1);
		setRestTimeRemaining(0);

		// Start EMOM timer immediately if first phase is EMOM
		const firstExercise = exercises[0];
		const firstPhases = exercisePhases[firstExercise.id] || [];
		if (firstPhases.length > 0 && firstPhases[0].emom_interval_seconds) {
			startEmomTimer(firstPhases[0].emom_interval_seconds);
		}
	};

	const rest = () => {
		const phase = getCurrentExercisePhase();
		if (!phase) {return;}

		if (isLastSet()) {
			clearRestTimer();
			setWorkoutState('exercise_done');
			setRestTimeRemaining(0);
			return;
		}

		// EMOM: timer is already running from work phase, just switch state
		if (phase.emom_interval_seconds) {
			setWorkoutState('rest');
			return;
		}

		const restTime = phase.rest_time_seconds || 0;
		if (restTime > 0) {
			startRestTimer(restTime);
			setWorkoutState('rest');
		} else {
			hasActiveCountdown.current = false;
			setWorkoutState('rest');
		}
	};

	const work = () => {
		clearRestTimer();

		const currentExercise = exercises[currentExerciseIndex];
		const totalSets = getTotalSetsForExercise(currentExercise.id);

		if (currentSetNumber < totalSets) {
			const nextSetNumber = currentSetNumber + 1;
			setCurrentSetNumber(nextSetNumber);
			setWorkoutState('work');

			// Start EMOM timer for next set, or clear countdown
			const phases = exercisePhases[currentExercise.id] || [];
			const emomInterval = phases.find(p => p.emom_interval_seconds)?.emom_interval_seconds;
			if (emomInterval) {
				startEmomTimer(emomInterval);
			} else {
				setRestTimeRemaining(0);
			}
			return;
		}
		if (!isLastExercise() || !isLastSet()) {
			const nextIndex = currentExerciseIndex + 1;
			setCurrentExerciseIndex(nextIndex);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			setRestTimeRemaining(0);

			// Start EMOM timer if next exercise's first phase is EMOM
			const nextExercise = exercises[nextIndex];
			if (nextExercise) {
				const nextPhases = exercisePhases[nextExercise.id] || [];
				if (nextPhases.length > 0 && nextPhases[0].emom_interval_seconds) {
					startEmomTimer(nextPhases[0].emom_interval_seconds);
				}
			}
			return;
		}

		if (isLastExercise() && !isLastSet()) {
			setWorkoutState('exercise_done');
			setRestTimeRemaining(0);
			return;
		}
	};

	const saveCurrentExerciseWithPlannedValues = async () => {
		if (currentExerciseSaved) {
			return;
		}

		if (!workoutId || currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return;
		}

		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;
		const currentExercise = exercises[currentExerciseIndex];
		const phases = exercisePhases[currentExercise.id] || [];

		for (const phase of phases) {
			await insertExecutionLog({
				workout_id: workoutIdStr,
				exercise_id: currentExercise.id,
				exercise_phase_id: phase.id,
				sets: phase.sets,
				repetitions: phase.repetitions,
				weight: phase.weight,
				weights: phase.weights || null,
				compound_reps: phase.compound_reps || null,
				rest_time_seconds: phase.rest_time_seconds || null,
				emom_interval_seconds: phase.emom_interval_seconds || null,
				exercise_type: phase.exercise_type || null,
				circuit_exercises: phase.circuit_exercises || null,
				target_rm: phase.target_rm || null,
				rir_min: phase.rir_min ?? null,
				rir_max: phase.rir_max ?? null,
				execution_status: 'completed',
				executed_at: new Date().toISOString(),
			});
		}
	};

	const handleNextExercise = async () => {
		clearRestTimer();

		await saveCurrentExerciseWithPlannedValues();

		if (!isLastExercise() && isLastSet()) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			setRestTimeRemaining(0);
			setCurrentExerciseSaved(false);
		}
		if (isLastExercise()) {
			setWorkoutState('exercise_done');
			setRestTimeRemaining(0);
		}
		if (isLastExercise() && isLastSet()) {
			setWorkoutState('workout_done');
			setRestTimeRemaining(0);
		}
	};

	const handleButtonPress = async () => {
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
				await handleNextExercise();
				break;
			case 'workout_done':
				setIsRatingModalVisible(true);
				break;
		}
	};

	const getButtonText = (): string => {
		const emom = isEmomPhase();
		switch (workoutState) {
			case 'idle':
				return 'Start workout';
			case 'work':
				if (isLastSet() && !emom) {
					return 'Exercise done';
				}
				return emom ? 'Waiting...' : 'Rest';
			case 'rest':
				return emom ? 'Waiting...' : 'Next set';
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
	};

	const handleEditFinishedExercise = () => {
		setIsEditModalVisible(true);
	};

	const handleSaveExecution = async (executionData: ExecutionLogData) => {
		if (!workoutId) {return;}

		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;

		for (const phaseData of executionData.phases) {
			const { parsed } = phaseData;

			await insertExecutionLog({
				workout_id: workoutIdStr,
				exercise_id: executionData.exercise_id,
				exercise_phase_id: phaseData.exercise_phase_id,
				sets: parsed.sets,
				repetitions: parsed.reps,
				weight: parsed.weight,
				weights: parsed.weights || null,
				compound_reps: parsed.compoundReps || null,
				rest_time_seconds: parsed.restTimeSeconds || null,
				emom_interval_seconds: parsed.emomIntervalSeconds || null,
				exercise_type: parsed.exerciseType || null,
				circuit_exercises: parsed.circuitExercises ? JSON.stringify(parsed.circuitExercises) : null,
				target_rm: parsed.targetRm || null,
				rir_min: parsed.rirMin ?? null,
				rir_max: parsed.rirMax ?? null,
				execution_status: 'completed',
				executed_at: new Date().toISOString(),
			});
		}

		setCurrentExerciseSaved(true);
		setIsEditModalVisible(false);
	};

	const handleSkipExecution = () => {
		setIsEditModalVisible(false);
	};

	const handleRatingSave = async (rating: number) => {
		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;
		if (workoutIdStr) {
			await saveWorkoutRating(workoutIdStr, rating);
		}
		setIsRatingModalVisible(false);
		router.back();
	};

	const handleRatingSkip = () => {
		setIsRatingModalVisible(false);
		router.back();
	};

	const currentExercise = currentExerciseIndex >= 0 ? exercises[currentExerciseIndex] : null;
	const currentPhase = getCurrentExercisePhase();
	const nextPhase = getNextPhase();
	const showNextPhase = workoutState === 'rest' && isLastSetOfCurrentPhase() && nextPhase !== null;
	const currentSetInPhase = getCurrentSetInPhase();
	// During rest, show the next set's info so the user can prepare
	const displaySetInPhase = workoutState === 'rest' && !showNextPhase ? currentSetInPhase + 1 : currentSetInPhase;

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<View style={commonStyles.container}>
				<View style={[commonStyles.headerRow, styles.headerRow]}>
					<Pressable onPress={handleBackPress} style={commonStyles.backButton}>
						<Text style={commonStyles.backButtonText}>←</Text>
					</Pressable>
					<Text style={commonStyles.titleFlex}>{workoutName}</Text>
				</View>

				<View style={styles.mainContent}>
					<ScrollView
						ref={scrollViewRef}
						style={[
							styles.exercisesContainer,
							workoutState === 'idle' && styles.exercisesContainerExpanded,
						]}
						contentContainerStyle={styles.exercisesContent}
						keyboardShouldPersistTaps="handled"
					>
						{exercises.map((exercise, index) => (
							<WorkoutExerciseItem
								key={exercise.id}
								exercise={exercise}
								phases={exercisePhases[exercise.id] || []}
								isActive={currentExerciseIndex === index && workoutState !== 'idle'}
								unit={weightUnit}
								onLayout={(y) => {
									exercisePositions.current[index] = y;
								}}
							/>
						))}
					</ScrollView>
						<WorkoutTimerDisplay
							workoutState={workoutState}
							exerciseName={currentExercise?.name}
							exercisePhase={currentPhase}
							allPhases={currentExercise ? exercisePhases[currentExercise.id] || [] : []}
							nextPhase={showNextPhase ? nextPhase : null}
							currentSetInPhase={displaySetInPhase}
							restTimeRemaining={restTimeRemaining}
							blinkOpacity={blinkOpacity}
							onEditFinishedExercise={handleEditFinishedExercise}
						/>
				</View>

				<View style={styles.bottomContainer}>
					<Button
						title={getButtonText()}
						onPress={handleButtonPress}
						disabled={(workoutState === 'rest' && restTimeRemaining > 0) || (isEmomPhase() && (workoutState === 'rest' || workoutState === 'work'))}
					/>
				</View>
			</View>

			{currentExercise && (
				<EditExecutionModal
					visible={isEditModalVisible}
					onClose={() => setIsEditModalVisible(false)}
					onSave={handleSaveExecution}
					onSkip={handleSkipExecution}
					exerciseName={currentExercise.name}
					exerciseId={currentExercise.id}
					phases={exercisePhases[currentExercise.id] || []}
					unit={weightUnit}
				/>
			)}
			<WorkoutRatingModal
				visible={isRatingModalVisible}
				onSave={handleRatingSave}
				onSkip={handleRatingSkip}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	headerRow: {
		marginBottom: 40,
	},
	mainContent: {
		flex: 1,
		flexDirection: 'column',
	},
	exercisesContainer: {
		maxHeight: 200,
	},
	exercisesContainerExpanded: {
		flex: 1,
	},
	exercisesContent: {
		paddingBottom: 12,
	},
	bottomContainer: {
		marginTop: 20,
	},
});
