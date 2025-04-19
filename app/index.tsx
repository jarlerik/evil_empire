import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !user) {
			// Redirect to sign in if user is not authenticated
			router.replace('/(auth)/sign-in');
		}
	}, [user, loading]);

	const handleCreateWorkout = () => {
		router.push('/create-workout');
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
			<View style={styles.content}>
				<Text style={styles.title}>Email</Text>
				<Text style={styles.subtitle}>{user?.email}</Text>
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
	content: {
		flex: 1,
	},
	footer: {
		marginTop: 'auto',
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
