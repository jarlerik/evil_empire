import { useCallback, useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	Alert,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import {
	Program,
	ProgramSession,
	ProgramExercise,
	ProgramRepetitionMaximum,
} from '@evil-empire/types';
import {
	fetchProgramById,
	fetchProgramSessionsByProgramId,
	fetchProgramExercisesBySessionIds,
	fetchProgramRmsByProgramId,
	deleteProgram,
	updateProgram,
	deleteAllProgramSessions,
	deleteProgramSession,
	upsertProgramSession,
	upsertProgramExercise,
} from '@evil-empire/peaktrack-services';
import { colors } from '../styles/common';
import { Button } from '../components/Button';
import { LoadScreen } from './components/LoadScreen';
import { ProgramPlanEditor } from '../components/ProgramPlanEditor';
import {
	parseProgramText,
	serializeProgramText,
	defaultDayForSession,
} from '../lib/parseProgramText';

export default function ProgramDetail() {
	const { user } = useAuth();
	const params = useLocalSearchParams<{ programId: string }>();
	const programId = typeof params.programId === 'string' ? params.programId : null;
	const { reloadPrograms, invalidateSessionCache } = usePrograms();

	const [program, setProgram] = useState<Program | null>(null);
	const [sessions, setSessions] = useState<ProgramSession[]>([]);
	const [exercises, setExercises] = useState<ProgramExercise[]>([]);
	const [rms, setRms] = useState<ProgramRepetitionMaximum[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const loadAll = useCallback(async () => {
		if (!programId || !user) {
			return;
		}
		setLoading(true);
		const { data: prog } = await fetchProgramById(programId);
		if (prog) {
			setProgram(prog);
		}
		const { data: sess } = await fetchProgramSessionsByProgramId(programId);
		const sessList = sess ?? [];
		setSessions(sessList);

		if (sessList.length > 0) {
			const { data: exs } = await fetchProgramExercisesBySessionIds(
				sessList.map(s => s.id),
			);
			setExercises(exs ?? []);
		} else {
			setExercises([]);
		}

		const { data: rmData } = await fetchProgramRmsByProgramId(programId);
		setRms(rmData ?? []);

		setLoading(false);
	}, [programId, user]);

	useFocusEffect(
		useCallback(() => {
			loadAll();
		}, [loadAll]),
	);

	// Build the text representation of the saved plan for the editor's initial value.
	const initialPlanText = useMemo(() => {
		if (!program || sessions.length === 0) {
			return '';
		}
		const exercisesBySession = new Map<string, ProgramExercise[]>();
		for (const ex of exercises) {
			const list = exercisesBySession.get(ex.program_session_id) ?? [];
			list.push(ex);
			exercisesBySession.set(ex.program_session_id, list);
		}
		const input = sessions.map(s => ({
			week_offset: s.week_offset,
			day_of_week: s.day_of_week,
			exercises: (exercisesBySession.get(s.id) ?? []).map(e => ({
				name: e.name,
				raw_input: e.raw_input,
			})),
		}));
		return serializeProgramText(input, program.name);
	}, [program, sessions, exercises]);

	const handleSavePlan = async (text: string) => {
		if (!programId || !program) {
			return;
		}
		const parsed = parseProgramText(text);
		if (parsed.errors.length > 0 || parsed.weeks.length === 0) {
			Alert.alert(
				'Could not save plan',
				parsed.errors[0] ?? 'Please enter at least one week.',
			);
			return;
		}

		const sessionsPerWeek = parsed.sessionsPerWeek ?? 1;

		const confirmAndSave = async () => {
			setSaving(true);
			// Wipe existing sessions — cascades to exercises. workouts.program_session_id
			// is SET NULL so history stays.
			const { error: delErr } = await deleteAllProgramSessions(programId);
			if (delErr) {
				setSaving(false);
				Alert.alert('Could not save plan', delErr);
				return;
			}

			// Re-create sessions + exercises.
			for (const week of parsed.weeks) {
				const weekOffset = week.weekNumber - 1;
				for (let i = 0; i < week.sessions.length; i++) {
					const sess = week.sessions[i];
					const dayOfWeek = defaultDayForSession(i, sessionsPerWeek);
					const { data: createdSession, error: sErr } = await upsertProgramSession({
						program_id: programId,
						week_offset: weekOffset,
						day_of_week: dayOfWeek,
					});
					if (sErr || !createdSession) {
						setSaving(false);
						Alert.alert('Could not save plan', sErr ?? 'Failed to create session');
						return;
					}
					const exerciseName = sess.name ?? program.name;
					const { error: eErr } = await upsertProgramExercise({
						program_session_id: createdSession.id,
						order_index: 0,
						name: exerciseName,
						raw_input: sess.rawInput,
						notes: null,
					});
					if (eErr) {
						// Roll back the just-created session so we don't leave
						// an orphan row that would render as phantom content
						// on next load.
						await deleteProgramSession(createdSession.id);
						setSaving(false);
						Alert.alert('Could not save plan', eErr);
						return;
					}
				}
			}

			// Update duration_weeks to match the plan.
			const { error: updErr } = await updateProgram(programId, {
				duration_weeks: parsed.weeks.length,
			});
			if (updErr) {
				setSaving(false);
				Alert.alert('Could not save plan', updErr);
				return;
			}

			invalidateSessionCache();
			await reloadPrograms();
			await loadAll();
			setSaving(false);
		};

		// Warn on active programs since a rewrite shifts future virtual cards.
		if (program.status === 'active') {
			Alert.alert(
				'Rewrite active program?',
				'Past workouts stay intact. Future virtual sessions will shift to the new plan.',
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Rewrite', style: 'destructive', onPress: () => void confirmAndSave() },
				],
			);
			return;
		}
		await confirmAndSave();
	};

	const handleDelete = () => {
		if (!programId || !program) {
			return;
		}
		Alert.alert(
			'Delete program',
			`Delete "${program.name}"? Your workout history from this program will be preserved.`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						const { error } = await deleteProgram(programId);
						if (!error) {
							invalidateSessionCache();
							await reloadPrograms();
							router.back();
						} else {
							Alert.alert('Error', error);
						}
					},
				},
			],
		);
	};

	const handleArchive = async () => {
		if (!programId || !program) {
			return;
		}
		const next = program.status === 'archived' ? 'draft' : 'archived';
		const patch: Parameters<typeof updateProgram>[1] =
			next === 'draft'
				? { status: next, start_iso_year: null, start_iso_week: null }
				: { status: next };
		const { error } = await updateProgram(programId, patch);
		if (!error) {
			invalidateSessionCache();
			await reloadPrograms();
			await loadAll();
		}
	};

	if (loading || !program) {
		return <LoadScreen />;
	}

	const isActive = program.status === 'active';
	const hasSessions = sessions.length > 0;

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
				<View style={styles.container}>
					<View style={styles.headerRow}>
						<Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back">
							<Ionicons name="chevron-back" size={24} color={colors.text} />
						</Pressable>
						<Text style={styles.title} numberOfLines={2}>
							{program.name}
						</Text>
					</View>

					<Text style={styles.subtitle}>
						{program.duration_weeks} week{program.duration_weeks === 1 ? '' : 's'} ·{' '}
						{program.status}
						{program.start_iso_year != null && program.start_iso_week != null
							? ` · starts week ${program.start_iso_week}, ${program.start_iso_year}`
							: ''}
					</Text>
					{program.description ? (
						<Text style={styles.description}>{program.description}</Text>
					) : null}

					<ProgramPlanEditor
						key={initialPlanText} // reset state when loaded plan changes
						initialText={initialPlanText}
						isSaving={saving}
						onSave={handleSavePlan}
					/>

					{rms.length > 0 ? (
						<View style={styles.rmsSection}>
							<Text style={styles.sectionTitle}>Program 1RMs</Text>
							{rms.map(rm => (
								<View key={rm.id} style={styles.rmRow}>
									<Text style={styles.rmName}>{rm.exercise_name}</Text>
									<Text style={styles.rmWeight}>{rm.weight} kg</Text>
								</View>
							))}
						</View>
					) : null}

					<View style={styles.actions}>
						{!isActive && hasSessions && (
							<Button
								title="Assign start week"
								onPress={() =>
									router.push({
										pathname: '/program-assign',
										params: { programId: program.id },
									})
								}
							/>
						)}
						{isActive && (
							<Button
								title="Re-assign start week"
								variant="secondary"
								onPress={() =>
									router.push({
										pathname: '/program-assign',
										params: { programId: program.id, reassign: '1' },
									})
								}
							/>
						)}
						<Button
							title={program.status === 'archived' ? 'Unarchive' : 'Archive'}
							variant="secondary"
							onPress={handleArchive}
							style={styles.topSpace}
						/>
						<Pressable onPress={handleDelete} style={styles.deleteBtn}>
							<Ionicons name="trash-outline" size={16} color={colors.error} />
							<Text style={styles.deleteBtnText}>Delete program</Text>
						</Pressable>
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	scrollContent: { flexGrow: 1 },
	container: {
		flex: 1,
		backgroundColor: colors.background,
		padding: 20,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 12,
		marginBottom: 12,
	},
	backButton: {
		marginRight: 4,
	},
	title: {
		flex: 1,
		color: colors.primary,
		fontSize: 20,
		fontWeight: '700',
	},
	subtitle: {
		color: colors.primary,
		fontSize: 13,
		marginBottom: 4,
	},
	description: {
		color: colors.textMuted,
		fontSize: 13,
		marginBottom: 8,
	},
	rmsSection: {
		marginTop: 24,
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: '#222',
	},
	sectionTitle: {
		color: colors.text,
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 12,
	},
	rmRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#222',
	},
	rmName: { color: colors.text },
	rmWeight: { color: colors.primary, fontWeight: '600' },
	actions: {
		marginTop: 32,
		gap: 12,
	},
	topSpace: { marginTop: 4 },
	deleteBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		padding: 12,
		marginTop: 8,
	},
	deleteBtnText: {
		color: colors.error,
		fontSize: 14,
	},
});
