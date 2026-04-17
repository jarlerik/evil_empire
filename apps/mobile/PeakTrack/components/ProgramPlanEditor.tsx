import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/common';
import { Button } from './Button';
import { parseProgramText } from '../lib/parseProgramText';

interface ProgramPlanEditorProps {
	initialText: string;
	isSaving: boolean;
	onSave: (text: string) => void;
}

export function ProgramPlanEditor({
	initialText,
	isSaving,
	onSave,
}: ProgramPlanEditorProps) {
	const [text, setText] = useState(initialText);

	const parsed = useMemo(() => parseProgramText(text), [text]);

	const summary = parsed.weeks.length === 0
		? null
		: `${parsed.weeks.length} week${parsed.weeks.length === 1 ? '' : 's'}${
				parsed.sessionsPerWeek ? ` · ${parsed.sessionsPerWeek}/week` : ''
		  }`;

	const canSave = parsed.errors.length === 0 && parsed.weeks.length > 0 && !isSaving;

	return (
		<View style={styles.container}>
			<View style={styles.labelRow}>
				<Text style={styles.label}>Plan</Text>
				<Pressable
					onPress={() => router.push('/exercise-input-help')}
					hitSlop={8}
					style={styles.helpLink}
					accessibilityRole="link"
					accessibilityLabel="See syntax examples"
				>
					<Ionicons name="help-circle-outline" size={14} color={colors.primary} />
					<Text style={styles.helpLinkText}>Syntax help</Text>
				</Pressable>
			</View>
			<Text style={styles.hint}>
				{'Each line is a session, e.g. "6 x 2@80%" (sets × reps @weight).\nBlank line separates weeks. First line may be "## N x week".'}
			</Text>

			<TextInput
				style={styles.editor}
				value={text}
				onChangeText={setText}
				multiline
				autoCapitalize="none"
				autoCorrect={false}
				placeholder={'## 2 x week\n6 x 2@80%\n6 x 3@80%\n\n6 x 2@80%\n6 x 4@80%'}
				placeholderTextColor={colors.textMuted}
				textAlignVertical="top"
				spellCheck={false}
			/>

			{summary ? <Text style={styles.summary}>{summary}</Text> : null}

			{parsed.errors.length > 0 && (
				<View style={styles.issues}>
					{parsed.errors.map((e, i) => (
						<Text key={i} style={styles.errorLine}>
							• {e}
						</Text>
					))}
				</View>
			)}

			{parsed.warnings.length > 0 && (
				<View style={styles.issues}>
					{parsed.warnings.map((w, i) => (
						<Text key={i} style={styles.warningLine}>
							• {w}
						</Text>
					))}
				</View>
			)}

			<Button
				title={isSaving ? 'Saving…' : 'Save plan'}
				onPress={() => onSave(text)}
				disabled={!canSave}
				style={styles.saveBtn}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginTop: 12,
	},
	labelRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	label: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '600',
	},
	helpLink: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		paddingVertical: 4,
		paddingHorizontal: 6,
	},
	helpLinkText: {
		color: colors.primary,
		fontSize: 12,
	},
	hint: {
		color: colors.textMuted,
		fontSize: 12,
		marginBottom: 10,
		lineHeight: 16,
	},
	editor: {
		backgroundColor: colors.backgroundInput,
		color: colors.text,
		padding: 12,
		borderRadius: 6,
		fontSize: 14,
		minHeight: 260,
		fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
	},
	summary: {
		color: colors.primary,
		fontSize: 12,
		marginTop: 8,
	},
	issues: {
		marginTop: 10,
	},
	errorLine: {
		color: colors.error,
		fontSize: 12,
		marginBottom: 4,
	},
	warningLine: {
		color: '#eab308',
		fontSize: 12,
		marginBottom: 4,
	},
	saveBtn: {
		marginTop: 16,
	},
});
