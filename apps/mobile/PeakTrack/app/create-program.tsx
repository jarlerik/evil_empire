import { useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import { createProgram } from '@evil-empire/peaktrack-services';
import { commonStyles, colors } from '../styles/common';
import { Button } from '../components/Button';

export default function CreateProgram() {
	const { user } = useAuth();
	const { reloadPrograms } = usePrograms();
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [durationWeeks, setDurationWeeks] = useState('4');
	const [isSaving, setIsSaving] = useState(false);
	const [errorState, setErrorState] = useState<string | null>(null);

	const handleSave = async () => {
		if (!user) {
			return;
		}
		const trimmedName = name.trim();
		if (trimmedName.length === 0) {
			setErrorState('Please enter a name.');
			return;
		}
		const weeks = parseInt(durationWeeks, 10);
		if (!Number.isFinite(weeks) || weeks <= 0 || weeks > 52) {
			setErrorState('Duration must be between 1 and 52 weeks.');
			return;
		}

		setIsSaving(true);
		setErrorState(null);

		const { data, error } = await createProgram({
			user_id: user.id,
			name: trimmedName,
			description: description.trim() || null,
			duration_weeks: weeks,
		});

		if (error || !data) {
			setErrorState(error ?? 'Failed to create program');
			setIsSaving(false);
			return;
		}

		await reloadPrograms();
		setIsSaving(false);
		router.replace({ pathname: '/program-detail', params: { programId: data.id } });
	};

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Pressable onPress={() => router.back()} style={commonStyles.backButton}>
							<Ionicons name="chevron-back" size={24} color={colors.text} />
						</Pressable>
						<Text style={commonStyles.title}>New program</Text>
					</View>

					<Text style={styles.label}>Name</Text>
					<TextInput
						style={commonStyles.input}
						value={name}
						onChangeText={setName}
						placeholder="e.g. Russian squat program"
						placeholderTextColor={colors.textMuted}
						returnKeyType="next"
						autoFocus
					/>

					<Text style={styles.label}>Duration (weeks)</Text>
					<TextInput
						style={commonStyles.input}
						value={durationWeeks}
						onChangeText={text => setDurationWeeks(text.replace(/[^0-9]/g, ''))}
						keyboardType="number-pad"
						maxLength={2}
					/>

					<Text style={styles.label}>Description (optional)</Text>
					<TextInput
						style={[commonStyles.input, styles.multiline]}
						value={description}
						onChangeText={setDescription}
						placeholder="Notes about the program…"
						placeholderTextColor={colors.textMuted}
						multiline
						numberOfLines={4}
					/>

					{errorState ? <Text style={styles.error}>{errorState}</Text> : null}

					<Button
						title={isSaving ? 'Saving…' : 'Create program'}
						onPress={handleSave}
						disabled={isSaving}
					/>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	scrollContent: { flexGrow: 1 },
	headerRow: {
		justifyContent: 'flex-start',
		alignItems: 'center',
		gap: 8,
	},
	label: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '600',
		marginBottom: 6,
	},
	multiline: {
		minHeight: 100,
		textAlignVertical: 'top',
	},
	error: {
		color: colors.error,
		marginBottom: 12,
	},
});
