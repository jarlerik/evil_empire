import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

export default function AddExercises() {
	const { workoutName } = useLocalSearchParams();
	const [exerciseName, setExerciseName] = useState('');
	const [exercises, setExercises] = useState<string[]>([]);

	const handleAddExercise = () => {
		if (exerciseName.trim()) {
			setExercises([...exercises, exerciseName.trim()]);
			setExerciseName('');
		}
	};

	return (
		<View style={styles.container}>
			<Pressable onPress={() => router.back()} style={styles.backButton}>
				<Text style={styles.backButtonText}>←</Text>
			</Pressable>

			<Text style={styles.title}>{workoutName}</Text>
			<Text style={styles.subtitle}>add exercises</Text>

			{exercises.map((exercise, index) => (
				<View key={index} style={styles.exerciseItem}>
					<Text style={styles.exerciseText}>{exercise}</Text>
				</View>
			))}

			<TextInput
				style={styles.input}
				value={exerciseName}
				onChangeText={setExerciseName}
				placeholder="Exercise name"
				placeholderTextColor="#666"
			/>

			<Pressable style={styles.button} onPress={handleAddExercise}>
				<Text style={styles.buttonText}>Add exercise</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
		padding: 20
	},
	backButton: {
		marginTop: 20
	},
	backButtonText: {
		color: '#fff',
		fontSize: 24
	},
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#fff',
		marginTop: 20
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 8,
		marginBottom: 40
	},
	exerciseItem: {
		backgroundColor: '#111',
		padding: 15,
		borderRadius: 8,
		marginBottom: 10
	},
	exerciseText: {
		color: '#fff',
		fontSize: 16
	},
	input: {
		backgroundColor: '#111',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20
	},
	button: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center'
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600'
	}
});
