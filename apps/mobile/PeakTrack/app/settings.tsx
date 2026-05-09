import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Keyboard, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { commonStyles, colors } from '../styles/common';
import { NavigationBar } from '../components/NavigationBar';

export default function Settings() {
	const { user, loading: authLoading, signOut } = useAuth();
	const { settings, loading: settingsLoading, updateSettings } = useUserSettings();
	const router = useRouter();
	const [isEditingUnit, setIsEditingUnit] = useState(false);
	const [restInput, setRestInput] = useState('');

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	useEffect(() => {
		setRestInput(settings?.default_rest_seconds != null ? String(settings.default_rest_seconds) : '');
	}, [settings?.default_rest_seconds]);

	const handleUnitSelect = async (unit: 'kg' | 'lbs') => {
		try {
			await updateSettings({ weight_unit: unit });
			setIsEditingUnit(false);
		} catch (error) {
			console.error('Error updating weight unit:', error);
		}
	};

	const commitRest = async () => {
		const trimmed = restInput.trim();
		if (trimmed === '') {
			if (settings?.default_rest_seconds != null) {
				await updateSettings({ default_rest_seconds: null });
			}
			return;
		}
		const parsed = parseInt(trimmed, 10);
		if (Number.isNaN(parsed) || parsed < 0) {
			setRestInput(settings?.default_rest_seconds != null ? String(settings.default_rest_seconds) : '');
			return;
		}
		if (parsed !== settings?.default_rest_seconds) {
			await updateSettings({ default_rest_seconds: parsed });
		}
	};

	if (authLoading || settingsLoading) {
		return (
			<View style={styles.screen}>
				<View style={[commonStyles.container, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
				<NavigationBar />
			</View>
		);
	}

	return (
		<View style={styles.screen}>
			<Pressable onPress={Keyboard.dismiss} style={styles.flex} accessible={false}>
				<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
					<View style={commonStyles.container}>
						<View style={[commonStyles.headerRow, styles.headerRow]}>
							<Pressable onPress={() => router.back()} style={commonStyles.backButton} accessibilityLabel="Back">
								<Ionicons name="chevron-back" size={24} color={colors.text} />
							</Pressable>
							<Text style={commonStyles.title}>Settings</Text>
						</View>
						<View style={styles.settings}>
							<View style={styles.email}>
								<View style={styles.emailRow}>
									<Text style={styles.sectionTitle}>Email</Text>
									<Pressable onPress={signOut}>
										<Text style={styles.logOutText}>Log out</Text>
									</Pressable>
								</View>
								<Text style={styles.subtitle}>{user?.email}</Text>
							</View>
							<View style={styles.units} />

							<Text style={styles.sectionTitle}>Units</Text>
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
												settings?.weight_unit === 'kg' && styles.selectedUnit,
											]}>Kilograms (kg)</Text>
										</Pressable>
										<Pressable
											style={styles.unitOption}
											onPress={() => handleUnitSelect('lbs')}
										>
											<Text style={[
												styles.unitOptionText,
												settings?.weight_unit === 'lbs' && styles.selectedUnit,
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

							<Text style={styles.sectionTitle}>Default rest between sets</Text>
							<Text style={styles.helpText}>Used when you don&apos;t specify a rest time on an exercise. Leave empty for none.</Text>
							<TextInput
								style={styles.restInput}
								value={restInput}
								onChangeText={setRestInput}
								onBlur={commitRest}
								onSubmitEditing={commitRest}
								keyboardType="number-pad"
								placeholder="e.g. 120"
								placeholderTextColor="#666"
								returnKeyType="done"
								accessibilityLabel="Default rest seconds"
							/>
						</View>
					</View>
				</ScrollView>
			</Pressable>
			<NavigationBar />
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	flex: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
	},
	settings: {},
	headerRow: {
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	email: {
		flex: 1,
	},
	emailRow: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'space-between',
	},
	logOutText: {
		fontSize: 14,
		color: '#fff',
		textDecorationLine: 'underline',
	},
	units: {
		flex: 1,
	},
	sectionTitle: {
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
	helpText: {
		fontSize: 13,
		color: '#888',
		marginTop: 8,
	},
	restInput: {
		backgroundColor: '#333',
		color: '#fff',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 14,
		marginTop: 12,
		marginBottom: 40,
		fontSize: 16,
	},
});
