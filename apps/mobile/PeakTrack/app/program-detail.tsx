import { useCallback, useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { parseSetInput } from '@evil-empire/parsers';
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
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import { colors } from '../styles/common';
import { Button } from '../components/Button';
import { NavigationBar } from '../components/NavigationBar';
import { LoadScreen } from './components/LoadScreen';
import {
	exerciseNeedsRmSnapshot,
	resolveWeightsFromSnapshot,
} from '@evil-empire/peaktrack-services';

const DAY_LABELS: Record<number, string> = {
	1: 'Mon',
	2: 'Tue',
	3: 'Wed',
	4: 'Thu',
	5: 'Fri',
	6: 'Sat',
	7: 'Sun',
};

const STATUS_LABELS: Record<string, string> = {
	draft: 'Draft',
	active: 'Active',
	archived: 'Archived',
};

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

	/**
	 * Group sessions by week for rendering. Sessions within a week are
	 * sorted by day_of_week. Only weeks that have at least one session
	 * with at least one exercise appear in the list.
	 */
	const weeks = useMemo(() => {
		const exercisesBySession = new Map<string, ProgramExercise[]>();
		for (const ex of exercises) {
			const list = exercisesBySession.get(ex.program_session_id) ?? [];
			list.push(ex);
			exercisesBySession.set(ex.program_session_id, list);
		}

		const byWeek = new Map<number, Array<ProgramSession & { exs: ProgramExercise[] }>>();
		for (const s of sessions) {
			const exs = exercisesBySession.get(s.id) ?? [];
			if (exs.length === 0) {
				continue;
			}
			const list = byWeek.get(s.week_offset) ?? [];
			list.push({ ...s, exs });
			byWeek.set(s.week_offset, list);
		}

		const result: Array<{
			weekOffset: number;
			sessions: Array<ProgramSession & { exs: ProgramExercise[] }>;
		}> = [];
		const keys = Array.from(byWeek.keys()).sort((a, b) => a - b);
		for (const k of keys) {
			const list = (byWeek.get(k) ?? []).slice().sort((a, b) => a.day_of_week - b.day_of_week);
			result.push({ weekOffset: k, sessions: list });
		}
		return result;
	}, [sessions, exercises]);

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

	const uniqueExerciseNames = useMemo(() => {
		const seen = new Set<string>();
		const names: string[] = [];
		for (const ex of exercises) {
			const key = ex.name.trim().toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				names.push(ex.name);
			}
		}
		return names;
	}, [exercises]);

	const handleViewProgression = () => {
		if (!program || uniqueExerciseNames.length === 0) {
			return;
		}
		const navigateTo = (name: string) =>
			router.push({
				pathname: '/program-progression',
				params: { programId: program.id, exerciseName: name },
			});
		if (uniqueExerciseNames.length === 1) {
			const first = uniqueExerciseNames[0];
			if (first) {
				navigateTo(first);
			}
			return;
		}
		Alert.alert('View progression', 'Pick an exercise', [
			...uniqueExerciseNames.map(name => ({
				text: name,
				onPress: () => navigateTo(name),
			})),
			{ text: 'Cancel', style: 'cancel' as const },
		]);
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
		return (
			<View style={styles.flex}>
				<LoadScreen />
				<NavigationBar />
			</View>
		);
	}

	const isActive = program.status === 'active';
	const hasSessions = weeks.length > 0;
	const assignedLabel =
		program.start_iso_year != null && program.start_iso_week != null
			? ` · Week ${program.start_iso_week}, ${program.start_iso_year}`
			: '';

	return (
		<View style={styles.flex}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.container}>
					<View style={styles.headerRow}>
						<Pressable
							onPress={() => router.back()}
							style={styles.backButton}
							accessibilityLabel="Back"
						>
							<Ionicons name="chevron-back" size={24} color={colors.text} />
						</Pressable>
						<Text style={styles.title} numberOfLines={2}>
							{program.name}
						</Text>
					</View>

					<Text style={styles.subtitle}>
						{program.status === 'draft'
							? STATUS_LABELS[program.status]
							: `${program.duration_weeks} week${program.duration_weeks === 1 ? '' : 's'} · ${STATUS_LABELS[program.status] ?? program.status}`}
						{assignedLabel}
					</Text>
					{program.description ? (
						<Text style={styles.description}>{program.description}</Text>
					) : null}

					<View style={styles.topActionsRow}>
						<Pressable
							onPress={() =>
								router.push({ pathname: '/program-edit', params: { programId: program.id } })
							}
							style={styles.editBtn}
							accessibilityRole="button"
							accessibilityLabel="Edit plan"
						>
							<Ionicons name="pencil-outline" size={16} color={colors.primary} />
							<Text style={styles.editBtnText}>Edit plan</Text>
						</Pressable>
						{uniqueExerciseNames.length > 0 ? (
							<Pressable
								onPress={handleViewProgression}
								style={[styles.editBtn, styles.primaryBtn]}
								accessibilityRole="button"
								accessibilityLabel="View progression"
							>
								<Ionicons name="trending-up-outline" size={16} color="#fff" />
								<Text style={[styles.editBtnText, styles.primaryBtnText]}>View progression</Text>
							</Pressable>
						) : null}
					</View>

					{hasSessions ? (
						<View style={styles.planSection}>
							{weeks.map(week => (
								<View key={week.weekOffset} style={styles.weekBlock}>
									<Text style={styles.weekHeading}>Week {week.weekOffset + 1}</Text>
									{week.sessions.map(s => {
										const ex = s.exs[0]; // one exercise per session in the plan-editor flow
										if (!ex) {
											return null;
										}
										const parsed = parseSetInput(ex.raw_input);
										let display = ex.raw_input;
										let showRaw = false;
										if (parsed.isValid && exerciseNeedsRmSnapshot(parsed) && rms.length > 0) {
											try {
												const r = resolveWeightsFromSnapshot(ex.name, parsed, rms);
												const baseSpec = parsed.compoundReps
													? `${parsed.sets} × ${parsed.compoundReps.join('+')}`
													: `${parsed.sets} × ${parsed.reps}`;
												if (r.weightMin !== undefined && r.weightMax !== undefined) {
													display = `${baseSpec} @ ${r.weightMin}–${r.weightMax}kg`;
												} else {
													display = `${baseSpec} @ ${r.weight}kg`;
												}
												showRaw = true;
											} catch {
												display = ex.raw_input;
											}
										}
										return (
											<View key={s.id} style={styles.sessionRow}>
												<Text style={styles.dayLabel}>{DAY_LABELS[s.day_of_week]}</Text>
												<View style={styles.sessionBody}>
													<Text style={styles.sessionSpec}>{display}</Text>
													{showRaw ? (
														<Text style={styles.sessionRaw}>{ex.raw_input}</Text>
													) : null}
												</View>
											</View>
										);
									})}
								</View>
							))}
						</View>
					) : (
						<View style={styles.emptyPlan}>
							<Text style={styles.emptyText}>No plan yet.</Text>
							<Text style={styles.emptyHint}>
								Tap Edit plan to add exercises.
							</Text>
						</View>
					)}

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
			<NavigationBar />
		</View>
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
	topActionsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginTop: 12,
	},
	editBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: colors.primary,
		borderRadius: 6,
	},
	editBtnText: {
		color: colors.primary,
		fontSize: 13,
		fontWeight: '600',
	},
	primaryBtn: {
		backgroundColor: colors.primary,
	},
	primaryBtnText: {
		color: '#fff',
	},
	planSection: {
		marginTop: 20,
	},
	weekBlock: {
		marginBottom: 18,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#1a1a1a',
	},
	weekHeading: {
		color: colors.text,
		fontSize: 15,
		fontWeight: '600',
		marginBottom: 8,
	},
	sessionRow: {
		flexDirection: 'row',
		paddingVertical: 6,
		gap: 12,
	},
	dayLabel: {
		color: colors.primary,
		fontSize: 13,
		fontWeight: '600',
		width: 40,
	},
	sessionBody: {
		flex: 1,
	},
	sessionSpec: {
		color: colors.text,
		fontSize: 14,
	},
	sessionRaw: {
		color: colors.textMuted,
		fontSize: 11,
		marginTop: 2,
	},
	emptyPlan: {
		marginTop: 32,
		alignItems: 'center',
	},
	emptyText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: '600',
	},
	emptyHint: {
		color: colors.textMuted,
		fontSize: 13,
		marginTop: 6,
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
