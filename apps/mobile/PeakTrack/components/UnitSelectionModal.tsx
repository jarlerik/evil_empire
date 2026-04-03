import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../styles/common';

export function UnitSelectionModal() {
	const { settings, updateSettings } = useUserSettings();
	const { user } = useAuth();

	const visible = !!user && settings !== null && settings.weight_unit === null;

	const handleSelect = async (unit: 'kg' | 'lbs') => {
		await updateSettings({ weight_unit: unit });
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
		>
			<View style={styles.overlay}>
				<View style={styles.content}>
					<Text style={styles.title}>Choose your weight unit</Text>
					<Text style={styles.subtitle}>
						This will be used throughout the app for all exercises.
					</Text>

					<Pressable
						style={styles.option}
						onPress={() => handleSelect('kg')}
					>
						<Text style={styles.optionTitle}>Kilograms (kg)</Text>
					</Pressable>

					<Pressable
						style={styles.option}
						onPress={() => handleSelect('lbs')}
					>
						<Text style={styles.optionTitle}>Pounds (lbs)</Text>
					</Pressable>

					<Text style={styles.hint}>You can change this later in Settings.</Text>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.85)',
	},
	content: {
		backgroundColor: '#1a1a1a',
		borderRadius: 16,
		padding: 28,
		width: '85%',
		maxWidth: 360,
		alignItems: 'center',
	},
	title: {
		fontSize: 22,
		fontWeight: 'bold',
		color: colors.text,
		marginBottom: 8,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 14,
		color: colors.textMuted,
		marginBottom: 24,
		textAlign: 'center',
		lineHeight: 20,
	},
	option: {
		width: '100%',
		backgroundColor: '#262626',
		borderRadius: 10,
		paddingVertical: 16,
		paddingHorizontal: 20,
		marginBottom: 12,
		alignItems: 'center',
	},
	optionTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: colors.text,
	},
	hint: {
		fontSize: 12,
		color: colors.textMuted,
		marginTop: 8,
	},
});
