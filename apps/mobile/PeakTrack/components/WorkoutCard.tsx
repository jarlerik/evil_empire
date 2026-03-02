import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, Workout } from '../types/workout';
import { ExercisePhase, formatExercisePhase } from '../lib/formatExercisePhase';

interface WorkoutCardProps {
	workout: Workout;
	exercises: Exercise[];
	onEdit: () => void;
	onStart: () => void;
	isReadOnly?: boolean;
	isCompleted?: boolean;
	exercisePhases?: Map<string, ExercisePhase[]>;
}

export function WorkoutCard({ workout, exercises, onEdit, onStart, isReadOnly = false, isCompleted = false, exercisePhases }: WorkoutCardProps) {
	return (
		<View style={styles.workoutCard}>
			<View style={[
				styles.workoutCardHeader,
				exercises.length > 0 && styles.workoutCardHeaderWithExercises,
			]}>
				<View style={styles.workoutNameContainer}>
					<Text style={styles.workoutName}>{workout.name}</Text>
				</View>
				{!isReadOnly && !isCompleted && (
					<View style={styles.workoutActions}>
						<Pressable onPress={onEdit} style={styles.actionButton}>
							<Ionicons name="pencil" size={22} color="#fff" />
						</Pressable>
						<Pressable onPress={onStart} style={styles.actionButton}>
							<Ionicons name="play" size={22} color="#fff" />
						</Pressable>
					</View>
				)}
				{isCompleted && !isReadOnly && (
					<View style={styles.workoutActions}>
						<Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
					</View>
				)}
			</View>
			{exercises.length > 0 && (
				<View style={styles.exercisesList}>
					{exercises.map((exercise, index) => {
						const phases = exercisePhases?.get(exercise.id);
						return (
							<View key={exercise.id}>
								<Text style={styles.exerciseText}>
									{index + 1}. {exercise.name}
								</Text>
								{phases && phases.map((phase) => (
									<Text key={phase.id} style={styles.phaseText}>
										{formatExercisePhase(phase)}
									</Text>
								))}
							</View>
						);
					})}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	workoutCard: {
		backgroundColor: '#262626',
		padding: 16,
		borderRadius: 8,
		marginBottom: 12,
	},
	workoutCardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	workoutCardHeaderWithExercises: {
		marginBottom: 8,
	},
	workoutNameContainer: {
		flex: 1,
	},
	workoutName: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	workoutActions: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: 'auto',
	},
	actionButton: {
		padding: 8,
	},
	exercisesList: {
		marginTop: 8,
	},
	exerciseText: {
		color: '#C65D24',
		fontSize: 14,
		marginTop: 2,
	},
	phaseText: {
		color: '#999',
		fontSize: 13,
		marginLeft: 16,
		marginTop: 1,
	},
});
