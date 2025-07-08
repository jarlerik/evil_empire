import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

interface ExerciseDB {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

export default function AddExercises() {
	const params = useLocalSearchParams();
	const { workoutName, workoutId } = params;
	const [exerciseName, setExerciseName] = useState('');
	const [exercises, setExercises] = useState<ExerciseDB[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const fetchExercises = async () => {
		if (!workoutId || !supabase) return;
		const { data, error } = await supabase
			.from('exercises')
			.select('*')
			.eq('workout_id', workoutId)
			.order('created_at', { ascending: false });
		if (!error && data) setExercises(data);
	};

	useFocusEffect(
		useCallback(() => {
			fetchExercises();
		}, [workoutId])
	);

	const handleAddExercise = async () => {
		if (!exerciseName.trim() || !workoutId || !supabase) return;
		setIsLoading(true);
		await supabase.from('exercises').insert([{ name: exerciseName.trim(), workout_id: workoutId }]);
		setExerciseName('');
		setIsLoading(false);
		// Refetch exercises
		const { data, error } = await supabase
			.from('exercises')
			.select('*')
			.eq('workout_id', workoutId)
			.order('created_at', { ascending: false });
		if (!error && data) setExercises(data);
	};

	const handleDeleteExercise = async (id: string) => {
		if (!supabase) return;
		setDeletingId(id);
		await supabase.from('exercises').delete().eq('id', id);
		setDeletingId(null);
		// Refetch exercises
		if (!workoutId) return;
		const { data, error } = await supabase
			.from('exercises')
			.select('*')
			.eq('workout_id', workoutId)
			.order('created_at', { ascending: false });
		if (!error && data) setExercises(data);
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
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backButtonText}>←</Text>
					</Pressable>

					<Text style={styles.title}>{workoutName}</Text>

					{[...exercises]
						.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
						.map((exercise) => (
							<View key={exercise.id} style={{ backgroundColor: '#111', padding: 16, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
								<View style={{ flex: 1 }}>
									<Text style={{ color: '#fff', fontSize: 16 }}>{exercise.name}</Text>
								</View>
								<Pressable onPress={() => router.push({ pathname: '/edit-exercise', params: { exerciseId: exercise.id, exerciseName: exercise.name } })} style={{ padding: 8, marginRight: 8 }}>
									<Ionicons name="pencil-outline" size={22} color="#fff" />
								</Pressable>
								<Pressable onPress={() => handleDeleteExercise(exercise.id)} disabled={deletingId === exercise.id} style={{ padding: 8 }}>
									<Ionicons name="trash-outline" size={22} color={deletingId === exercise.id ? '#666' : '#fff'} />
								</Pressable>
							</View>
						))}

					<View style={{ marginTop: 'auto' }}>
						<TextInput
							style={styles.input}
							value={exerciseName}
							onChangeText={setExerciseName}
							placeholder="Exercise name"
							placeholderTextColor="#666"
							returnKeyType="done"
							onSubmitEditing={handleAddExercise}
							editable={!isLoading}
						/>
						<Pressable style={styles.button} onPress={handleAddExercise} disabled={isLoading}>
							<Text style={styles.buttonText}>{isLoading ? 'Adding...' : 'Add exercise'}</Text>
						</Pressable>
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
