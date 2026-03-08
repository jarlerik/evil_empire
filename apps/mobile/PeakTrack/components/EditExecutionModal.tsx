import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Button } from './Button';
import { ExercisePhase, formatExercisePhase } from '../lib/formatExercisePhase';
import { parseSetInput, ParsedSetData } from '../lib/parseSetInput';
import { interpolateWeight } from '../lib/interpolateWeight';

interface EditExecutionModalProps {
	visible: boolean;
	onClose: () => void;
	onSave: (executionData: ExecutionLogData) => Promise<void>;
	onSkip: () => void;
	exerciseName: string;
	exerciseId: string;
	phases: ExercisePhase[];
}

export interface ExecutionLogData {
	exercise_id: string;
	phases: Array<{
		exercise_phase_id: string;
		input: string;
		parsed: ParsedSetData;
	}>;
}

function isWeightRangePhase(phase: ExercisePhase): boolean {
	return phase.weight_min != null && phase.weight_max != null && phase.weight_min !== phase.weight_max;
}

function getInterpolatedWeights(phase: ExercisePhase): number[] {
	const weights: number[] = [];
	for (let i = 1; i <= phase.sets; i++) {
		weights.push(interpolateWeight(phase.weight_min!, phase.weight_max!, i, phase.sets));
	}
	return weights;
}

export function EditExecutionModal({
	visible,
	onClose,
	onSave,
	onSkip,
	exerciseName,
	exerciseId,
	phases,
}: EditExecutionModalProps) {
	const [phaseInputs, setPhaseInputs] = useState<Record<string, string>>({});
	const [perSetWeights, setPerSetWeights] = useState<Record<string, number[]>>({});
	const [isLoading, setIsLoading] = useState(false);

	// Initialize inputs with formatted planned values when modal opens
	useEffect(() => {
		if (visible && phases.length > 0) {
			const initialInputs: Record<string, string> = {};
			const initialWeights: Record<string, number[]> = {};
			phases.forEach(phase => {
				if (isWeightRangePhase(phase)) {
					initialWeights[phase.id] = getInterpolatedWeights(phase);
				} else {
					initialInputs[phase.id] = formatExercisePhase(phase);
				}
			});
			setPhaseInputs(initialInputs);
			setPerSetWeights(initialWeights);
		}
	}, [visible, phases]);

	const handleInputChange = (phaseId: string, value: string) => {
		setPhaseInputs(prev => ({
			...prev,
			[phaseId]: value,
		}));
	};

	const handleWeightChange = (phaseId: string, setIndex: number, value: string) => {
		const numValue = value === '' ? 0 : Number(value);
		if (isNaN(numValue)) return;
		setPerSetWeights(prev => {
			const updated = [...(prev[phaseId] || [])];
			updated[setIndex] = numValue;
			return { ...prev, [phaseId]: updated };
		});
	};

	const handleSave = async () => {
		setIsLoading(true);

		const executionPhases: ExecutionLogData['phases'] = [];

		for (const phase of phases) {
			if (isWeightRangePhase(phase)) {
				const weights = perSetWeights[phase.id] || getInterpolatedWeights(phase);
				const repsStr = phase.compound_reps ? phase.compound_reps.join(' + ') : String(phase.repetitions);
				const weightsStr = weights.join(' ');
				const input = `${phase.sets} x ${repsStr} @${weightsStr}kg`;

				const parsed: ParsedSetData = {
					sets: phase.sets,
					reps: phase.repetitions,
					weight: weights[0],
					weights,
					isValid: true,
					...(phase.compound_reps && { compoundReps: phase.compound_reps }),
					...(phase.rest_time_seconds && { restTimeSeconds: phase.rest_time_seconds }),
				};

				executionPhases.push({
					exercise_phase_id: phase.id,
					input,
					parsed,
				});
			} else {
				const input = phaseInputs[phase.id] || formatExercisePhase(phase);
				const parsed = parseSetInput(input);

				if (!parsed.isValid) {
					Alert.alert('Error', `Invalid format for phase: ${input}. ${parsed.errorMessage || ''}`);
					setIsLoading(false);
					return;
				}

				executionPhases.push({
					exercise_phase_id: phase.id,
					input,
					parsed,
				});
			}
		}

		try {
			await onSave({
				exercise_id: exerciseId,
				phases: executionPhases,
			});
		} catch (error) {
			console.error('Error saving execution log:', error);
			Alert.alert('Error', 'Error saving execution log');
		}

		setIsLoading(false);
	};

	const handleSkip = () => {
		onSkip();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				style={styles.modalContainer}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle} numberOfLines={1}>
							{exerciseName}
						</Text>
						<Pressable onPress={onClose} style={styles.closeButton}>
							<Text style={styles.closeButtonText}>x</Text>
						</Pressable>
					</View>

					<ScrollView style={styles.phasesScroll}>
						{phases.map(phase => (
							<View key={phase.id} style={styles.phaseItem}>
								<Text style={styles.plannedLabel}>Planned:</Text>
								<Text style={styles.plannedValue}>{formatExercisePhase(phase)}</Text>
								{phase.notes && (
									<Text style={styles.plannedNotes}>{phase.notes}</Text>
								)}
								<Text style={styles.actualLabel}>Actual:</Text>
								{isWeightRangePhase(phase) ? (
									<View style={styles.perSetContainer}>
										{(perSetWeights[phase.id] || getInterpolatedWeights(phase)).map((weight, index) => (
											<View key={index} style={styles.perSetRow}>
												<Text style={styles.perSetLabel}>Set {index + 1}:</Text>
												<TextInput
													style={styles.perSetInput}
													value={String(weight)}
													onChangeText={(value) => handleWeightChange(phase.id, index, value)}
													keyboardType="numeric"
												/>
												<Text style={styles.perSetUnit}>kg</Text>
											</View>
										))}
									</View>
								) : (
									<TextInput
										style={styles.input}
										value={phaseInputs[phase.id] || ''}
										onChangeText={(value) => handleInputChange(phase.id, value)}
										placeholder={formatExercisePhase(phase)}
										placeholderTextColor="#666"
									/>
								)}
							</View>
						))}
					</ScrollView>

					<View style={styles.buttonRow}>
						<Button
							title="Skip"
							variant="secondary"
							onPress={handleSkip}
							style={styles.button}
						/>
						<Button
							title={isLoading ? 'Saving...' : 'Save'}
							onPress={handleSave}
							disabled={isLoading}
							style={styles.button}
						/>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		backgroundColor: '#171717',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 20,
		maxHeight: '80%',
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	modalTitle: {
		color: '#C65D24',
		fontSize: 20,
		fontWeight: 'bold',
		textTransform: 'uppercase',
		flex: 1,
		marginRight: 10,
	},
	closeButton: {
		padding: 8,
	},
	closeButtonText: {
		color: '#666',
		fontSize: 24,
	},
	phasesScroll: {
		marginBottom: 20,
	},
	phaseItem: {
		marginBottom: 16,
		backgroundColor: '#222',
		borderRadius: 8,
		padding: 12,
	},
	plannedLabel: {
		color: '#666',
		fontSize: 12,
		marginBottom: 2,
	},
	plannedValue: {
		color: '#888',
		fontSize: 14,
		marginBottom: 4,
	},
	plannedNotes: {
		color: '#fff',
		fontSize: 12,
		marginBottom: 8,
	},
	actualLabel: {
		color: '#fff',
		fontSize: 12,
		marginBottom: 4,
	},
	input: {
		backgroundColor: '#333',
		color: '#fff',
		borderRadius: 6,
		padding: 10,
		fontSize: 16,
	},
	perSetContainer: {
		gap: 8,
	},
	perSetRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	perSetLabel: {
		color: '#888',
		fontSize: 14,
		width: 50,
	},
	perSetInput: {
		backgroundColor: '#333',
		color: '#fff',
		borderRadius: 6,
		padding: 10,
		fontSize: 16,
		flex: 1,
	},
	perSetUnit: {
		color: '#888',
		fontSize: 14,
		width: 24,
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
	},
	button: {
		flex: 1,
	},
});
