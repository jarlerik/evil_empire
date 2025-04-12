import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ExerciseRow } from './components/ExerciseRow';

interface ExerciseSet {
	sets: string;
	reps: string;
	weight: string;
}

interface Exercise {
	name: string;
	sets: ExerciseSet[];
}

export default function AddExercises() {
	const params = useLocalSearchParams();
	const { workoutName, editedExercise, editedIndex, editedSets } = params;
	const [exerciseName, setExerciseName] = useState('');
	const [exercises, setExercises] = useState<Exercise[]>([]);

	// Handle edited exercise when returning from edit screen
	useEffect(() => {
		if (editedExercise && editedIndex) {
			const newExercises = [...exercises];
			const parsedSets = editedSets ? JSON.parse(editedSets as string) : [];
			newExercises[Number(editedIndex)] = {
				name: editedExercise as string,
				sets: parsedSets
			};
			setExercises(newExercises);
		}
	}, [editedExercise, editedIndex, editedSets, exercises]);

	const handleAddExercise = () => {
		if (exerciseName.trim()) {
			setExercises([...exercises, { name: exerciseName.trim(), sets: [] }]);
			setExerciseName('');
		}
	};

	const handleEditExercise = (index: number) => {
		router.push({
			pathname: '/edit-exercise',
			params: {
				exercise: exercises[index].name,
				index: index.toString(),
				existingSets: JSON.stringify(exercises[index].sets)
			}
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
					exercise={exercise.name}
					sets={exercise.sets}
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
		marginTop: 20,
		marginBottom: 40
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 8,
		marginBottom: 40
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
	},
	exerciseList: {
		marginTop: 20
	}
});
