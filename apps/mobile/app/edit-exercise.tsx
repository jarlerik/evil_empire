import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { reverseParsePhase } from '../lib/parseSetInput';
import { deleteExercise, updateExerciseName } from '../services/exerciseService';
import { formatExercisePhase, ExercisePhase } from '../lib/formatExercisePhase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { useAddExercisePhase } from '../hooks/useAddExercisePhase';
import { commonStyles } from '../styles/common';

export default function EditExercise() {
	const params = useLocalSearchParams();
	const { exerciseId, exerciseName: initialExerciseName } = params;
	const [exerciseName] = useState(initialExerciseName as string);
	const [setInput, setSetInput] = useState('');
	const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
	const { user } = useAuth();
	const inputValueRef = useRef<string>('');

	const {
		exercisePhases,
		isLoading,
		addExercisePhase,
		deletePhase,
	} = useAddExercisePhase({
		exerciseId,
		exerciseName,
		userId: user?.id,
	});

	// Save input value whenever it changes
	useEffect(() => {
		inputValueRef.current = setInput;
	}, [setInput]);

	// Preserve input state when navigating away and back
	useFocusEffect(
		React.useCallback(() => {
			// Restore input value when screen comes into focus
			if (inputValueRef.current) {
				setSetInput(inputValueRef.current);
			}
		}, []),
	);

	const handleEditPhase = (phase: ExercisePhase) => {
		setEditingPhaseId(phase.id);
		setSetInput(reverseParsePhase(phase));
	};

	const handleCancelEdit = () => {
		setEditingPhaseId(null);
		setSetInput('');
	};

	const handleAddSet = async () => {
		const result = await addExercisePhase(setInput, editingPhaseId);

		if (!result.success) {
			Alert.alert('Error', result.error || 'Unknown error');
			return;
		}

		setSetInput('');
		setEditingPhaseId(null);
	};

	const handleDeletePhase = async (phaseId: string) => {
		await deletePhase(phaseId);
	};

	const handleDeleteExercise = async () => {
		if (!exerciseId) {return;}
		const exerciseIdStr = Array.isArray(exerciseId) ? exerciseId[0] : exerciseId;
		const { error } = await deleteExercise(exerciseIdStr);

		if (!error) {
			router.back();
		}
	};

	const handleBackPress = () => {
		if (exercisePhases.length === 0) {
			Alert.alert(
				'No sets and reps',
				'',
				[
					{
						text: 'Delete exercise',
						onPress: () => handleDeleteExercise(),
						style: 'destructive',
					},
					{
						text: 'Continue',
						style: 'cancel',
					},
				],
			);
		} else {
			router.back();
		}
	};

	const handleSave = async () => {
		if (!exerciseName.trim() || !exerciseId) {return;}
		const exerciseIdStr = Array.isArray(exerciseId) ? exerciseId[0] : exerciseId;
		const { error } = await updateExerciseName(exerciseIdStr, exerciseName.trim());

		if (!error) {
			router.back();
		} else {
			Alert.alert('Error', 'Error saving exercise');
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
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Pressable onPress={handleBackPress} style={commonStyles.backButton}>
							<Text style={commonStyles.backButtonText}>←</Text>
						</Pressable>
						<Text style={commonStyles.titleFlex}>{exerciseName}</Text>
						<Pressable
							onPress={() => handleDeleteExercise()}
							style={styles.deleteExerciseButton}
						>
							<Text style={styles.deleteExerciseButtonText}>×</Text>
						</Pressable>
					</View>

					<View style={styles.setsSection}>
						<View style={styles.setsHeader}>
							<Text style={commonStyles.subtitle}>Sets and repetitions</Text>
							<View style={styles.headerButtons}>
								<Pressable
									style={styles.inputOptionsButton}
									onPress={() => router.push('/exercise-input-help')}
								>
									<Text style={styles.inputOptionsButtonText}>Input options</Text>
								</Pressable>
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
							placeholder="4 x 3 @100kg 120s"
							placeholderTextColor="#666"
							returnKeyType="done"
							onSubmitEditing={handleAddSet}
							multiline
							textAlignVertical="top"
						/>
						<Button
							title={editingPhaseId ? 'Update' : 'Add'}
							onPress={handleAddSet}
							disabled={isLoading}
							style={{ marginTop: 12 }}
						/>
					</View>

					{exercisePhases.map((phase) => (
							<View
								key={phase.id}
								style={[
									styles.phaseContainer,
									editingPhaseId === phase.id && styles.phaseContainerEditing,
								]}
							>
								<Text style={styles.phaseText}>
									{formatExercisePhase(phase)}
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
						<Button title="Save" onPress={handleSave} />
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	headerRow: {
		marginBottom: 40,
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
	headerButtons: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	inputOptionsButton: {
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	inputOptionsButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
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
		color: '#C65D24',
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
	setsSection: {
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
