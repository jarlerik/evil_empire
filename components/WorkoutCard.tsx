import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Exercise {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

interface Workout {
	id: string;
	name: string;
	user_id: string;
	created_at?: string;
	workout_date?: string;
}

interface WorkoutCardProps {
	workout: Workout;
	exercises: Exercise[];
	onEdit: () => void;
	onStart: () => void;
}

export function WorkoutCard({ workout, exercises, onEdit, onStart }: WorkoutCardProps) {
	return (
		<View style={styles.workoutCard}>
			<View style={[
				styles.workoutCardHeader,
				exercises.length > 0 && styles.workoutCardHeaderWithExercises
			]}>
				<View style={styles.workoutNameContainer}>
					<Text style={styles.workoutName}>{workout.name}</Text>
				</View>
				<View style={styles.workoutActions}>
					<Pressable onPress={onEdit} style={styles.actionButton}>
						<Ionicons name="pencil" size={22} color="#fff" />
					</Pressable>
					<Pressable onPress={onStart} style={styles.actionButton}>
						<Ionicons name="play" size={22} color="#fff" />
					</Pressable>
				</View>
			</View>
			{exercises.length > 0 && (
				<View style={styles.exercisesList}>
					{exercises.map((exercise, index) => (
						<Text key={exercise.id} style={styles.exerciseText}>
							{index + 1}. {exercise.name}
						</Text>
					))}
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
});
