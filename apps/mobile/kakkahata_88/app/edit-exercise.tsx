import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

interface ExerciseSet {
	sets: string;
	reps: string;
	weight: string;
}

export default function EditExercise() {
	const { exercise, index, existingSets } = useLocalSearchParams();
	const [exerciseName, setExerciseName] = useState(exercise as string);
	const [sets, setSets] = useState('');
	const [reps, setReps] = useState('');
	const [weight, setWeight] = useState('');
	const [exerciseSets, setExerciseSets] = useState<ExerciseSet[]>(
		existingSets ? JSON.parse(existingSets as string) : []
	);

	const handleAddSet = () => {
		if (sets && reps && weight) {
			setExerciseSets([...exerciseSets, { sets, reps, weight }]);
			setSets('');
			setReps('');
			setWeight('');
		}
	};

	const handleSave = () => {
		if (exerciseName.trim()) {
			router.setParams({
				editedExercise: exerciseName.trim(),
				editedIndex: index,
				editedSets: JSON.stringify(exerciseSets)
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

			<Text style={styles.subtitle}>Add sets & reps</Text>

			<View style={styles.setInputContainer}>
				<View style={styles.inputRow}>
					<View style={styles.inputWrapper}>
						<Text style={styles.label}>Sets</Text>
						<TextInput
							style={styles.numberInput}
							value={sets}
							onChangeText={setSets}
							placeholder="3"
							placeholderTextColor="#666"
							keyboardType="numeric"
						/>
					</View>
					<Text style={styles.separator}>x</Text>
					<View style={styles.inputWrapper}>
						<Text style={styles.label}>Reps</Text>
						<TextInput
							style={styles.numberInput}
							value={reps}
							onChangeText={setReps}
							placeholder="5"
							placeholderTextColor="#666"
							keyboardType="numeric"
						/>
					</View>
					<Text style={styles.separator}>@</Text>
					<View style={styles.inputWrapper}>
						<Text style={styles.label}>Weight</Text>
						<TextInput
							style={styles.numberInput}
							value={weight}
							onChangeText={setWeight}
							placeholder="75"
							placeholderTextColor="#666"
							keyboardType="numeric"
						/>
					</View>
					<Text style={styles.unit}>KG</Text>
					<Pressable style={styles.addButton} onPress={handleAddSet}>
						<Text style={styles.addButtonText}>+</Text>
					</Pressable>
				</View>
			</View>

			{exerciseSets.map((set, idx) => (
				<Text key={idx} style={styles.setDisplay}>
					{set.sets} x {set.reps} @{set.weight}kg
				</Text>
			))}

			<View style={styles.footer}>
				<Pressable style={styles.button} onPress={handleSave}>
					<Text style={styles.buttonText}>Save</Text>
				</Pressable>
			</View>
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
		fontSize: 18,
		color: '#fff',
		marginTop: 20,
		marginBottom: 10
	},
	input: {
		backgroundColor: '#111',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20
	},
	setInputContainer: {
		backgroundColor: '#111',
		borderRadius: 8,
		padding: 15,
		marginBottom: 20
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	inputWrapper: {
		alignItems: 'center'
	},
	label: {
		color: '#666',
		fontSize: 12,
		marginBottom: 4
	},
	numberInput: {
		backgroundColor: '#222',
		color: '#fff',
		borderRadius: 4,
		padding: 8,
		width: 50,
		textAlign: 'center',
		fontSize: 16
	},
	separator: {
		color: '#666',
		fontSize: 16,
		marginHorizontal: 8
	},
	unit: {
		color: '#666',
		fontSize: 16,
		marginLeft: 8
	},
	addButton: {
		borderWidth: 3,
		borderColor: '#fff',
		borderRadius: 20,
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		alignSelf: 'center',
		marginTop: 15
	},
	addButtonText: {
		color: '#fff',
		fontSize: 24
	},
	setDisplay: {
		color: '#fff',
		fontSize: 16,
		backgroundColor: '#222',
		padding: 10,
		borderRadius: 8,
		marginBottom: 10
	},
	footer: {
		marginTop: 'auto'
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
