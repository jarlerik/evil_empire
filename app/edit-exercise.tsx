import { View, Text, TextInput, Pressable, StyleSheet, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { parseSetInput, reverseParsePhase } from '../lib/parseSetInput';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface ExercisePhase {
	id: string;
	exercise_id: string;
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
	exercise_type?: string;
	notes?: string;
	target_rm?: number;
	rir_min?: number;
	rir_max?: number;
	circuit_exercises?: Array<{reps: string, name: string}> | string;
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
	const { user } = useAuth();

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
		if (!exerciseId || !supabase || !user) return;
		
		setIsLoading(true);

		// Handle percentage-based weights (RM lookup needed)
		let calculatedWeight = parsedData.weight;
		if (parsedData.needsRmLookup && parsedData.weightPercentage !== undefined) {
			// Query for most recent 1RM matching exercise name
			// Always use 1RM for percentage calculations (as per user requirement)
			const { data: rmData, error: rmError } = await supabase
				.from('repetition_maximums')
				.select('weight')
				.eq('user_id', user.id)
				.ilike('exercise_name', exerciseName.trim())
				.eq('reps', 1) // Always use 1RM for percentage calculations
				.order('date', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (rmError || !rmData) {
				setIsLoading(false);
				alert(`No 1RM found for "${exerciseName}". Please set your 1RM first.`);
				return;
			}

			// Calculate absolute weight from percentage and round to nearest integer
			calculatedWeight = Math.round((rmData.weight * parsedData.weightPercentage) / 100);
		}

		// If we're editing an existing phase, update it instead of creating a new one
		if (editingPhaseId) {
			const updateData: any = {
				sets: parsedData.sets,
				repetitions: parsedData.reps,
				weight: calculatedWeight
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

			// Add exercise type
			if (parsedData.exerciseType) {
				updateData.exercise_type = parsedData.exerciseType;
			} else {
				updateData.exercise_type = 'standard';
			}

			// Add notes if present
			if (parsedData.notes) {
				updateData.notes = parsedData.notes;
			} else {
				updateData.notes = null;
			}

			// Add target RM if present
			if (parsedData.targetRm) {
				updateData.target_rm = parsedData.targetRm;
			} else {
				updateData.target_rm = null;
			}

			// Add RIR values if present
			if (parsedData.rirMin !== undefined) {
				updateData.rir_min = parsedData.rirMin;
				updateData.rir_max = parsedData.rirMax || parsedData.rirMin;
			} else {
				updateData.rir_min = null;
				updateData.rir_max = null;
			}

			// Add circuit exercises if present
			if (parsedData.circuitExercises && parsedData.circuitExercises.length > 0) {
				updateData.circuit_exercises = parsedData.circuitExercises;
			} else {
				updateData.circuit_exercises = null;
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
			weight: calculatedWeight
		};

		// Add compound_reps if it's a compound exercise
		if (parsedData.compoundReps) {
			insertData.compound_reps = parsedData.compoundReps;
		}

		// Add weights array if multiple weights are specified
		if (parsedData.weights) {
			insertData.weights = parsedData.weights;
		}

		// Add exercise type
		if (parsedData.exerciseType) {
			insertData.exercise_type = parsedData.exerciseType;
		} else {
			insertData.exercise_type = 'standard';
		}

		// Add notes if present
		if (parsedData.notes) {
			insertData.notes = parsedData.notes;
		}

		// Add target RM if present
		if (parsedData.targetRm) {
			insertData.target_rm = parsedData.targetRm;
		}

		// Add RIR values if present
		if (parsedData.rirMin !== undefined) {
			insertData.rir_min = parsedData.rirMin;
			insertData.rir_max = parsedData.rirMax || parsedData.rirMin;
		}

		// Add circuit exercises if present
		if (parsedData.circuitExercises && parsedData.circuitExercises.length > 0) {
			insertData.circuit_exercises = parsedData.circuitExercises;
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
					alert('Error adding wave phase: ' + (phaseError.message || 'Unknown error'));
					setIsLoading(false);
					return;
				}
			}
			
			// Clear input and refresh phases
			setSetInput('');
			fetchExercisePhases();
			setIsLoading(false);
			return;
		}

		const { error } = await supabase
			.from('exercise_phases')
			.insert([insertData]);

		if (!error) {
			setSetInput('');
			fetchExercisePhases();
		} else {
			console.error('Error adding phase:', error);
			alert('Error adding phase: ' + (error.message || 'Unknown error'));
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
			router.back();
		} else {
			alert('Error saving exercise');
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
					<View style={styles.headerRow}>
						<Pressable onPress={() => router.back()} style={styles.backButton}>
							<Text style={styles.backButtonText}>←</Text>
						</Pressable>
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
							placeholder="4 x 3 @50kg, 4 x 5@80%, 2 x 10/10 banded side step, 10 banded skated walk forward..., Build to 8RM, 2x 10, 2-3RIR"
							placeholderTextColor="#666"
							returnKeyType="done"
							onSubmitEditing={handleAddSet}
							multiline
							textAlignVertical="top"
						/>
						<Pressable 
							style={[styles.addButton, isLoading && styles.addButtonDisabled]} 
							onPress={handleAddSet}
							disabled={isLoading}
						>
							<Text style={[styles.addButtonText, isLoading && styles.addButtonTextDisabled]}>
								{editingPhaseId ? 'Update' : 'Add'}
							</Text>
						</Pressable>
					</View>

					{exercisePhases.map((phase) => {
						const formatPhase = (p: ExercisePhase): string => {
							// Handle RM build format
							if (p.exercise_type === 'rm_build' && p.target_rm) {
								return `Build to ${p.target_rm}RM`;
							}
							
							// Handle circuit format
							if (p.exercise_type === 'circuit' && p.circuit_exercises) {
								let circuitExercises: Array<{reps: string, name: string}> = [];
								
								// Handle JSONB string from database
								if (typeof p.circuit_exercises === 'string') {
									try {
										circuitExercises = JSON.parse(p.circuit_exercises);
									} catch (e) {
										return `${p.sets} sets of ${p.circuit_exercises}`;
									}
								} else {
									circuitExercises = p.circuit_exercises;
								}
								
								if (circuitExercises.length > 0) {
									const exercisesStr = circuitExercises.map(ex => {
										if (ex.reps && ex.name) {
											return `${ex.reps} ${ex.name}`;
										} else if (ex.name) {
											return ex.name;
										}
										return '';
									}).filter(s => s.length > 0).join(', ');
									
									return `${p.sets} x ${exercisesStr}`;
								}
							}
							
							// Handle RIR format
							if (p.rir_min !== undefined && p.rir_min !== null) {
								const rirStr = p.rir_max && p.rir_max !== p.rir_min 
									? `${p.rir_min}-${p.rir_max}RIR`
									: `${p.rir_min}RIR`;
								
								// If there's a weight, include it
								if (p.weight > 0) {
									return `${p.sets} x ${p.repetitions} @${p.weights ? p.weights.map(w => `${w}kg`).join(' ') : `${p.weight}kg`}, ${rirStr}`;
								} else {
									return `${p.sets} x ${p.repetitions}, ${rirStr}`;
								}
							}
							
							// Handle compound exercises
							if (p.compound_reps && p.compound_reps.length === 2) {
								return `${p.sets} x ${p.compound_reps[0]} + ${p.compound_reps[1]} @${p.weights ? p.weights.map(w => `${w}kg`).join(' ') : `${p.weight}kg`}`;
							}
							
							// Handle multiple weights
							if (p.weights && p.weights.length > 1) {
								const weightsStr = p.weights.map(w => `${w}kg`).join(' ');
								return `${p.sets} x ${p.repetitions} @${weightsStr}`;
							}
							
							// Handle simple format
							return `${p.sets} x ${p.repetitions} @${p.weight}kg`;
						};
						
						return (
							<View 
								key={phase.id} 
								style={[
									styles.phaseContainer,
									editingPhaseId === phase.id && styles.phaseContainerEditing
								]}
							>
								<Text style={styles.phaseText}>
									{formatPhase(phase)}
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
					);
					})}

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
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 20,
		marginBottom: 40,
	},
	backButton: {
		marginRight: 12,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 24,
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
		minHeight: 90,
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
		paddingVertical: 12,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 12,
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
	exerciseName: {
		color: '#fff',
		fontSize: 32,
		fontWeight: 'bold',
		flex: 1,
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
