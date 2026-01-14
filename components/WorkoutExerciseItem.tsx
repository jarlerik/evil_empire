import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
}

export function WorkoutExerciseItem({
	exercise,
	phases,
	isActive,
	onLayout,
}: WorkoutExerciseItemProps) {
	return (
		<View
			style={[
				styles.exerciseItem,
				isActive && styles.exerciseItemActive
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
			</View>
			{phases.length > 0 && (
				<View style={styles.phasesContainer}>
					{phases.map((phase) => (
						<Text key={phase.id} style={styles.phaseText}>
							{formatExercisePhase(phase)}
						</Text>
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
});
