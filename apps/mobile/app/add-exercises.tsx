import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';
import { formatExercisePhase, ExercisePhase } from '../lib/formatExercisePhase';
import { commonStyles } from '../styles/common';
import { Exercise } from '../types/workout';
import { fetchExercisesByWorkoutId, createExercise } from '../services/exerciseService';
import { fetchPhasesByExerciseId } from '../services/exercisePhaseService';
import { deleteWorkout } from '../services/workoutService';

export default function AddExercises() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const [exerciseName, setExerciseName] = useState('');
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});
	const [isLoading, setIsLoading] = useState(false);

	const fetchExercises = async () => {
		if (!workoutId) {return;}
		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;
		const { data, error } = await fetchExercisesByWorkoutId(workoutIdStr);
		if (!error && data) {
			setExercises(data);
			// Fetch phases for each exercise
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

	useFocusEffect(
		useCallback(() => {
			fetchExercises();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [workoutId]),
	);

	const handleAddExercise = async () => {
		if (!exerciseName.trim() || !workoutId) {return;}
		setIsLoading(true);

		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;
		const { data, error } = await createExercise(exerciseName.trim(), workoutIdStr);

		if (!error && data) {
			const createdExerciseName = exerciseName.trim();
			setExerciseName('');
			setIsLoading(false);
			// Navigate to edit-exercise with the new exercise
			router.push({
				pathname: '/edit-exercise',
				params: { exerciseId: data.id, exerciseName: createdExerciseName },
			});
		} else {
			setIsLoading(false);
		}
	};

	const handleDeleteWorkout = async () => {
		if (!workoutId) {return;}
		const workoutIdStr = Array.isArray(workoutId) ? workoutId[0] : workoutId;
		const { error } = await deleteWorkout(workoutIdStr);

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
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Pressable onPress={() => router.back()} style={commonStyles.backButton}>
							<Text style={commonStyles.backButtonText}>←</Text>
						</Pressable>
						<Text style={commonStyles.titleFlex}>{workoutName}</Text>
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
						<Button title={isLoading ? 'Adding...' : 'Add exercise'} onPress={handleAddExercise} disabled={isLoading} />
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	headerRow: {
		marginBottom: 40,
	},
	input: {
		backgroundColor: '#262626',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
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
		color: '#C65D24',
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
