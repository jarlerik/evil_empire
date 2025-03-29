import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

export default function CreateWorkout() {
	const [workoutName, setWorkoutName] = useState('');

	const handleCreateWorkout = () => {
		if (workoutName.trim()) {
			// Navigate to add exercises screen with the workout name
			router.push({
				pathname: 'add-exercises',
				params: { workoutName },
			});
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Create{'\n'}a workout</Text>
			<Text style={styles.subtitle}>for today</Text>

			<TextInput
				style={styles.input}
				value={workoutName}
				onChangeText={setWorkoutName}
				placeholder="Workout name"
				placeholderTextColor="#666"
			/>

			<Pressable style={styles.button} onPress={handleCreateWorkout}>
				<Text style={styles.buttonText}>Create</Text>
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
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#fff',
		marginTop: 40,
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
});
