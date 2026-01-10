import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated, Alert, LayoutAnimation, UIManager } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';

interface ExerciseDB {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

interface ExercisePhase {
	id: string;
	exercise_id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
	exercise_type?: string;
	notes?: string;
	target_rm?: number;
	rir_min?: number;
	rir_max?: number;
	circuit_exercises?: Array<{reps: string, name: string}> | string;
	rest_time_seconds?: number;
	created_at: string;
}

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StartWorkout() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const [exercises, setExercises] = useState<ExerciseDB[]>([]);
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});
	
	// Workout state management
	const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
	const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(-1);
	const [currentSetNumber, setCurrentSetNumber] = useState<number>(1);
	const [restTimeRemaining, setRestTimeRemaining] = useState<number>(0);
	const restTimerIntervalRef = useRef<number | null>(null);
	const blinkOpacity = useRef(new Animated.Value(1)).current;
	const scrollViewRef = useRef<ScrollView>(null);
	const exercisePositions = useRef<Record<number, number>>({});
	const beepSound = useRef<Audio.Sound | null>(null);

	const fetchExercises = async () => {
		if (!workoutId || !supabase) return;
		const { data, error } = await supabase
			.from('exercises')
			.select('*')
			.eq('workout_id', workoutId)
			.order('created_at', { ascending: true });
		if (!error && data) {
			setExercises(data);
			// Fetch phases for each exercise
			await fetchExercisePhases(data);
		}
	};

	const fetchExercisePhases = async (exerciseList: ExerciseDB[]) => {
		if (!supabase) return;
		
		const phasesMap: Record<string, ExercisePhase[]> = {};
		
		for (const exercise of exerciseList) {
			const { data, error } = await supabase
				.from('exercise_phases')
				.select('*')
				.eq('exercise_id', exercise.id)
				.order('created_at', { ascending: true });
			
			if (!error && data) {
				phasesMap[exercise.id] = data;
			}
		}
		
		setExercisePhases(phasesMap);
	};

	// Helper function to format time as MM:SS
	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	// Get total sets for an exercise (sum of all phases' sets)
	const getTotalSetsForExercise = (exerciseId: string): number => {
		const phases = exercisePhases[exerciseId] || [];
		return phases.reduce((total, phase) => total + phase.sets, 0);
	};

	// Get current exercise phase data
	const getCurrentExercisePhase = (): ExercisePhase | null => {
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
	};

	const isLastExercise = (): boolean => {
		return currentExerciseIndex === exercises.length - 1;
	};
	const isLastSet = (): boolean => {
		return currentSetNumber === getTotalSetsForExercise(exercises[currentExerciseIndex].id);
	};
	const isWorkoutComplete = (): boolean => {
		return isLastExercise() && isLastSet();
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
				require('../assets/sounds/beep.wav')
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
			// Play beep sound for final 5 seconds
			if (beepSound.current) {
				beepSound.current.replayAsync();
			}
		}
		if (workoutState === 'rest' && restTimeRemaining === 0) {
			if (beepSound.current) {
				beepSound.current.replayAsync();
			}
			// Vibrate when timer ends
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}
	}, [restTimeRemaining, workoutState]);

	// Auto-scroll to current exercise
	useEffect(() => {
		if (currentExerciseIndex >= 0 && scrollViewRef.current) {
			const yPosition = exercisePositions.current[currentExerciseIndex];
			if (yPosition !== undefined) {
				// Offset to show some context above the current exercise
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
				])
			);
			blinkAnimation.start();
			return () => blinkAnimation.stop();
		} else {
			blinkOpacity.setValue(1);
		}
	}, [workoutState, blinkOpacity]);

	const formatExercisePhase = (phase: ExercisePhase) => {
		// Helper function to append rest time
		const appendRestTime = (str: string): string => {
			if (phase.rest_time_seconds !== undefined && phase.rest_time_seconds !== null) {
				return `${str} ${phase.rest_time_seconds}s`;
			}
			return str;
		};
		
		// Handle RM build format
		if (phase.exercise_type === 'rm_build' && phase.target_rm) {
			return appendRestTime(`Build to ${phase.target_rm}RM`);
		}
		
		// Handle circuit format
		if (phase.exercise_type === 'circuit' && phase.circuit_exercises) {
			let circuitExercises: Array<{reps: string, name: string}> = [];
			
			// Handle JSONB string from database
			if (typeof phase.circuit_exercises === 'string') {
				try {
					circuitExercises = JSON.parse(phase.circuit_exercises);
				} catch (e) {
					return appendRestTime(`${phase.sets} sets of ${phase.circuit_exercises}`);
				}
			} else {
				circuitExercises = phase.circuit_exercises;
			}
			
			if (circuitExercises.length > 0) {
				const exercisesStr = circuitExercises.map(ex => {
					if (ex.reps && ex.name) {
						return `${ex.reps} ${ex.name}`;
					} else if (ex.name) {
						return ex.name;
					}
					return '';
				}).filter(s => s.length > 0).join(', ');
				
				return appendRestTime(`${phase.sets}× ${exercisesStr}`);
			}
		}
		
		// Handle RIR format
		if (phase.rir_min !== undefined && phase.rir_min !== null) {
			const rirStr = phase.rir_max && phase.rir_max !== phase.rir_min 
				? `${phase.rir_min}-${phase.rir_max}RIR`
				: `${phase.rir_min}RIR`;
			
			// If there's a weight, include it
			if (phase.weight > 0) {
				const weightStr = phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`;
				return appendRestTime(`${phase.sets}×${phase.repetitions} @ ${weightStr}, ${rirStr}`);
			} else {
				return appendRestTime(`${phase.sets}×${phase.repetitions}, ${rirStr}`);
			}
		}
		
		// Handle compound exercises
		if (phase.compound_reps && phase.compound_reps.length > 0) {
			const compoundRepsStr = phase.compound_reps.join(' + ');
			const weightStr = phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`;
			return appendRestTime(`${phase.sets}×${compoundRepsStr} @ ${weightStr}`);
		}
		
		// Handle multiple weights
		if (phase.weights && phase.weights.length > 1) {
			const weightStr = phase.weights.map(w => `${w}kg`).join(' ');
			return appendRestTime(`${phase.sets}×${phase.repetitions} @ ${weightStr}`);
		}
		
		// Handle simple format
		const weightStr = phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`;
		return appendRestTime(`${phase.sets}×${phase.repetitions} @ ${weightStr}`);
	};

	useFocusEffect(
		useCallback(() => {
			fetchExercises();
		}, [workoutId])
	);

	const handleBackPress = () => {
		if (workoutState !== 'workout_done') {
			Alert.alert(
				'Abort Workout?',
				'Your progress will not be saved.',
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Abort', style: 'destructive', onPress: () => router.back() },
				]
			);
		} else {
			router.back();
		}
	};

	const handleStartWorkout = () => {
		if (exercises.length === 0) return;
		LayoutAnimation.configureNext(LayoutAnimation.create(
			300,
			LayoutAnimation.Types.easeInEaseOut,
			LayoutAnimation.Properties.opacity
		));
		setWorkoutState('work');
		setCurrentExerciseIndex(0);
		setCurrentSetNumber(1);
		setRestTimeRemaining(0);
	};

	const rest = () => {
		const phase = getCurrentExercisePhase();
		if (!phase) return;
		
		if (isLastSet()) {
			setWorkoutState('exercise_done');
			setRestTimeRemaining(0);
			return;
		}
		
		const restTime = phase.rest_time_seconds || 0;
		if (restTime > 0) {
			setRestTimeRemaining(restTime);
			setWorkoutState('rest');
			
			// Clear any existing interval
			if (restTimerIntervalRef.current) {
				clearInterval(restTimerIntervalRef.current);
			}
			
			// Start countdown
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
			// No rest time, immediately move to next set
			work();
		}
	};

	const work = () => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}
		
		// Move to next set
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

	const handleNextExercise = () => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}
		
		if (!isLastExercise() && isLastSet()) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			setRestTimeRemaining(0);
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

	const handleButtonPress = () => {
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

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<View style={styles.container}>
				<View style={styles.headerRow}>
					<Pressable onPress={handleBackPress} style={styles.backButton}>
						<Text style={styles.backButtonText}>←</Text>
					</Pressable>
					<Text style={styles.title}>{workoutName}</Text>
				</View>

				<View style={styles.mainContent}>
					<ScrollView
						ref={scrollViewRef}
						style={[
							styles.exercisesContainer,
							workoutState === 'idle' && styles.exercisesContainerExpanded
						]}
						contentContainerStyle={styles.exercisesContent}
						keyboardShouldPersistTaps="handled"
					>
						{exercises.map((exercise, index) => {
							const isActive = currentExerciseIndex === index && workoutState !== 'idle';
							return (
								<View
									key={exercise.id}
									style={[
										styles.exerciseItem,
										isActive && styles.exerciseItemActive
									]}
									onLayout={(event) => {
										exercisePositions.current[index] = event.nativeEvent.layout.y;
									}}
								>
									<View style={styles.exerciseHeader}>
										<View style={styles.exerciseNameContainer}>
											<Text style={styles.exerciseName}>{exercise.name}</Text>
										</View>
									</View>
									{exercisePhases[exercise.id] && exercisePhases[exercise.id].length > 0 && (
										<View style={styles.phasesContainer}>
											{exercisePhases[exercise.id].map((phase) => (
												<Text key={phase.id} style={styles.phaseText}>
													{formatExercisePhase(phase)}
												</Text>
											))}
										</View>
									)}
								</View>
							);
						})}
					</ScrollView>

					<View style={[
						styles.timerContainer,
						workoutState === 'idle' && styles.timerContainerHidden
					]}>
						{workoutState !== 'idle' && currentExerciseIndex >= 0 && (
							<>
								{/* Top half: Exercise name, set number, repetitions */}
								<View style={styles.timerTopHalf}>
									{(() => {
										const currentExercise = exercises[currentExerciseIndex];
										const totalSets = getTotalSetsForExercise(currentExercise.id);
										const phase = getCurrentExercisePhase();
										const reps = phase?.repetitions || 0;

										return (
											<>
												<Text style={styles.timerExerciseName}>
													{currentSetNumber}/{totalSets} {currentExercise.name}
												</Text>
												<Text style={styles.timerRepetitions}>
													{reps} {reps === 1 ? 'repetition' : 'repetitions'}
												</Text>
											</>
										);
									})()}
								</View>

								{/* Bottom half: State and countdown */}
								<View style={styles.timerBottomHalf}>
									{workoutState === 'work' && (
										<Animated.Text style={[styles.timerStateWork, { opacity: blinkOpacity }]}>WORKING</Animated.Text>
									)}
									{workoutState === 'rest' && (
										<>
											<Animated.Text style={[styles.timerStateRest, { opacity: blinkOpacity }]}>RESTING</Animated.Text>
											<Animated.Text style={[styles.timerCountdown, { opacity: blinkOpacity }]}>
												{formatTime(restTimeRemaining)}
											</Animated.Text>
										</>
									)}
									{workoutState === 'exercise_done' && (
										<Text
											style={styles.timerStateDone}
											adjustsFontSizeToFit
											numberOfLines={1}
										>
											Exercise done
										</Text>
									)}
									{workoutState === 'exercise_done' && (
										<Button title="Update completed exercise" variant="secondary"/>
									)}
									{workoutState === 'workout_done' && (
										<Text
											style={styles.timerStateDone}
											adjustsFontSizeToFit
											numberOfLines={1}
										>
											Workout done
										</Text>
									)}
								</View>
							</>
						)}
					</View>
				</View>

				<View style={styles.bottomContainer}>
					<Button
						title={getButtonText()}
						onPress={handleButtonPress}
						disabled={workoutState === 'rest' && restTimeRemaining > 0}
					/>
				</View>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#171717',
		padding: 20,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 20,
		marginBottom: 40,
	},
	backButton: {
		marginRight: 12,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 24,
	},
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#c65d24',
		textTransform: 'uppercase',
		flex: 1,
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
	timerContainer: {
		flex: 0.9,
		backgroundColor: '#262626',
		borderWidth: 1,
		borderColor: '#fff',
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
		overflow: 'hidden',
	},
	timerContainerHidden: {
		flex: 0,
		height: 0,
		padding: 0,
		borderWidth: 0,
	},
	timerTopHalf: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	timerBottomHalf: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	timerExerciseName: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 12,
	},
	timerRepetitions: {
		color: '#fff',
		fontSize: 18,
		textAlign: 'center',
	},
	timerStateWork: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerStateRest: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 12,
	},
	timerStateDone: {
		color: '#C65D24',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerCountdown: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	exerciseItem: {
		backgroundColor: '#262626',
		padding: 16,
		borderRadius: 8,
		marginBottom: 12,
	},
	exerciseItemActive: {
		borderWidth: 1,
		borderColor: '#fff',
	},
	exerciseHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	exerciseNameContainer: {
		flex: 1,
	},
	exerciseName: {
		color: '#fff',
		fontSize: 16,
	},
	bottomContainer: {
		marginTop: 20,
	},
	phasesContainer: {
		marginTop: 12,
	},
	phaseText: {
		color: '#C65D24',
		fontSize: 14,
		marginTop: 4,
	},
});

