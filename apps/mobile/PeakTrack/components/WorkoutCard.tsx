import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
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
	isMissed?: boolean;
	onMoveToToday?: () => void;
	onCopy?: () => void;
	isCopying?: boolean;
	exercisePhases?: Map<string, ExercisePhase[]>;
	rating?: number | null;
}

export function WorkoutCard({ workout, exercises, onEdit, onStart, isReadOnly = false, isCompleted = false, isMissed = false, onMoveToToday, onCopy, isCopying = false, exercisePhases, rating }: WorkoutCardProps) {
	return (
		<View style={styles.workoutCard}>
			{isMissed && (
				<View style={styles.missedBadge}>
					<Text style={styles.missedBadgeText}>Missed workout</Text>
				</View>
			)}
			<View style={[
				styles.workoutCardHeader,
				exercises.length > 0 && styles.workoutCardHeaderWithExercises,
			]}>
				<View style={styles.workoutNameContainer}>
					<Text style={styles.workoutName}>{workout.name}</Text>
					{rating != null && (
						<Text style={styles.ratingBadge}>{rating}/5</Text>
					)}
				</View>
				{!isReadOnly && !isCompleted && (
					<View style={styles.workoutActions}>
						<Pressable onPress={onEdit} style={styles.actionButton}>
							<Ionicons name="pencil" size={22} color="#fff" />
						</Pressable>
						<Pressable onPress={onStart} style={styles.actionButton}>
							<Ionicons name="stopwatch" size={22} color="#fff" />
						</Pressable>
					</View>
				)}
				{isCompleted && !isReadOnly && (
					<View style={styles.workoutActions}>
						<Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
					</View>
				)}
				{isReadOnly && onCopy && (
					<View style={styles.workoutActions}>
						<Pressable onPress={onCopy} disabled={isCopying} style={styles.actionButton}>
							{isCopying ? (
								<ActivityIndicator size="small" color="#fff" />
							) : (
								<Ionicons name="copy-outline" size={22} color="#fff" />
							)}
						</Pressable>
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
			{isMissed && onMoveToToday && (
				<Pressable onPress={onMoveToToday} style={styles.moveToTodayButton}>
					<Text style={styles.moveToTodayText}>Move to today</Text>
				</Pressable>
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
	missedBadge: {
		alignSelf: 'flex-start',
		borderWidth: 1,
		borderColor: '#D32F2F',
		borderRadius: 4,
		paddingHorizontal: 8,
		paddingVertical: 2,
		marginBottom: 8,
	},
	missedBadgeText: {
		color: '#D32F2F',
		fontSize: 12,
		fontWeight: '600',
	},
	moveToTodayButton: {
		marginTop: 12,
	},
	moveToTodayText: {
		color: '#D32F2F',
		fontSize: 14,
		fontWeight: '600',
	},
	ratingBadge: {
		color: '#C65D24',
		fontSize: 12,
		fontWeight: '600',
		marginTop: 2,
	},
});
