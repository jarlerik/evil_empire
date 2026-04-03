import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { format } from 'date-fns';
import { RepetitionMaximum } from '../services/types';

export interface RmFormData {
	exerciseName: string;
	reps: number;
	weight: number;
	date: string;
}

interface RmFormModalProps {
	visible: boolean;
	onClose: () => void;
	onSave: (data: RmFormData) => Promise<void>;
	editingRm?: RepetitionMaximum | null;
	defaultExerciseName?: string;
	isLoading: boolean;
	unit?: 'kg' | 'lbs';
}

export function RmFormModal({
	visible,
	onClose,
	onSave,
	editingRm,
	defaultExerciseName,
	isLoading,
	unit = 'kg',
}: RmFormModalProps) {
	const [exerciseName, setExerciseName] = useState('');
	const [reps, setReps] = useState('');
	const [weight, setWeight] = useState('');
	const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

	// Reset form when modal opens/closes or when editing different RM
	useEffect(() => {
		if (visible) {
			if (editingRm) {
				setExerciseName(editingRm.exercise_name);
				setReps(editingRm.reps.toString());
				setWeight(editingRm.weight.toString());
				setDate(editingRm.date);
			} else {
				setExerciseName(defaultExerciseName || '');
				setReps(defaultExerciseName ? '1' : '');
				setWeight('');
				setDate(format(new Date(), 'yyyy-MM-dd'));
			}
		}
	}, [visible, editingRm]);

	const handleSave = async () => {
		if (!exerciseName.trim() || !reps || !weight || !date) {
			Alert.alert('Error', 'Please fill in all fields');
			return;
		}

		const repsNum = parseInt(reps);
		const weightNum = parseFloat(weight);

		if (isNaN(repsNum) || repsNum <= 0) {
			Alert.alert('Error', 'Reps must be a positive number');
			return;
		}

		if (isNaN(weightNum) || weightNum <= 0) {
			Alert.alert('Error', 'Weight must be a positive number');
			return;
		}

		await onSave({
			exerciseName: exerciseName.trim(),
			reps: repsNum,
			weight: weightNum,
			date,
		});
	};

	const handleClose = () => {
		setExerciseName('');
		setReps('');
		setWeight('');
		setDate(format(new Date(), 'yyyy-MM-dd'));
		onClose();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={handleClose}
		>
			<KeyboardAvoidingView
				style={styles.modalContainer}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>
							{editingRm ? 'Edit RM' : 'Add RM'}
						</Text>
						<Pressable onPress={handleClose} style={styles.closeButton}>
							<Text style={styles.closeButtonText}>×</Text>
						</Pressable>
					</View>

					<View style={styles.form}>
						{defaultExerciseName && (
							<Text style={styles.infoText}>
								No 1RM found for this exercise. Add your 1RM to calculate percentage-based weights.
							</Text>
						)}

						<Text style={styles.label}>Exercise Name</Text>
						<TextInput
							style={styles.input}
							value={exerciseName}
							onChangeText={setExerciseName}
							placeholder="e.g., Squat"
							placeholderTextColor="#666"
							autoCapitalize="words"
						/>

						<Text style={styles.label}>Reps</Text>
						<TextInput
							style={styles.input}
							value={reps}
							onChangeText={setReps}
							placeholder="e.g., 1"
							placeholderTextColor="#666"
							keyboardType="numeric"
						/>

						<Text style={styles.label}>Weight ({unit})</Text>
						<TextInput
							style={styles.input}
							value={weight}
							onChangeText={setWeight}
							placeholder="e.g., 150"
							placeholderTextColor="#666"
							keyboardType="decimal-pad"
						/>

						{!defaultExerciseName && (
							<>
								<Text style={styles.label}>Date</Text>
								<TextInput
									style={styles.input}
									value={date}
									onChangeText={setDate}
									placeholder="yyyy-MM-dd"
									placeholderTextColor="#666"
								/>
							</>
						)}

						<Pressable
							style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
							onPress={handleSave}
							disabled={isLoading}
						>
							<Text style={styles.saveButtonText}>
								{isLoading ? 'Saving...' : (editingRm ? 'Update' : 'Add')}
							</Text>
						</Pressable>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
	},
	modalContent: {
		backgroundColor: '#1a1a1a',
		borderRadius: 12,
		width: '90%',
		maxWidth: 400,
		padding: 20,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	modalTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#fff',
	},
	closeButton: {
		padding: 4,
	},
	closeButtonText: {
		color: '#fff',
		fontSize: 28,
	},
	form: {
		gap: 16,
	},
	infoText: {
		color: '#999',
		fontSize: 14,
		lineHeight: 20,
	},
	label: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 4,
	},
	input: {
		backgroundColor: '#222',
		color: '#fff',
		borderRadius: 8,
		padding: 15,
		fontSize: 16,
	},
	saveButton: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 10,
	},
	saveButtonDisabled: {
		opacity: 0.5,
	},
	saveButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
});
