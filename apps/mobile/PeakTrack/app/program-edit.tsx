import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { DayPicker, DayOfWeek } from '@evil-empire/ui';
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

const DAY_SHORT: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
	/**
	 * Days the user wants each week's sessions to land on. Order of this
	 * array matches session index within a week (first selected → session 1,
	 * second → session 2, etc.). Seeded from existing sessions on load.
	 */
	const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
	const [daysTouched, setDaysTouched] = useState(false);

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

	// Seed the day picker from the saved sessions' distinct day-of-week values.
	// Only runs once per load so the user's in-progress selection isn't clobbered
	// by subsequent reloads (e.g. focus-refresh).
	useEffect(() => {
		if (daysTouched || sessions.length === 0) {
			return;
		}
		const seen = new Set<number>();
		for (const s of sessions) {
			seen.add(s.day_of_week);
		}
		const asArray = Array.from(seen).sort((a, b) => a - b) as DayOfWeek[];
		if (asArray.length > 0) {
			setSelectedDays(asArray);
		}
	}, [sessions, daysTouched]);

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

		// If the user picked specific days, warn them when their selection
		// doesn't cover every session (e.g. picked 2 days for a 3-per-week
		// plan). Extras fall back to the default split for that index.
		if (selectedDays.length > 0 && selectedDays.length < sessionsPerWeek) {
			const cont = await new Promise<boolean>(resolve => {
				Alert.alert(
					'Not enough days selected',
					`You picked ${selectedDays.length} day${selectedDays.length === 1 ? '' : 's'} but the plan has ${sessionsPerWeek} sessions per week. Extra sessions will use default days.`,
					[
						{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
						{ text: 'Continue', onPress: () => resolve(true) },
					],
				);
			});
			if (!cont) {
				return;
			}
		}

		const resolveDay = (sessionIndex: number): number => {
			if (sessionIndex < selectedDays.length) {
				return selectedDays[sessionIndex];
			}
			return defaultDayForSession(sessionIndex, sessionsPerWeek);
		};

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
					const dayOfWeek = resolveDay(i);
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

					<View style={styles.daysSection}>
						<DayPicker
							label="Session days"
							value={selectedDays}
							onChange={next => {
								setSelectedDays(next);
								setDaysTouched(true);
							}}
						/>
						<Text style={styles.daysHint}>
							{selectedDays.length === 0
								? 'Pick which days sessions land on. If left empty, a default split is used (2 → Mon/Thu, 3 → Mon/Wed/Fri, …).'
								: `Session order matches the order of picks: first session → ${DAY_SHORT[selectedDays[0] - 1]}${selectedDays.length > 1 ? `, second → ${DAY_SHORT[selectedDays[1] - 1]}` : ''}${selectedDays.length > 2 ? ', …' : ''}.`}
						</Text>
					</View>

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
	daysSection: {
		marginTop: 8,
		marginBottom: 16,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#1a1a1a',
	},
	daysHint: {
		color: colors.textMuted,
		fontSize: 12,
		marginTop: 8,
		lineHeight: 16,
	},
});
