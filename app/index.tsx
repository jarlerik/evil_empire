import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';

export default function Index() {
	const { user, loading: authLoading } = useAuth();
	const { settings, loading: settingsLoading, updateSettings } = useUserSettings();
	const router = useRouter();
	const [isEditingWeight, setIsEditingWeight] = useState(false);
	const [tempWeight, setTempWeight] = useState(settings?.user_weight || '85');
	const [isEditingUnit, setIsEditingUnit] = useState(false);

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	const handleCreateWorkout = () => {
		router.push('/create-workout');
	};

	const handleWeightEdit = () => {
		if (!settings) return;
		setIsEditingWeight(true);
		setTempWeight(settings.user_weight);
	};

	const handleWeightSave = async () => {
		try {
			await updateSettings({ user_weight: tempWeight });
			setIsEditingWeight(false);
		} catch (error) {
			console.error('Error saving weight:', error);
		}
	};

	const handleUnitSelect = async (unit: 'kg' | 'lbs') => {
		try {
			await updateSettings({ weight_unit: unit });
			setIsEditingUnit(false);
		} catch (error) {
			console.error('Error updating weight unit:', error);
		}
	};

	if (authLoading || settingsLoading) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>Loading...</Text>
			</View>
		);
	}

	return (
		<Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }} accessible={false}>
			<View style={styles.container}>
				<Text style={styles.headerTitle}>Settings</Text>
				<View style={styles.settings}>
					<View style={styles.email}>
						<Text style={styles.title}>Email</Text>
						<Text style={styles.subtitle}>{user?.email}</Text>
					</View>
					<View style={styles.units}>
					</View>
				
					<Text style={styles.title}>Units</Text>
					<Pressable onPress={() => setIsEditingUnit(true)} style={styles.dropdownButton}>
						<Text style={styles.dropdownText}>{settings?.weight_unit}</Text>
						<Text style={styles.dropdownArrow}>▼</Text>
					</Pressable>
					<Modal
						visible={isEditingUnit}
						transparent={true}
						animationType="slide"
						onRequestClose={() => setIsEditingUnit(false)}
					>
						<View style={styles.modalContainer}>
							<View style={styles.modalContent}>
								<Text style={styles.modalTitle}>Select Weight Unit</Text>
								<Pressable
									style={styles.unitOption}
									onPress={() => handleUnitSelect('kg')}
								>
									<Text style={[
										styles.unitOptionText,
										settings?.weight_unit === 'kg' && styles.selectedUnit
									]}>Kilograms (kg)</Text>
								</Pressable>
								<Pressable
									style={styles.unitOption}
									onPress={() => handleUnitSelect('lbs')}
								>
									<Text style={[
										styles.unitOptionText,
										settings?.weight_unit === 'lbs' && styles.selectedUnit
									]}>Pounds (lbs)</Text>
								</Pressable>
								<Pressable
									style={styles.closeButton}
									onPress={() => setIsEditingUnit(false)}
								>
									<Text style={styles.closeButtonText}>Cancel</Text>
								</Pressable>
							</View>
						</View>
					</Modal>
					
				</View>
				<View style={styles.weightContainer}>
					<Text style={styles.weightTitle}>Weight</Text>
					{isEditingWeight ? (
						<View style={styles.weightEditContainer}>
							<TextInput
								style={styles.weightInput}
								value={tempWeight}
								onChangeText={setTempWeight}
								keyboardType="numeric"
								maxLength={5}
								returnKeyType="done"
								onSubmitEditing={Keyboard.dismiss}
							/>
							<Text style={styles.weightUnit}>{settings?.weight_unit}</Text>
							<Pressable style={styles.saveButton} onPress={handleWeightSave}>
								<Text style={styles.saveButtonText}>Save</Text>
							</Pressable>
						</View>
					) : (
						<View style={styles.weightEditContainer}>
							<Text style={styles.weightValue}>{settings?.user_weight} {settings?.weight_unit}</Text>
							<Pressable onPress={handleWeightEdit}>
								<Text style={styles.editWeightButton}>Change your weight</Text>
							</Pressable>
						</View>
					)}
				</View>
				<View style={styles.footer}>
					<Pressable style={styles.button} onPress={handleCreateWorkout}>
						<Text style={styles.buttonText}>Workouts</Text>
					</Pressable>
					<Pressable 
						style={[styles.button, styles.buttonMargin]} 
						onPress={() => router.push('/repetition-maximums')}
					>
						<Text style={styles.buttonText}>Repetition Maximums</Text>
					</Pressable>
				</View>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
		padding: 20,
	},
	settings: {},
	header: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 36,
		fontWeight: 'bold',
		color: '#fff',
	},
	email: {
		flex: 1,
	},
	units: {
		flex: 1,
	},
	weightContainer: {
		flex: 1,
		justifyContent: 'center',
	},
	weight: {
		flex: 1,
	},
	changeUnit: {
		fontSize: 12,
		color: '#fff',
		textAlign: 'center',
		marginBottom: 10,
		textDecorationLine: 'underline',
	},
	editWeightButton: {
		fontSize: 12,
		color: '#fff',
		textAlign: 'center',
		marginTop: 10,
		marginBottom: 10,
		textDecorationLine: 'underline',
	},
	weightTitle: {
		fontSize: 48,
		fontWeight: 'bold',
		color: '#fff',
		marginTop: 5,
		textAlign: 'center',
	},
	weightValue: {
		fontSize: 48,
		fontWeight: 'bold',
		color: '#666666',
		marginTop: 5,
		textAlign: 'center',
	},
	footer: {
		marginTop: 'auto',
	},
	title: {
		fontSize: 24,
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
	buttonMargin: {
		marginTop: 12,
	},
	weightEditContainer: {
		alignItems: 'center',
		marginTop: 10,
	},
	weightInput: {
		fontSize: 48,
		fontWeight: 'bold',
		color: '#fff',
		textAlign: 'center',
		borderBottomWidth: 2,
		borderBottomColor: '#666',
		paddingBottom: 5,
		minWidth: 120,
	},
	weightUnit: {
		fontSize: 24,
		color: '#666666',
		marginTop: 5,
	},
	saveButton: {
		backgroundColor: '#333',
		paddingVertical: 10,
		paddingHorizontal: 30,
		borderRadius: 8,
		marginTop: 20,
	},
	saveButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		backgroundColor: '#1a1a1a',
		padding: 20,
		borderRadius: 12,
		width: '80%',
		alignItems: 'center',
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#fff',
		marginBottom: 20,
	},
	unitOption: {
		paddingVertical: 15,
		paddingHorizontal: 20,
		width: '100%',
		borderRadius: 8,
		marginBottom: 10,
	},
	unitOptionText: {
		color: '#fff',
		fontSize: 16,
		textAlign: 'center',
	},
	selectedUnit: {
		color: '#007AFF',
		fontWeight: 'bold',
	},
	closeButton: {
		marginTop: 10,
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderRadius: 8,
		backgroundColor: '#333',
	},
	closeButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	dropdownButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#333',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		marginTop: 8,
		marginBottom: 40,
	},
	dropdownText: {
		fontSize: 16,
		color: '#fff',
		marginRight: 8,
	},
	dropdownArrow: {
		fontSize: 12,
		color: '#fff',
		opacity: 0.7,
	},
});
