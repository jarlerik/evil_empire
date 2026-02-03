import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated, Alert, LayoutAnimation, UIManager } from 'react-native';
import { commonStyles } from '../styles/common';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
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

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StartWorkout() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});

	// Workout state management
	const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
	const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0);
	const [currentSetNumber, setCurrentSetNumber] = useState<number>(1);
	const [restTimeRemaining, setRestTimeRemaining] = useState<number>(0);
	const restTimerIntervalRef = useRef<number | null>(null);
	const blinkOpacity = useRef(new Animated.Value(1)).current;
	const scrollViewRef = useRef<ScrollView>(null);
	const exercisePositions = useRef<Record<number, number>>({});
	const beepSound = useRef<Audio.Sound | null>(null);

	// Edit execution modal state
	const [isEditModalVisible, setIsEditModalVisible] = useState(false);
	const [currentExerciseSaved, setCurrentExerciseSaved] = useState(false);

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
				// Check if we're on the last set of this phase
				if (currentSetNumber === setCount + phase.sets) {
					// Return the next phase if it exists
					return phases[i + 1] || null;
				}
				return null; // Not on last set of phase
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

	const isLastExercise = (): boolean => {
		return currentExerciseIndex === exercises.length - 1;
	};

	const isLastSet = (): boolean => {
		return currentSetNumber === getTotalSetsForExercise(exercises[currentExerciseIndex].id);
	};

	// Cleanup rest timer
	useEffect(() => {
		return () => {
			if (restTimerIntervalRef.current) {
				clearInterval(restTimerIntervalRef.current);
			}
		};
	}, []);

	// Load beep sound on mount
	useEffect(() => {
		const loadSound = async () => {
			const { sound } = await Audio.Sound.createAsync(
				require('../assets/sounds/beep.wav'),
			);
			beepSound.current = sound;
		};
		loadSound();

		return () => {
			if (beepSound.current) {
				beepSound.current.unloadAsync();
			}
		};
	}, []);

	// Audio and vibration feedback for rest timer countdown
	useEffect(() => {
		if (workoutState === 'rest' && restTimeRemaining <= 5 && restTimeRemaining > 0) {
			if (beepSound.current) {
				beepSound.current.replayAsync();
			}
		}
		if (workoutState === 'rest' && restTimeRemaining === 0) {
			if (beepSound.current) {
				beepSound.current.replayAsync();
			}
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}
	}, [restTimeRemaining, workoutState]);

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

	// Blinking animation for WORKING and RESTING states
	useEffect(() => {
		if (workoutState === 'work' || workoutState === 'rest') {
			const blinkAnimation = Animated.loop(
				Animated.sequence([
					Animated.timing(blinkOpacity, {
						toValue: 0.3,
						duration: 500,
						useNativeDriver: true,
					}),
					Animated.timing(blinkOpacity, {
						toValue: 1,
						duration: 500,
						useNativeDriver: true,
					}),
				]),
			);
			blinkAnimation.start();
			return () => blinkAnimation.stop();
		} else {
			blinkOpacity.setValue(1);
		}
	}, [workoutState, blinkOpacity]);

	useFocusEffect(
		useCallback(() => {
			fetchExercises();
			// eslint-disable-next-line react-hooks/exhaustive-deps
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
	};

	const rest = () => {
		const phase = getCurrentExercisePhase();
		if (!phase) {return;}

		if (isLastSet()) {
			setWorkoutState('exercise_done');
			setRestTimeRemaining(0);
			return;
		}

		const restTime = phase.rest_time_seconds || 0;
		if (restTime > 0) {
			setRestTimeRemaining(restTime);
			setWorkoutState('rest');

			if (restTimerIntervalRef.current) {
				clearInterval(restTimerIntervalRef.current);
			}

			restTimerIntervalRef.current = setInterval(() => {
				setRestTimeRemaining((prev) => {
					if (prev <= 1) {
						if (restTimerIntervalRef.current) {
							clearInterval(restTimerIntervalRef.current);
							restTimerIntervalRef.current = null;
						}
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		} else {
			work();
		}
	};

	const work = () => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}

		const currentExercise = exercises[currentExerciseIndex];
		const totalSets = getTotalSetsForExercise(currentExercise.id);

		if (currentSetNumber < totalSets) {
			setCurrentSetNumber(currentSetNumber + 1);
			setWorkoutState('work');
			setRestTimeRemaining(0);
			return;
		}
		if (!isLastExercise() || !isLastSet()) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			setRestTimeRemaining(0);
			return;
		}

		if (isLastExercise() && !isLastSet()) {
			setWorkoutState('exercise_done');
			setRestTimeRemaining(0);
			return;
		}
	};

	const saveCurrentExerciseWithPlannedValues = async () => {
		// Skip if already saved manually via the edit modal
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
				execution_status: 'completed',
				executed_at: new Date().toISOString(),
			});
		}
	};

	const handleNextExercise = async () => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}

		// Save the current exercise with planned values before moving on
		await saveCurrentExerciseWithPlannedValues();

		if (!isLastExercise() && isLastSet()) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			setRestTimeRemaining(0);
			setCurrentExerciseSaved(false); // Reset for the new exercise
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
				router.back();
				break;
		}
	};

	const getButtonText = (): string => {
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

	const currentExercise = currentExerciseIndex >= 0 ? exercises[currentExerciseIndex] : null;
	const currentPhase = getCurrentExercisePhase();
	const nextPhase = getNextPhase();
	const showNextPhase = workoutState === 'rest' && isLastSetOfCurrentPhase() && nextPhase !== null;
	const currentSetInPhase = getCurrentSetInPhase();

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
							currentSetInPhase={currentSetInPhase}
							restTimeRemaining={restTimeRemaining}
							blinkOpacity={blinkOpacity}
							onEditFinishedExercise={handleEditFinishedExercise}
						/>
				</View>

				<View style={styles.bottomContainer}>
					<Button
						title={getButtonText()}
						onPress={handleButtonPress}
						disabled={workoutState === 'rest' && restTimeRemaining > 0}
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
				/>
			)}
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
		flex: 0.1,
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
