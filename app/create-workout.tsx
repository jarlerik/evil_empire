import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface Workout {
	id: string;
	name: string;
	user_id: string;
	created_at?: string;
}

export default function CreateWorkout() {
	const [workoutName, setWorkoutName] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { user } = useAuth();
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useEffect(() => {
		if (!user || !supabase) return;
		const fetchWorkouts = async () => {
			if (!supabase) return;
			const { data, error } = await supabase
				.from('workouts')
				.select('*')
				.eq('user_id', user.id)
				.order('created_at', { ascending: false });
			if (!error && data) setWorkouts(data);
		};
		fetchWorkouts();
	}, [supabase, user]);

	const handleCreateWorkout = async () => {
		if (!workoutName.trim()) return;
		if (!supabase) {
			setError('Database not available.');
			return;
		}
		if (!user) {
			setError('You must be signed in to create a workout.');
			return;
		}
		setIsLoading(true);
		setError(null);
		const { error: insertError } = await supabase
			.from('workouts')
			.insert([{ name: workoutName.trim(), user_id: user.id }]);
		setIsLoading(false);
		if (insertError) {
			setError('Failed to create workout. Please try again.');
			return;
		}
		setWorkoutName('');
		// Refetch workouts after creation
		const { data, error } = await supabase
			.from('workouts')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });
		if (!error && data) setWorkouts(data);
	};

	const handleDeleteWorkout = async (id: string) => {
		if (!supabase) return;
		setDeletingId(id);
		await supabase.from('workouts').delete().eq('id', id);
		setDeletingId(null);
		// Refetch workouts after deletion
		if (!user) return;
		const { data, error } = await supabase
			.from('workouts')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });
		if (!error && data) setWorkouts(data);
	};

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={{ flex: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<Text style={styles.title}>{'Create\na workout'}</Text>
					<Text style={styles.subtitle}>for today</Text>

					<TextInput
						style={styles.input}
						value={workoutName}
						onChangeText={setWorkoutName}
						placeholder="Workout name"
						placeholderTextColor="#666"
						returnKeyType="done"
						onSubmitEditing={handleCreateWorkout}
						editable={!isLoading}
					/>

					{error && <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>}

					<Pressable style={styles.button} onPress={handleCreateWorkout} disabled={isLoading}>
						<Text style={styles.buttonText}>{isLoading ? 'Creating...' : 'Create'}</Text>
					</Pressable>

					{/* List of created workouts */}
					<View style={{ marginTop: 32 }}>
						<Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Your Workouts</Text>
						{workouts.length === 0 ? (
							<Text style={{ color: '#666' }}>No workouts yet.</Text>
						) : (
							workouts.map((w) => (
								<View key={w.id} style={{ backgroundColor: '#111', padding: 16, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
									<View style={{ flex: 1 }}>
										<Text style={{ color: '#fff', fontSize: 16 }}>{w.name}</Text>
										<Text style={{ color: '#666', fontSize: 12 }}>{w.created_at ? new Date(w.created_at).toLocaleString() : ''}</Text>
									</View>
									<View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
										<Pressable onPress={() => router.push({ pathname: '/add-exercises', params: { workoutName: w.name, workoutId: w.id } })} style={{ padding: 8, marginRight: 8 }}>
											<Ionicons name="pencil" size={22} color="#fff" />
										</Pressable>
										<Pressable onPress={() => handleDeleteWorkout(w.id)} disabled={deletingId === w.id} style={{ padding: 8 }}>
											<Ionicons name="trash-outline" size={22} color={deletingId === w.id ? '#666' : '#fff'} />
										</Pressable>
									</View>
								</View>
							))
						)}
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
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
