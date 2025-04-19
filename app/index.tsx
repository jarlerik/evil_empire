import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
	const { user, loading } = useAuth();
	const router = useRouter();
	const [isEditingWeight, setIsEditingWeight] = useState(false);
	const [weight, setWeight] = useState('85');
	const [tempWeight, setTempWeight] = useState(weight);

	useEffect(() => {
		if (!loading && !user) {
			// Redirect to sign in if user is not authenticated
			router.replace('/(auth)/sign-in');
		}
	}, [user, loading]);

	const handleCreateWorkout = () => {
		router.push('/create-workout');
	};

	const handleWeightEdit = () => {
		setIsEditingWeight(true);
		setTempWeight(weight);
	};

	const handleWeightSave = () => {
		setWeight(tempWeight);
		setIsEditingWeight(false);
	};

	if (loading) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>Loading...</Text>
			</View>
		);
	}

	// Your authenticated app content here
	return (
		<View style={styles.container}>
			<View style={styles.email}>
				<Text style={styles.title}>Email</Text>
				<Text style={styles.subtitle}>{user?.email}</Text>
			</View>
			<View style={styles.weight}>
				<Pressable onPress={handleWeightEdit}>
					<Text style={styles.editWeightButton}>Edit</Text>
				</Pressable>
				<Text style={styles.weightTitle}>Weight</Text>
				{isEditingWeight ? (
					<View style={styles.weightEditContainer}>
						<TextInput
							style={styles.weightInput}
							value={tempWeight}
							onChangeText={setTempWeight}
							keyboardType="numeric"
							maxLength={5}
						/>
						<Text style={styles.weightUnit}>kg</Text>
						<Pressable style={styles.saveButton} onPress={handleWeightSave}>
							<Text style={styles.saveButtonText}>Save</Text>
						</Pressable>
					</View>
				) : (
					<Text style={styles.weightValue}>{weight} kg</Text>
				)}
			</View>

			<View style={styles.footer}>
				<Pressable style={styles.button} onPress={handleCreateWorkout}>
					<Text style={styles.buttonText}>Start workout</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
		padding: 20,
	},
	email: {
		flex: 1,
	},
	weight: {
		flex: 2,
	},
	editWeightButton: {
		fontSize: 12,
		color: '#fff',
		textAlign: 'center',
		marginBottom: 10,
		textDecorationLine: 'underline',

	},

	weightTitle: {
		fontSize: 48,
		fontWeight: 'bold',
		color: '#fff',
		marginTop: 5,
		textAlign: 'center',
	},
	weightValue: {
		fontSize: 48,
		fontWeight: 'bold',
		color: '#666666',
		marginTop: 5,
		textAlign: 'center',
	},
	
	footer: {
		marginTop: 'auto',
	},
	title: {
		fontSize: 24,
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
	weightEditContainer: {
		alignItems: 'center',
		marginTop: 10,
	},
	weightInput: {
		fontSize: 48,
		fontWeight: 'bold',
		color: '#fff',
		textAlign: 'center',
		borderBottomWidth: 2,
		borderBottomColor: '#666',
		paddingBottom: 5,
		minWidth: 120,
	},
	weightUnit: {
		fontSize: 24,
		color: '#666666',
		marginTop: 5,
	},
	saveButton: {
		backgroundColor: '#333',
		paddingVertical: 10,
		paddingHorizontal: 30,
		borderRadius: 8,
		marginTop: 20,
	},
	saveButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
});
