import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';
import { ExerciseItem } from '../components/ExerciseItem';
import { ExercisePhase } from '../lib/formatExercisePhase';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { commonStyles } from '../styles/common';
import { Exercise } from '../types/workout';
import { fetchExercisesByWorkoutId, createExercise, fetchPhasesByExerciseId, deleteWorkout } from '@evil-empire/peaktrack-services';

export default function AddExercises() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const { settings } = useUserSettings();
	const weightUnit = settings?.weight_unit || 'kg';
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
						<ExerciseItem
							key={exercise.id}
							exercise={exercise}
							phases={exercisePhases[exercise.id] || []}
							onEdit={() => router.push({ pathname: '/edit-exercise', params: { exerciseId: exercise.id, exerciseName: exercise.name } })}
							unit={weightUnit}
						/>
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
	bottomContainer: {
		marginTop: 'auto',
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
