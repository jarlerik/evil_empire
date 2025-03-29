import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExerciseRowProps {
	exercise: string;
	onEdit: () => void;
	onDelete: () => void;
}

export function ExerciseRow({ exercise, onEdit, onDelete }: ExerciseRowProps) {
	return (
		<View style={styles.container}>
			<Text style={styles.exerciseName}>{exercise}</Text>
			<View style={styles.actions}>
				<Pressable onPress={onEdit} style={styles.actionButton}>
					<Ionicons name="pencil" size={20} color="#fff" />
				</Pressable>
				<Pressable onPress={onDelete} style={styles.actionButton}>
					<Ionicons name="trash-outline" size={20} color="#fff" />
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
	exerciseName: {
		color: '#fff',
		fontSize: 16,
		flex: 1,
	},
	actions: {
		flexDirection: 'row',
		gap: 15,
	},
	actionButton: {
		padding: 5,
	},
});
