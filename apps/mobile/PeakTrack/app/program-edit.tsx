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
} from '@evil-empire/types';
import {
	fetchProgramById,
	fetchProgramSessionsByProgramId,
	fetchProgramExercisesBySessionIds,
	updateProgram,
	deleteAllProgramSessions,
	deleteProgramSession,
	upsertProgramSession,
	upsertProgramExercise,
} from '@evil-empire/peaktrack-services';
import { colors } from '../styles/common';
import { LoadScreen } from './components/LoadScreen';
import { ProgramPlanEditor } from '../components/ProgramPlanEditor';
import {
	parseProgramText,
	serializeProgramText,
	defaultDayForSession,
} from '../lib/parseProgramText';

export default function ProgramEdit() {
	const { user } = useAuth();
	const params = useLocalSearchParams<{ programId: string }>();
	const programId = typeof params.programId === 'string' ? params.programId : null;
	const { reloadPrograms, invalidateSessionCache } = usePrograms();

	const [program, setProgram] = useState<Program | null>(null);
	const [sessions, setSessions] = useState<ProgramSession[]>([]);
	const [exercises, setExercises] = useState<ProgramExercise[]>([]);
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

		setLoading(false);
	}, [programId, user]);

	useFocusEffect(
		useCallback(() => {
			loadAll();
		}, [loadAll]),
	);

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
			const { error: delErr } = await deleteAllProgramSessions(programId);
			if (delErr) {
				setSaving(false);
				Alert.alert('Could not save plan', delErr);
				return;
			}

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
						await deleteProgramSession(createdSession.id);
						setSaving(false);
						Alert.alert('Could not save plan', eErr);
						return;
					}
				}
			}

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
			setSaving(false);
			router.back();
		};

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

	if (loading || !program) {
		return <LoadScreen />;
	}

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
							Edit plan
						</Text>
					</View>
					<Text style={styles.subtitle} numberOfLines={1}>
						{program.name}
					</Text>

					<ProgramPlanEditor
						key={initialPlanText}
						initialText={initialPlanText}
						isSaving={saving}
						onSave={handleSavePlan}
					/>
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
		marginBottom: 4,
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
		color: colors.textMuted,
		fontSize: 13,
		marginBottom: 12,
	},
});
