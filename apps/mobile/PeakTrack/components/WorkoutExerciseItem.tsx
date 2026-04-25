import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { formatExercisePhase, ExercisePhase } from '../lib/formatExercisePhase';

interface ExerciseDB {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

interface WorkoutExerciseItemProps {
	exercise: ExerciseDB;
	phases: ExercisePhase[];
	isActive: boolean;
	onLayout?: (y: number) => void;
	unit?: 'kg' | 'lbs';
	onRemove?: () => void;
}

export function WorkoutExerciseItem({
	exercise,
	phases,
	isActive,
	onLayout,
	unit = 'kg',
	onRemove,
}: WorkoutExerciseItemProps) {
	const showRemove = !!onRemove && !isActive;
	return (
		<View
			style={[
				styles.exerciseItem,
				isActive && styles.exerciseItemActive,
			]}
			onLayout={(event) => {
				if (onLayout) {
					onLayout(event.nativeEvent.layout.y);
				}
			}}
		>
			<View style={styles.exerciseHeader}>
				<View style={styles.exerciseNameContainer}>
					<Text style={styles.exerciseName}>{exercise.name}</Text>
				</View>
				{showRemove && (
					<Pressable
						onPress={onRemove}
						style={styles.removeButton}
						hitSlop={8}
						accessibilityLabel={`Remove ${exercise.name}`}
						accessibilityRole="button"
					>
						<Text style={styles.removeButtonText}>×</Text>
					</Pressable>
				)}
			</View>
			{phases.length > 0 && (
				<View style={styles.phasesContainer}>
					{phases.map((phase) => (
						<View key={phase.id}>
							<Text style={styles.phaseText}>
								{formatExercisePhase(phase, unit)}
							</Text>
							{phase.notes && (
								<Text style={styles.phaseNotes}>{phase.notes}</Text>
							)}
						</View>
					))}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
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
	phasesContainer: {
		marginTop: 12,
	},
	phaseText: {
		color: '#C65D24',
		fontSize: 14,
		marginTop: 4,
	},
	phaseNotes: {
		color: '#fff',
		fontSize: 12,
		marginTop: 2,
	},
	removeButton: {
		paddingHorizontal: 8,
		paddingVertical: 0,
		marginLeft: 8,
	},
	removeButtonText: {
		color: '#fff',
		fontSize: 24,
		lineHeight: 24,
		fontWeight: 'bold',
	},
});
