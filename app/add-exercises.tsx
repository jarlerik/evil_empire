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
			.order('created_at', { ascending: false });
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
				.order('created_at', { ascending: false });
			
			if (!error && data) {
				phasesMap[exercise.id] = data;
			}
		}
		
		setExercisePhases(phasesMap);
	};

	const formatExercisePhase = (phase: ExercisePhase) => {
		if (phase.compound_reps && phase.compound_reps.length > 0) {
			const compoundRepsStr = phase.compound_reps.join(' + ');
			const weightStr = phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`;
			return `${phase.sets}×${compoundRepsStr} @ ${weightStr}`;
		}
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
			.order('created_at', { ascending: false });
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
			.order('created_at', { ascending: false });
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
				contentContainerStyle={{ flex: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backButtonText}>←</Text>
					</Pressable>

					<View style={styles.workoutHeader}>
						<Text style={styles.title}>{workoutName}</Text>
						<Pressable 
							onPress={handleDeleteWorkout}
							style={styles.deleteWorkoutButton}
						>
							<Text style={styles.deleteWorkoutButtonText}>×</Text>
						</Pressable>
					</View>
					<Text style={styles.subtitle}>
						{exercises.length === 0 ? 'No exercises yet' : 'Exercises'}
					</Text>

					{[...exercises]
						.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
						.map((exercise) => (
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
	backButton: {
		marginTop: 20,
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
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 8,
		marginBottom: 40,
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
	workoutHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 40,
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
