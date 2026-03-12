import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatExercisePhase, ExercisePhase } from '../lib/formatExercisePhase';
import { Exercise } from '../types/workout';

interface ExerciseItemProps {
	exercise: Exercise;
	phases: ExercisePhase[];
	onEdit: () => void;
}

export function ExerciseItem({ exercise, phases, onEdit }: ExerciseItemProps) {
	return (
		<View style={styles.exerciseItem}>
			<View style={styles.exerciseHeader}>
				<View style={styles.exerciseNameContainer}>
					<Text style={styles.exerciseName}>{exercise.name}</Text>
				</View>
				<View style={styles.exerciseButtons}>
					<Pressable onPress={onEdit} style={styles.editButton}>
						<Ionicons name="pencil-outline" size={22} color="#fff" />
					</Pressable>
				</View>
			</View>
			{phases.length > 0 && (
				<View style={styles.phasesContainer}>
					{phases.map((phase) => (
						<View key={phase.id}>
							<Text style={styles.phaseText}>
								{formatExercisePhase(phase)}
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
});
