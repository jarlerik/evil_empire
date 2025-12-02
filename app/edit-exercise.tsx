import { View, Text, TextInput, Pressable, StyleSheet, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { parseSetInput, reverseParsePhase } from '../lib/parseSetInput';
import { Ionicons } from '@expo/vector-icons';

interface ExercisePhase {
	id: string;
	exercise_id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
	created_at: string;
}

export default function EditExercise() {
	const params = useLocalSearchParams();
	const { exerciseId, exerciseName: initialExerciseName } = params;
	const [exerciseName] = useState(initialExerciseName as string);
	const [setInput, setSetInput] = useState('');
	const [exercisePhases, setExercisePhases] = useState<ExercisePhase[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);

	useEffect(() => {
		if (!exerciseId || !supabase) return;
		fetchExercisePhases();
	}, [exerciseId]);

	const fetchExercisePhases = async () => {
		if (!supabase || !exerciseId) return;
		const { data, error } = await supabase
			.from('exercise_phases')
			.select('*')
			.eq('exercise_id', exerciseId)
			.order('created_at', { ascending: true });
		
		if (!error && data) {
			setExercisePhases(data);
		}
	};

	const handleEditPhase = (phase: ExercisePhase) => {
		setEditingPhaseId(phase.id);
		setSetInput(reverseParsePhase(phase));
	};

	const handleCancelEdit = () => {
		setEditingPhaseId(null);
		setSetInput('');
	};

	const handleAddSet = async () => {
		const parsedData = parseSetInput(setInput);
		if (!parsedData.isValid) {
			// Show error message to user
			alert(parsedData.errorMessage || 'Invalid input format');
			return;
		}
		if (!exerciseId || !supabase) return;
		
		setIsLoading(true);

		// If we're editing an existing phase, update it instead of creating a new one
		if (editingPhaseId) {
			const updateData: any = {
				sets: parsedData.sets,
				repetitions: parsedData.reps,
				weight: parsedData.weight
			};

			// Add compound_reps if it's a compound exercise
			if (parsedData.compoundReps) {
				updateData.compound_reps = parsedData.compoundReps;
			} else {
				updateData.compound_reps = null; // Clear compound_reps if not present
			}

			// Add weights array if multiple weights are specified
			if (parsedData.weights) {
				updateData.weights = parsedData.weights;
			} else {
				updateData.weights = null; // Clear weights if not present
			}

			const { error } = await supabase
				.from('exercise_phases')
				.update(updateData)
				.eq('id', editingPhaseId);

			if (!error) {
				setSetInput('');
				setEditingPhaseId(null);
				fetchExercisePhases();
			} else {
				alert('Error updating phase');
			}
			setIsLoading(false);
			return;
		}

		const insertData: any = {
			exercise_id: exerciseId,
			sets: parsedData.sets,
			repetitions: parsedData.reps,
			weight: parsedData.weight
		};

		// Add compound_reps if it's a compound exercise
		if (parsedData.compoundReps) {
			insertData.compound_reps = parsedData.compoundReps;
		}

		// Add weights array if multiple weights are specified
		if (parsedData.weights) {
			insertData.weights = parsedData.weights;
		}

		// Add wave phases if it's a wave exercise
		if (parsedData.wavePhases) {
			// Create multiple phases for wave exercise
			for (const phase of parsedData.wavePhases) {
				const phaseData = {
					exercise_id: exerciseId,
					sets: phase.sets,
					repetitions: phase.reps,
					weight: phase.weight
				};
				
				const { error: phaseError } = await supabase
					.from('exercise_phases')
					.insert(phaseData);
				
				if (phaseError) {
					console.error('Error adding wave phase:', phaseError);
					alert('Error adding wave phase');
					return;
				}
			}
			
			// Clear input and refresh phases
			setSetInput('');
			fetchExercisePhases();
			return;
		}

		const { error } = await supabase
			.from('exercise_phases')
			.insert([insertData]);

		if (!error) {
			setSetInput('');
			fetchExercisePhases();
		}
		setIsLoading(false);
	};

	const handleDeletePhase = async (phaseId: string) => {
		if (!supabase) return;
		const { error } = await supabase
			.from('exercise_phases')
			.delete()
			.eq('id', phaseId);

		if (!error) {
			fetchExercisePhases();
		}
	};

	const handleDeleteExercise = async () => {
		if (!exerciseId || !supabase) return;
		const { error } = await supabase
			.from('exercises')
			.delete()
			.eq('id', exerciseId);

		if (!error) {
			router.back();
		}
	};

	const handleSave = async () => {
		if (!exerciseName.trim() || !exerciseId || !supabase) return;
		// Update the exercise name in the database
		const { error } = await supabase
			.from('exercises')
			.update({ name: exerciseName.trim() })
			.eq('id', exerciseId);

		if (!error) {
			router.setParams({
				editedExercise: exerciseName.trim(),
				editedIndex: params.index,
			});
			// Optionally, show a success message or navigate back
		} else {
			// Optionally, handle error (e.g., show a message)
		}
	};

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={{ flexGrow: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backButtonText}>←</Text>
					</Pressable>

					<Text style={styles.title}>Exercise</Text>

					<View style={styles.exerciseNameContainer}>
						<Text style={styles.exerciseName}>{exerciseName}</Text>
						<Pressable 
							onPress={() => handleDeleteExercise()}
							style={styles.deleteExerciseButton}
						>
							<Text style={styles.deleteExerciseButtonText}>×</Text>
						</Pressable>
					</View>

					<View style={styles.setsSection}>
						<View style={styles.setsHeader}>
							<Text style={styles.subtitle}>Sets and repetitions</Text>
							<View style={styles.headerButtons}>
								{editingPhaseId && (
									<Pressable 
										style={styles.cancelButton} 
										onPress={handleCancelEdit}
									>
										<Text style={styles.cancelButtonText}>Cancel</Text>
									</Pressable>
								)}
							</View>
						</View>
						
						<TextInput
							style={styles.setInput}
							value={setInput}
							onChangeText={setSetInput}
							placeholder="4 x 3 @50kg, 3 x 1 @50 60 70, or 3-2-1-1-1 65"
							placeholderTextColor="#666"
							returnKeyType="done"
							onSubmitEditing={handleAddSet}
						/>
					</View>

					{exercisePhases.map((phase) => (
						<View 
							key={phase.id} 
							style={[
								styles.phaseContainer,
								editingPhaseId === phase.id && styles.phaseContainerEditing
							]}
						>
							<Text style={styles.phaseText}>
								{phase.compound_reps ? 
									`${phase.sets} x ${phase.compound_reps[0]} + ${phase.compound_reps[1]} @${phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`}` :
									`${phase.sets} x ${phase.repetitions} @${phase.weights ? phase.weights.map(w => `${w}kg`).join(' ') : `${phase.weight}kg`}`
								}
							</Text>
							<View style={styles.phaseButtons}>
								<Pressable 
									onPress={() => handleEditPhase(phase)}
									style={styles.editButton}
								>
									<Ionicons name="pencil-outline" size={22} color="#fff" />
								</Pressable>
								<Pressable 
									onPress={() => handleDeletePhase(phase.id)}
									style={styles.deleteButton}
								>
									<Text style={styles.deleteButtonText}>×</Text>
								</Pressable>
							</View>
						</View>
					))}

					<View style={styles.footer}>
						<Pressable style={styles.button} onPress={handleSave}>
							<Text style={styles.buttonText}>Save</Text>
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
		fontSize: 18,
		color: '#fff',
		marginTop: 20,
		marginBottom: 10,
	},
	input: {
		backgroundColor: '#111',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
	},
	setInputContainer: {
		backgroundColor: '#111',
		borderRadius: 8,
		padding: 15,
		marginBottom: 20,
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	inputWrapper: {
		alignItems: 'center',
	},
	label: {
		color: '#666',
		fontSize: 12,
		marginBottom: 4,
	},
	numberInput: {
		backgroundColor: '#222',
		color: '#fff',
		borderRadius: 4,
		padding: 8,
		width: 50,
		textAlign: 'center',
		fontSize: 16,
	},
	setInput: {
		backgroundColor: '#222',
		color: '#fff',
		borderRadius: 8,
		padding: 15,
		fontSize: 16,
		width: '100%',
	},
	separator: {
		color: '#666',
		fontSize: 16,
		marginHorizontal: 8,
	},
	unit: {
		color: '#666',
		fontSize: 16,
		marginLeft: 8,
	},
	headerButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	addButton: {
		backgroundColor: '#333',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addButtonDisabled: {
		borderColor: '#666',
	},
	addButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
	addButtonTextDisabled: {
		color: '#666',
	},
	cancelButton: {
		backgroundColor: '#444',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cancelButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
	phaseContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#222',
		padding: 15,
		borderRadius: 8,
		marginBottom: 10,
	},
	phaseContainerEditing: {
		borderWidth: 2,
		borderColor: '#fff',
	},
	phaseText: {
		color: '#fff',
		fontSize: 16,
		flex: 1,
	},
	phaseButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	editButton: {
		padding: 8,
	},
	editButtonText: {
		fontSize: 16,
	},
	deleteButton: {
		padding: 8,
	},
	deleteButtonText: {
		color: '#666',
		fontSize: 24,
	},
	footer: {
		marginTop: 'auto',
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
	exerciseNameContainer: {
		backgroundColor: '#111',
		borderRadius: 8,
		padding: 15,
		marginBottom: 20,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	exerciseName: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
	},
	setsSection: {
		backgroundColor: '#111',
		borderRadius: 8,
		padding: 15,
		marginBottom: 20,
	},
	setsHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	deleteExerciseButton: {
		padding: 8,
	},
	deleteExerciseButtonText: {
		color: '#666',
		fontSize: 24,
	},
});
