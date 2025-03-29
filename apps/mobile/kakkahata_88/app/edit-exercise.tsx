import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

export default function EditExercise() {
	const { exercise, index } = useLocalSearchParams();
	const [exerciseName, setExerciseName] = useState(exercise as string);

	const handleSave = () => {
		if (exerciseName.trim()) {
			router.setParams({
				editedExercise: exerciseName.trim(),
				editedIndex: index,
			});
		}
	};

	return (
		<View style={styles.container}>
			<Pressable onPress={() => router.back()} style={styles.backButton}>
				<Text style={styles.backButtonText}>←</Text>
			</Pressable>

			<Text style={styles.title}>Edit exercise</Text>

			<TextInput
				style={styles.input}
				value={exerciseName}
				onChangeText={setExerciseName}
				placeholder="Exercise name"
				placeholderTextColor="#666"
				autoFocus
			/>

			<Pressable style={styles.button} onPress={handleSave}>
				<Text style={styles.buttonText}>Save</Text>
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
});
