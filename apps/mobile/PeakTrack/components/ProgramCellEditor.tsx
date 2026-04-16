import { useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Modal,
	Pressable,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseSetInput } from '@evil-empire/parsers';
import { ProgramRepetitionMaximum } from '@evil-empire/types';
import { exerciseNeedsRmSnapshot, findProgramRm } from '../lib/resolveProgramWeights';
import { colors } from '../styles/common';
import { Button } from './Button';

interface ProgramCellEditorProps {
	visible: boolean;
	initial: { name: string; raw_input: string; notes: string } | null;
	programRms: ProgramRepetitionMaximum[];
	programStatus: 'draft' | 'active' | 'archived';
	onCancel: () => void;
	onSave: (input: { name: string; raw_input: string; notes: string }) => void;
}

export function ProgramCellEditor({
	visible,
	initial,
	programRms,
	programStatus,
	onCancel,
	onSave,
}: ProgramCellEditorProps) {
	const [name, setName] = useState(initial?.name ?? '');
	const [rawInput, setRawInput] = useState(initial?.raw_input ?? '');
	const [notes, setNotes] = useState(initial?.notes ?? '');

	const parsed = useMemo(() => parseSetInput(rawInput), [rawInput]);
	const needsSnapshot = exerciseNeedsRmSnapshot(parsed);
	const hasSnapshot = needsSnapshot ? findProgramRm(name, programRms) !== null : true;
	const blockedOnActive =
		programStatus === 'active' && needsSnapshot && !hasSnapshot && name.trim().length > 0;

	const canSave =
		parsed.isValid && name.trim().length > 0 && rawInput.trim().length > 0 && !blockedOnActive;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
			<KeyboardAvoidingView
				style={styles.backdrop}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.sheet}>
					<View style={styles.header}>
						<Text style={styles.title}>
							{initial ? 'Edit exercise' : 'Add exercise'}
						</Text>
						<Pressable onPress={onCancel} hitSlop={8}>
							<Ionicons name="close" size={22} color={colors.text} />
						</Pressable>
					</View>

					<ScrollView keyboardShouldPersistTaps="handled">
						<Text style={styles.label}>Exercise name</Text>
						<TextInput
							style={styles.input}
							value={name}
							onChangeText={setName}
							placeholder="e.g. Back squat"
							placeholderTextColor={colors.textMuted}
							autoFocus={!initial}
						/>

						<Text style={styles.label}>Set spec</Text>
						<TextInput
							style={styles.input}
							value={rawInput}
							onChangeText={setRawInput}
							placeholder='e.g. 6 x 2 @80%'
							placeholderTextColor={colors.textMuted}
							autoCapitalize="none"
						/>
						{!parsed.isValid && rawInput.length > 0 && (
							<Text style={styles.errorText}>
								{parsed.errorMessage ?? 'Unrecognized format'}
							</Text>
						)}
						{parsed.isValid && needsSnapshot && !hasSnapshot && (
							<Text style={styles.hintText}>
								{programStatus === 'active'
									? 'No 1RM snapshot yet for this name. Save the program in draft, or resolve via Assign.'
									: 'This spec needs a 1RM — it will be resolved at assignment.'}
							</Text>
						)}

						<Text style={styles.label}>Notes (optional)</Text>
						<TextInput
							style={[styles.input, styles.multiline]}
							value={notes}
							onChangeText={setNotes}
							placeholder="Free-form notes…"
							placeholderTextColor={colors.textMuted}
							multiline
							numberOfLines={3}
						/>

						<View style={styles.actions}>
							<Button
								title="Save"
								onPress={() =>
									onSave({
										name: name.trim(),
										raw_input: rawInput.trim(),
										notes: notes.trim(),
									})
								}
								disabled={!canSave}
							/>
							<Button title="Cancel" variant="secondary" onPress={onCancel} />
						</View>
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.6)',
		justifyContent: 'flex-end',
	},
	sheet: {
		backgroundColor: colors.background,
		padding: 20,
		borderTopLeftRadius: 12,
		borderTopRightRadius: 12,
		maxHeight: '90%',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	title: {
		color: colors.text,
		fontSize: 18,
		fontWeight: '600',
	},
	label: {
		color: colors.text,
		fontSize: 13,
		fontWeight: '500',
		marginBottom: 4,
	},
	input: {
		backgroundColor: colors.backgroundInput,
		color: colors.text,
		padding: 12,
		borderRadius: 6,
		fontSize: 15,
		marginBottom: 12,
	},
	multiline: {
		minHeight: 70,
		textAlignVertical: 'top',
	},
	errorText: {
		color: colors.error,
		fontSize: 12,
		marginTop: -6,
		marginBottom: 12,
	},
	hintText: {
		color: colors.primary,
		fontSize: 12,
		marginTop: -6,
		marginBottom: 12,
	},
	actions: {
		marginTop: 12,
		gap: 10,
	},
});
