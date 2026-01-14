import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import React, { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { RmFormModal, RmFormData } from '../components/RmFormModal';

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
		setEditingRm(rm || null);
		setIsModalVisible(true);
	};

	const handleCloseModal = () => {
		setIsModalVisible(false);
		setEditingRm(null);
	};

	const handleSave = async (data: RmFormData) => {
		if (!user || !supabase) return;

		setIsLoading(true);

		if (editingRm) {
			// Update existing RM
			const { error } = await supabase
				.from('repetition_maximums')
				.update({
					exercise_name: data.exerciseName,
					reps: data.reps,
					weight: data.weight,
					date: data.date
				})
				.eq('id', editingRm.id);

			if (error) {
				Alert.alert('Error', 'Error updating repetition maximum: ' + (error.message || 'Unknown error'));
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
					exercise_name: data.exerciseName,
					reps: data.reps,
					weight: data.weight,
					date: data.date
				}]);

			if (error) {
				Alert.alert('Error', 'Error creating repetition maximum: ' + (error.message || 'Unknown error'));
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
			Alert.alert('Error', 'Error deleting repetition maximum');
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
						<Text style={styles.title}>Max reps</Text>
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

			<RmFormModal
				visible={isModalVisible}
				onClose={handleCloseModal}
				onSave={handleSave}
				editingRm={editingRm}
				isLoading={isLoading}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#171717',
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
		color: '#c65d24',
		textTransform: 'uppercase',
		fontSize: 32,
		fontWeight: 'bold',
		flex: 1,
	},
	addButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#c65d24',
		padding: 15,
		borderRadius: 8,
		marginBottom: 20,
		gap: 8,
	},
	addButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
		backgroundColor: '#c65d24',
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
});
