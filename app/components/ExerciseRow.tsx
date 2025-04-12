import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExerciseSet {
	sets: string;
	reps: string;
	weight: string;
}

interface ExerciseRowProps {
	exercise: string;
	sets: ExerciseSet[];
	onEdit: () => void;
	onDelete: () => void;
}

export default function ExerciseRow({ exercise, sets, onEdit, onDelete }: ExerciseRowProps) {
	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.exerciseName}>{exercise}</Text>
				{sets.length > 0 && (
					<Text style={styles.setsText}>
						{sets[0].sets} x {sets[0].reps} @{sets[0].weight}kg
						{sets.length > 1 && ` +${sets.length - 1}`}
					</Text>
				)}
			</View>
			<View style={styles.actions}>
				<Pressable onPress={onEdit} style={styles.actionButton}>
					<Ionicons name="pencil" size={20} color="#fff" />
				</Pressable>
				<Pressable onPress={onDelete} style={styles.actionButton}>
					<Ionicons name="trash-outline" size={20} color="#ff4444" />
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#111',
		padding: 15,
		borderRadius: 8,
		marginBottom: 10,
	},
	content: {
		flex: 1,
	},
	exerciseName: {
		color: '#fff',
		fontSize: 16,
	},
	setsText: {
		color: '#666',
		fontSize: 14,
		marginTop: 4,
	},
	actions: {
		flexDirection: 'row',
		gap: 15,
	},
	actionButton: {
		padding: 5,
	},
});
