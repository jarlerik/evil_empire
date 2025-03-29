import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ExerciseRow } from './components/ExerciseRow';

export default function AddExercises() {
	const params = useLocalSearchParams();
	const { workoutName, editedExercise, editedIndex } = params;
	const [exerciseName, setExerciseName] = useState('');
	const [exercises, setExercises] = useState<string[]>([]);

	// Handle edited exercise when returning from edit screen
	useEffect(() => {
		if (editedExercise && editedIndex) {
			const newExercises = [...exercises];
			newExercises[Number(editedIndex)] = editedExercise;
			setExercises(newExercises);
		}
	}, [editedExercise, editedIndex, exercises]);

	const handleAddExercise = () => {
		if (exerciseName.trim()) {
			setExercises([...exercises, exerciseName.trim()]);
			setExerciseName('');
		}
	};

	const handleEditExercise = (index: number) => {
		router.push({
			pathname: '/edit-exercise',
			params: {
				exercise: exercises[index],
				index: index.toString(),
			},
		});
	};

	const handleDeleteExercise = (index: number) => {
		const updatedExercises = exercises.filter((_, i) => i !== index);
		setExercises(updatedExercises);
	};

	return (
		<View style={styles.container}>
			<Pressable onPress={() => router.back()} style={styles.backButton}>
				<Text style={styles.backButtonText}>←</Text>
			</Pressable>

			<Text style={styles.title}>{workoutName}</Text>
			<Text style={styles.subtitle}>add exercises</Text>

			{exercises.map((exercise, index) => (
				<ExerciseRow
					key={index}
					exercise={exercise}
					onEdit={() => handleEditExercise(index)}
					onDelete={() => handleDeleteExercise(index)}
				/>
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
		padding: 20,
	},
	backButton: {
		marginTop: 20,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 24,
	},
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#fff',
		marginTop: 20,
		marginBottom: 40,
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 8,
		marginBottom: 40,
	},
	input: {
		backgroundColor: '#111',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
	},
	button: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	exerciseList: {
		marginTop: 20,
	},
});
