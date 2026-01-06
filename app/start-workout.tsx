import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

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

type WorkoutState = 'idle' | 'work' | 'rest' | 'done';

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

	// Check if workout is complete
	const isWorkoutComplete = (): boolean => {
		if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
			return false;
		}
		if (workoutState !== 'done') {
			return false;
		}
		return currentExerciseIndex >= exercises.length - 1;
	};

	// Cleanup rest timer
	useEffect(() => {
		return () => {
			if (restTimerIntervalRef.current) {
				clearInterval(restTimerIntervalRef.current);
			}
		};
	}, []);

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

	const handleStartWorkout = () => {
		if (exercises.length === 0) return;
		setWorkoutState('work');
		setCurrentExerciseIndex(0);
		setCurrentSetNumber(1);
		setRestTimeRemaining(0);
	};

	const handleRest = () => {
		const phase = getCurrentExercisePhase();
		if (!phase) return;
		
		// Check if this is the last set - if so, skip rest and go to done
		const currentExercise = exercises[currentExerciseIndex];
		const totalSets = getTotalSetsForExercise(currentExercise.id);
		if (currentSetNumber >= totalSets) {
			// Last set completed, move to done state
			setWorkoutState('done');
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
			handleContinue();
		}
	};

	const handleContinue = () => {
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
		} else {
			// All sets completed for current exercise
			setWorkoutState('done');
			setRestTimeRemaining(0);
		}
	};

	const handleNextExercise = () => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}
		
		if (currentExerciseIndex < exercises.length - 1) {
			setCurrentExerciseIndex(currentExerciseIndex + 1);
			setCurrentSetNumber(1);
			setWorkoutState('work');
			setRestTimeRemaining(0);
		}
	};

	const handleButtonPress = () => {
		switch (workoutState) {
			case 'idle':
				handleStartWorkout();
				break;
			case 'work':
				handleRest();
				break;
			case 'rest':
				if (restTimeRemaining === 0) {
					handleContinue();
				}
				break;
			case 'done':
				if (isWorkoutComplete()) {
					// Workout complete, navigate back
					router.back();
				} else {
					handleNextExercise();
				}
				break;
		}
	};

	const getButtonText = (): string => {
		switch (workoutState) {
			case 'idle':
				return 'Start workout';
			case 'work':
				// Check if this is the last set
				if (currentExerciseIndex >= 0 && currentExerciseIndex < exercises.length) {
					const currentExercise = exercises[currentExerciseIndex];
					const totalSets = getTotalSetsForExercise(currentExercise.id);
					if (currentSetNumber >= totalSets) {
						return 'Done';
					}
				}
				return 'Rest';
			case 'rest':
				return restTimeRemaining === 0 ? 'Next set' : 'Next set';
			case 'done':
				return isWorkoutComplete() ? 'Finish workout' : 'Next exercise';
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
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backButtonText}>←</Text>
					</Pressable>
					<Text style={styles.title}>{workoutName}</Text>
				</View>

				<View style={styles.mainContent}>
					<ScrollView 
						style={styles.exercisesContainer}
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

					<View style={styles.timerContainer}>
						{workoutState !== 'idle' && currentExerciseIndex >= 0 ? (
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
										<Text style={styles.timerStateWork}>WORKING</Text>
									)}
									{workoutState === 'rest' && (
										<>
											<Text style={styles.timerStateRest}>RESTING</Text>
											<Text style={styles.timerCountdown}>
												{formatTime(restTimeRemaining)}
											</Text>
										</>
									)}
									{workoutState === 'done' && (
										<Text style={styles.timerStateDone}>Done</Text>
									)}
								</View>
							</>
						) : (
							<Text style={styles.timerPlaceholder}>[ TIMER COMPONENT ]</Text>
						)}
					</View>
				</View>

				<View style={styles.bottomContainer}>
					<Pressable 
						style={[
							styles.button,
							workoutState === 'rest' && restTimeRemaining > 0 && styles.buttonDisabled
						]} 
						onPress={handleButtonPress}
						disabled={workoutState === 'rest' && restTimeRemaining > 0}
					>
						<Text style={styles.buttonText}>{getButtonText()}</Text>
					</Pressable>
				</View>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
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
		color: '#fff',
		flex: 1,
	},
	mainContent: {
		flex: 1,
		flexDirection: 'column',
	},
	exercisesContainer: {
		flex: 0.1,
	},
	exercisesContent: {
		paddingBottom: 12,
	},
	timerContainer: {
		flex: 0.9,
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: '#fff',
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
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
		color: '#FFA500',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerStateRest: {
		color: '#00FF00',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 12,
	},
	timerStateDone: {
		color: '#00FF00',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerCountdown: {
		color: '#00FF00',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerPlaceholder: {
		color: '#fff',
		fontSize: 14,
		textDecorationLine: 'underline',
	},
	button: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	exerciseItem: {
		backgroundColor: '#111',
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
		color: '#666',
		fontSize: 14,
		marginTop: 4,
	},
});

