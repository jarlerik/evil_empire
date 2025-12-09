import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';

interface RepetitionMaximum {
	id: string;
	user_id: string;
	exercise_name: string;
	reps: number;
	weight: number;
	date: string;
	created_at: string;
	updated_at: string;
}

export default function RepetitionMaximums() {
	const { user } = useAuth();
	const [rms, setRms] = useState<RepetitionMaximum[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isModalVisible, setIsModalVisible] = useState(false);
	const [editingRm, setEditingRm] = useState<RepetitionMaximum | null>(null);
	const [exerciseName, setExerciseName] = useState('');
	const [reps, setReps] = useState('');
	const [weight, setWeight] = useState('');
	const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
	const [deletingId, setDeletingId] = useState<string | null>(null);

	useFocusEffect(
		useCallback(() => {
			if (user && supabase) {
				fetchRms();
			}
		}, [user])
	);

	const fetchRms = async () => {
		if (!supabase || !user) return;
		const { data, error } = await supabase
			.from('repetition_maximums')
			.select('*')
			.eq('user_id', user.id)
			.order('exercise_name', { ascending: true })
			.order('reps', { ascending: true })
			.order('date', { ascending: false });
		
		if (!error && data) {
			setRms(data);
		}
	};

	const handleOpenModal = (rm?: RepetitionMaximum) => {
		if (rm) {
			setEditingRm(rm);
			setExerciseName(rm.exercise_name);
			setReps(rm.reps.toString());
			setWeight(rm.weight.toString());
			setDate(rm.date);
		} else {
			setEditingRm(null);
			setExerciseName('');
			setReps('');
			setWeight('');
			setDate(format(new Date(), 'yyyy-MM-dd'));
		}
		setIsModalVisible(true);
	};

	const handleCloseModal = () => {
		setIsModalVisible(false);
		setEditingRm(null);
		setExerciseName('');
		setReps('');
		setWeight('');
		setDate(format(new Date(), 'yyyy-MM-dd'));
	};

	const handleSave = async () => {
		if (!exerciseName.trim() || !reps || !weight || !date || !user || !supabase) return;
		
		const repsNum = parseInt(reps);
		const weightNum = parseFloat(weight);
		
		if (isNaN(repsNum) || repsNum <= 0) {
			alert('Reps must be a positive number');
			return;
		}
		
		if (isNaN(weightNum) || weightNum <= 0) {
			alert('Weight must be a positive number');
			return;
		}

		setIsLoading(true);
		
		if (editingRm) {
			// Update existing RM
			const { error } = await supabase
				.from('repetition_maximums')
				.update({
					exercise_name: exerciseName.trim(),
					reps: repsNum,
					weight: weightNum,
					date: date
				})
				.eq('id', editingRm.id);
			
			if (error) {
				alert('Error updating repetition maximum: ' + (error.message || 'Unknown error'));
			} else {
				handleCloseModal();
				fetchRms();
			}
		} else {
			// Create new RM
			const { error } = await supabase
				.from('repetition_maximums')
				.insert([{
					user_id: user.id,
					exercise_name: exerciseName.trim(),
					reps: repsNum,
					weight: weightNum,
					date: date
				}]);
			
			if (error) {
				alert('Error creating repetition maximum: ' + (error.message || 'Unknown error'));
			} else {
				handleCloseModal();
				fetchRms();
			}
		}
		
		setIsLoading(false);
	};

	const handleDelete = async (id: string) => {
		if (!supabase) return;
		setDeletingId(id);
		const { error } = await supabase
			.from('repetition_maximums')
			.delete()
			.eq('id', id);
		
		if (!error) {
			fetchRms();
		} else {
			alert('Error deleting repetition maximum');
		}
		setDeletingId(null);
	};

	// Group RMs by exercise name, then by reps, showing only the best (highest weight) for each exercise/reps combination
	const groupedRms = rms.reduce((acc, rm) => {
		if (!acc[rm.exercise_name]) {
			acc[rm.exercise_name] = {};
		}
		const exerciseGroup = acc[rm.exercise_name];
		const repsKey = rm.reps.toString();
		
		// If no entry for this rep count, or if this weight is higher, or if same weight but more recent, use this entry
		if (!exerciseGroup[repsKey] || 
			rm.weight > exerciseGroup[repsKey].weight ||
			(rm.weight === exerciseGroup[repsKey].weight && new Date(rm.date) > new Date(exerciseGroup[repsKey].date))) {
			exerciseGroup[repsKey] = rm;
		}
		
		return acc;
	}, {} as Record<string, Record<string, RepetitionMaximum>>);

	// Convert nested object to array format for rendering
	const groupedRmsArray = Object.entries(groupedRms).map(([exerciseName, repsMap]) => ({
		exerciseName,
		rms: Object.values(repsMap).sort((a, b) => a.reps - b.reps) // Sort by reps ascending
	}));

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
						<Text style={styles.title}>Repetition Maximums</Text>
					</View>

					<Pressable 
						style={styles.addButton} 
						onPress={() => handleOpenModal()}
					>
						<Ionicons name="add" size={24} color="#fff" />
						<Text style={styles.addButtonText}>Add RM</Text>
					</Pressable>

					{groupedRmsArray.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>No repetition maximums yet</Text>
							<Text style={styles.emptySubtext}>Add your first RM to get started</Text>
						</View>
					) : (
						<View style={styles.listContainer}>
							{groupedRmsArray.map(({ exerciseName, rms: exerciseRms }) => (
								<View key={exerciseName} style={styles.exerciseGroup}>
									<Text style={styles.exerciseName}>{exerciseName}</Text>
									{exerciseRms.map((rm) => (
										<View key={rm.id} style={styles.rmItem}>
											<View style={styles.rmInfo}>
												<Text style={styles.rmText}>
													{rm.reps}RM: {rm.weight}kg
												</Text>
												<Text style={styles.rmDate}>
													{format(new Date(rm.date), 'MMM d, yyyy')}
												</Text>
											</View>
											<View style={styles.rmActions}>
												<Pressable 
													onPress={() => handleOpenModal(rm)}
													style={styles.editButton}
												>
													<Ionicons name="pencil-outline" size={20} color="#fff" />
												</Pressable>
												<Pressable 
													onPress={() => handleDelete(rm.id)}
													style={styles.deleteButton}
													disabled={deletingId === rm.id}
												>
													<Text style={styles.deleteButtonText}>×</Text>
												</Pressable>
											</View>
										</View>
									))}
								</View>
							))}
						</View>
					)}
				</View>
			</ScrollView>

			<Modal
				visible={isModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={handleCloseModal}
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
							<Pressable onPress={handleCloseModal} style={styles.closeButton}>
								<Text style={styles.closeButtonText}>×</Text>
							</Pressable>
						</View>

						<View style={styles.form}>
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

							<Text style={styles.label}>Weight (kg)</Text>
							<TextInput
								style={styles.input}
								value={weight}
								onChangeText={setWeight}
								placeholder="e.g., 150"
								placeholderTextColor="#666"
								keyboardType="decimal-pad"
							/>

							<Text style={styles.label}>Date</Text>
							<TextInput
								style={styles.input}
								value={date}
								onChangeText={setDate}
								placeholder="yyyy-MM-dd"
								placeholderTextColor="#666"
							/>

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
		marginBottom: 30,
	},
	backButton: {
		marginRight: 12,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 24,
	},
	title: {
		color: '#fff',
		fontSize: 32,
		fontWeight: 'bold',
		flex: 1,
	},
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		marginBottom: 20,
		gap: 8,
	},
	addButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyText: {
		color: '#666',
		fontSize: 18,
		marginBottom: 8,
	},
	emptySubtext: {
		color: '#444',
		fontSize: 14,
	},
	listContainer: {
		flex: 1,
	},
	exerciseGroup: {
		marginBottom: 30,
	},
	exerciseName: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 12,
	},
	rmItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#222',
		padding: 15,
		borderRadius: 8,
		marginBottom: 10,
	},
	rmInfo: {
		flex: 1,
	},
	rmText: {
		color: '#fff',
		fontSize: 16,
		marginBottom: 4,
	},
	rmDate: {
		color: '#666',
		fontSize: 14,
	},
	rmActions: {
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

