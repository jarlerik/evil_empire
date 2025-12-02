import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
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
	created_at: string;
}

export default function AddExercises() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const [exerciseName, setExerciseName] = useState('');
	const [exercises, setExercises] = useState<ExerciseDB[]>([]);
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

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

	const formatExercisePhase = (phase: ExercisePhase) => {
		// Handle RM build format
		if (phase.exercise_type === 'rm_build' && phase.target_rm) {
			return `Build to ${phase.target_rm}RM`;
		}
		
		// Handle circuit format
		if (phase.exercise_type === 'circuit' && phase.circuit_exercises) {
			let circuitExercises: Array<{reps: string, name: string}> = [];
			
			// Handle JSONB string from database
			if (typeof phase.circuit_exercises === 'string') {
				try {
					circuitExercises = JSON.parse(phase.circuit_exercises);
				} catch (e) {
					return `${phase.sets} sets of ${phase.circuit_exercises}`;
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
				
				return `${phase.sets}× ${exercisesStr}`;
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
				return `${phase.sets}×${phase.repetitions} @ ${weightStr}, ${rirStr}`;
			} else {
				return `${phase.sets}×${phase.repetitions}, ${rirStr}`;
			}
		}
		
		// Handle compound exercises
		if (phase.compound_reps && phase.compound_reps.length > 0) {
			const compoundRepsStr = phase.compound_reps.join(' + ');
			const weightStr = phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`;
			return `${phase.sets}×${compoundRepsStr} @ ${weightStr}`;
		}
		
		// Handle multiple weights
		if (phase.weights && phase.weights.length > 1) {
			const weightStr = phase.weights.map(w => `${w}kg`).join(' ');
			return `${phase.sets}×${phase.repetitions} @ ${weightStr}`;
		}
		
		// Handle simple format
		const weightStr = phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`;
		return `${phase.sets}×${phase.repetitions} @ ${weightStr}`;
	};

	useFocusEffect(
		useCallback(() => {
			fetchExercises();
		}, [workoutId])
	);

	const handleAddExercise = async () => {
		if (!exerciseName.trim() || !workoutId || !supabase) return;
		setIsLoading(true);
		await supabase.from('exercises').insert([{ name: exerciseName.trim(), workout_id: workoutId }]);
		setExerciseName('');
		setIsLoading(false);
		// Refetch exercises and phases
		const { data, error } = await supabase
			.from('exercises')
			.select('*')
			.eq('workout_id', workoutId)
			.order('created_at', { ascending: true });
		if (!error && data) {
			setExercises(data);
			await fetchExercisePhases(data);
		}
	};

	const handleDeleteExercise = async (id: string) => {
		if (!supabase) return;
		setDeletingId(id);
		await supabase.from('exercises').delete().eq('id', id);
		setDeletingId(null);
		// Refetch exercises and phases
		if (!workoutId) return;
		const { data, error } = await supabase
			.from('exercises')
			.select('*')
			.eq('workout_id', workoutId)
			.order('created_at', { ascending: true });
		if (!error && data) {
			setExercises(data);
			await fetchExercisePhases(data);
		}
	};

	const handleDeleteWorkout = async () => {
		if (!workoutId || !supabase) return;
		const { error } = await supabase
			.from('workouts')
			.delete()
			.eq('id', workoutId);

		if (!error) {
			router.back();
		}
	};

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={{ flexGrow: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<View style={styles.headerRow}>
						<Pressable onPress={() => router.back()} style={styles.backButton}>
							<Text style={styles.backButtonText}>←</Text>
						</Pressable>
						<Text style={styles.title}>{workoutName}</Text>
						<Pressable 
							onPress={handleDeleteWorkout}
							style={styles.deleteWorkoutButton}
						>
							<Text style={styles.deleteWorkoutButtonText}>×</Text>
						</Pressable>
					</View>

					{exercises.map((exercise) => (
							<View key={exercise.id} style={styles.exerciseItem}>
								<View style={styles.exerciseHeader}>
									<View style={styles.exerciseNameContainer}>
										<Text style={styles.exerciseName}>{exercise.name}</Text>
									</View>
									<View style={styles.exerciseButtons}>
										<Pressable onPress={() => router.push({ pathname: '/edit-exercise', params: { exerciseId: exercise.id, exerciseName: exercise.name } })} style={styles.editButton}>
											<Ionicons name="pencil-outline" size={22} color="#fff" />
										</Pressable>
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
						))}

					<View style={styles.bottomContainer}>
						<TextInput
							style={styles.input}
							value={exerciseName}
							onChangeText={setExerciseName}
							placeholder="Exercise name"
							placeholderTextColor="#666"
							returnKeyType="done"
							onSubmitEditing={handleAddExercise}
							editable={!isLoading}
						/>
						<Pressable style={styles.button} onPress={handleAddExercise} disabled={isLoading}>
							<Text style={styles.buttonText}>{isLoading ? 'Adding...' : 'Add exercise'}</Text>
						</Pressable>
					</View>
				</View>
			</ScrollView>
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
	input: {
		backgroundColor: '#111',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
	},
	button: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	exerciseList: {
		marginTop: 20,
	},
	exerciseItem: {
		backgroundColor: '#111',
		padding: 16,
		borderRadius: 8,
		marginBottom: 12,
	},
	exerciseHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	exerciseButtons: {
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
	editButton: {
		padding: 8,
		marginRight: 8,
	},
	deleteButton: {
		padding: 8,
	},
	bottomContainer: {
		marginTop: 'auto',
	},
	phasesContainer: {
		marginTop: 12,
	},
	phaseText: {
		color: '#666',
		fontSize: 14,
		marginTop: 4,
	},
	deleteWorkoutButton: {
		padding: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	deleteWorkoutButtonText: {
		color: '#666',
		fontSize: 24,
		lineHeight: 32,
	},
});
