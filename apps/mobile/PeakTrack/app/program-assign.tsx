import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	Alert,
	TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, getISOWeek, getISOWeekYear, setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns';
import { parseSetInput } from '@evil-empire/parsers';
import { Program, ProgramRepetitionMaximum } from '@evil-empire/types';
import {
	fetchProgramById,
	fetchProgramSessionsByProgramId,
	fetchProgramExercisesBySessionIds,
	fetchProgramRmsByProgramId,
	assignProgramStart,
	upsertProgramRm,
	createRepetitionMaximum,
	lookupExactRm,
	fetchAllRmsByReps,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import { commonStyles, colors } from '../styles/common';
import { Button } from '../components/Button';
import { LoadScreen } from './components/LoadScreen';
import { exerciseNeedsRmSnapshot, findProgramRm } from '../lib/resolveProgramWeights';

interface NameEntry {
	name: string;
	weight: string;
	source: 'lookup' | 'partial_match' | 'manual' | null;
	testedAt: string | null;
	suggestions: Array<{ exerciseName: string; weight: number }>;
	resolved: boolean;
}

export default function ProgramAssign() {
	const { user } = useAuth();
	const params = useLocalSearchParams<{ programId: string; reassign?: string }>();
	const programId = typeof params.programId === 'string' ? params.programId : null;
	const isReassign = params.reassign === '1';
	const { reloadPrograms, invalidateSessionCache } = usePrograms();

	const [program, setProgram] = useState<Program | null>(null);
	const [names, setNames] = useState<NameEntry[]>([]);
	const [existingRms, setExistingRms] = useState<ProgramRepetitionMaximum[]>([]);
	const [step, setStep] = useState<1 | 2>(1);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// Start week defaults to current ISO week
	const [startYear, setStartYear] = useState<number>(() => getISOWeekYear(new Date()));
	const [startWeek, setStartWeek] = useState<number>(() => getISOWeek(new Date()));

	const loadAll = useCallback(async () => {
		if (!programId || !user) {
			return;
		}
		setLoading(true);
		const { data: prog } = await fetchProgramById(programId);
		if (prog) {
			setProgram(prog);
			if (prog.start_iso_year != null) {
				setStartYear(prog.start_iso_year);
			}
			if (prog.start_iso_week != null) {
				setStartWeek(prog.start_iso_week);
			}
		}
		const { data: sessions } = await fetchProgramSessionsByProgramId(programId);
		const sessList = sessions ?? [];
		const { data: exercises } =
			sessList.length > 0
				? await fetchProgramExercisesBySessionIds(sessList.map(s => s.id))
				: { data: [] };
		const { data: rms } = await fetchProgramRmsByProgramId(programId);
		setExistingRms(rms ?? []);

		// Collect unique names requiring a snapshot
		const seen = new Map<string, string>(); // lower→original
		for (const ex of exercises ?? []) {
			const parsed = parseSetInput(ex.raw_input);
			if (!exerciseNeedsRmSnapshot(parsed)) {
				continue;
			}
			const key = ex.name.trim().toLowerCase();
			if (!seen.has(key)) {
				seen.set(key, ex.name.trim());
			}
		}

		const entries: NameEntry[] = [];
		for (const original of seen.values()) {
			const existing = findProgramRm(original, rms ?? []);
			if (existing) {
				entries.push({
					name: original,
					weight: String(existing.weight),
					source: existing.source,
					testedAt: existing.tested_at,
					suggestions: [],
					resolved: true,
				});
			} else {
				// Fire lookup in the background and update entries as results come in
				entries.push({
					name: original,
					weight: '',
					source: null,
					testedAt: null,
					suggestions: [],
					resolved: false,
				});
			}
		}
		setNames(entries);
		setLoading(false);

		// Resolve lookups for unresolved entries.
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].resolved) {
				continue;
			}
			const name = entries[i].name;
			const { data: exact } = await lookupExactRm(user.id, name, 1);
			if (exact?.weight) {
				setNames(prev => {
					const next = [...prev];
					next[i] = { ...next[i], weight: String(exact.weight), source: 'lookup' };
					return next;
				});
				continue;
			}
			const { data: partials } = await fetchAllRmsByReps(user.id, 1);
			if (partials && partials.length > 0) {
				const lower = name.toLowerCase();
				const matches = partials
					.filter(
						p =>
							p.exercise_name.toLowerCase().includes(lower) ||
							lower.includes(p.exercise_name.toLowerCase()),
					)
					.map(p => ({ exerciseName: p.exercise_name, weight: p.weight }));
				if (matches.length > 0) {
					setNames(prev => {
						const next = [...prev];
						next[i] = { ...next[i], suggestions: matches };
						return next;
					});
				}
			}
		}
	}, [programId, user]);

	useEffect(() => {
		loadAll();
	}, [loadAll]);

	const endWeekLabel = useMemo(() => {
		if (!program) {
			return '';
		}
		const anchor = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), startYear), startWeek));
		const endDate = addDays(anchor, program.duration_weeks * 7 - 1);
		return `Week ${getISOWeek(endDate)}, ${getISOWeekYear(endDate)} (${format(endDate, 'MMM d')})`;
	}, [program, startYear, startWeek]);

	const startWeekDateRange = useMemo(() => {
		const anchor = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), startYear), startWeek));
		const end = addDays(anchor, 6);
		return `${format(anchor, 'MMM d')} – ${format(end, 'MMM d')}`;
	}, [startYear, startWeek]);

	const moveWeek = (delta: number) => {
		// Compute new date then re-derive iso year/week
		const anchor = startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), startYear), startWeek));
		const next = addDays(anchor, delta * 7);
		setStartYear(getISOWeekYear(next));
		setStartWeek(getISOWeek(next));
	};

	const updateName = (idx: number, patch: Partial<NameEntry>) => {
		setNames(prev => {
			const next = [...prev];
			next[idx] = { ...next[idx], ...patch };
			return next;
		});
	};

	const acceptSuggestion = (idx: number, weight: number) => {
		updateName(idx, {
			weight: String(weight),
			source: 'partial_match',
			suggestions: [],
		});
	};

	const enterManualFor = (idx: number) => {
		Alert.prompt(
			'Enter 1RM',
			`Enter 1RM weight for "${names[idx].name}" (kg)`,
			text => {
				const w = parseFloat(text ?? '');
				if (Number.isFinite(w) && w > 0) {
					updateName(idx, {
						weight: String(w),
						source: 'manual',
					});
				}
			},
			'plain-text',
			names[idx].weight,
			'numeric',
		);
	};

	const allResolved = names.every(n => {
		const w = parseFloat(n.weight);
		return Number.isFinite(w) && w > 0;
	});

	const handleConfirmWeek = () => {
		if (isReassign) {
			Alert.alert(
				'Re-assign start week',
				'Future virtual sessions will shift to the new start week. Workouts you have already started stay on the dates you did them. Your 1RM snapshot is preserved.',
				[
					{ text: 'Cancel', style: 'cancel' },
					{ text: 'Continue', onPress: () => doReassign() },
				],
			);
		} else {
			setStep(2);
		}
	};

	const doReassign = async () => {
		if (!programId) {
			return;
		}
		setSaving(true);
		const { error } = await assignProgramStart(programId, startYear, startWeek);
		setSaving(false);
		if (error) {
			Alert.alert('Could not re-assign', error);
			return;
		}
		invalidateSessionCache();
		await reloadPrograms();
		router.back();
	};

	const handleStartProgram = async () => {
		if (!programId || !user) {
			return;
		}
		if (!allResolved) {
			Alert.alert('Missing 1RMs', 'Please resolve every 1RM before starting.');
			return;
		}
		setSaving(true);

		// Write snapshots
		for (const entry of names) {
			const w = parseFloat(entry.weight);
			if (!Number.isFinite(w) || w <= 0) {
				continue;
			}
			const source = entry.source ?? 'manual';
			await upsertProgramRm({
				program_id: programId,
				exercise_name: entry.name,
				weight: w,
				source,
				tested_at: entry.testedAt,
			});
			// Manual entries also go to the user's global RMs
			if (source === 'manual') {
				await createRepetitionMaximum({
					userId: user.id,
					exerciseName: entry.name,
					reps: 1,
					weight: w,
					date: format(new Date(), 'yyyy-MM-dd'),
				});
			}
		}

		// Transition to active
		const { error: assignError } = await assignProgramStart(programId, startYear, startWeek);
		setSaving(false);
		if (assignError) {
			Alert.alert('Could not start program', assignError);
			return;
		}
		invalidateSessionCache();
		await reloadPrograms();
		router.back();
	};

	if (loading || !program) {
		return <LoadScreen />;
	}

	return (
		<View style={styles.flex}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Pressable
							onPress={() => (step === 2 ? setStep(1) : router.back())}
							style={commonStyles.backButton}
						>
							<Ionicons name="chevron-back" size={24} color={colors.text} />
						</Pressable>
						<Text style={commonStyles.titleFlex} numberOfLines={1}>
							{isReassign ? 'Re-assign' : 'Assign'} {program.name}
						</Text>
					</View>

					{step === 1 && (
						<View>
							<Text style={styles.sectionLabel}>Pick a start week</Text>
							<View style={styles.weekNav}>
								<Pressable onPress={() => moveWeek(-1)} style={styles.navBtn}>
									<Ionicons name="chevron-back" size={24} color={colors.text} />
								</Pressable>
								<View style={styles.weekInfo}>
									<Text style={styles.weekNum}>
										Week {startWeek}, {startYear}
									</Text>
									<Text style={styles.weekRange}>{startWeekDateRange}</Text>
								</View>
								<Pressable onPress={() => moveWeek(1)} style={styles.navBtn}>
									<Ionicons name="chevron-forward" size={24} color={colors.text} />
								</Pressable>
							</View>

							<Text style={styles.info}>
								{program.duration_weeks} week{program.duration_weeks === 1 ? '' : 's'}
								{' · ends '}
								{endWeekLabel}
							</Text>

							<Button
								title={isReassign ? 'Re-assign' : 'Next: set 1RMs'}
								onPress={handleConfirmWeek}
								disabled={saving}
							/>
						</View>
					)}

					{step === 2 && (
						<View>
							<Text style={styles.sectionLabel}>Set your 1RMs</Text>
							{names.length === 0 ? (
								<Text style={styles.info}>No percentage-based exercises found.</Text>
							) : (
								names.map((entry, idx) => {
									const w = parseFloat(entry.weight);
									const valid = Number.isFinite(w) && w > 0;
									return (
										<View key={entry.name} style={styles.rmRow}>
											<Text style={styles.rmName}>{entry.name}</Text>
											<View style={styles.rmWeightRow}>
												<TextInput
													style={styles.rmWeightInput}
													value={entry.weight}
													onChangeText={text =>
														updateName(idx, {
															weight: text.replace(/[^0-9.]/g, ''),
															source: entry.source ?? 'manual',
														})
													}
													keyboardType="decimal-pad"
													placeholder="kg"
													placeholderTextColor={colors.textMuted}
												/>
												<Text style={styles.rmUnit}>kg</Text>
												{valid ? (
													<Ionicons name="checkmark-circle" size={20} color={colors.primary} />
												) : null}
											</View>
											{entry.source === 'lookup' ? (
												<Text style={styles.rmMeta}>Found in your RMs</Text>
											) : null}
											{entry.suggestions.length > 0 && !valid ? (
												<View style={styles.suggestions}>
													<Text style={styles.suggestionsLabel}>Similar RMs:</Text>
													{entry.suggestions.map(s => (
														<Pressable
															key={s.exerciseName}
															onPress={() => acceptSuggestion(idx, s.weight)}
															style={styles.suggestionChip}
														>
															<Text style={styles.suggestionText}>
																{s.exerciseName}: {s.weight}kg
															</Text>
														</Pressable>
													))}
												</View>
											) : null}
											{!valid && entry.suggestions.length === 0 ? (
												<Pressable
													onPress={() => enterManualFor(idx)}
													style={styles.manualBtn}
												>
													<Text style={styles.manualBtnText}>Enter manually</Text>
												</Pressable>
											) : null}
										</View>
									);
								})
							)}

							<Button
								title={saving ? 'Starting…' : 'Start program'}
								onPress={handleStartProgram}
								disabled={!allResolved || saving}
								style={styles.topSpace}
							/>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
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
	sectionLabel: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '600',
		marginBottom: 12,
	},
	weekNav: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: colors.backgroundCard,
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
	},
	weekInfo: {
		alignItems: 'center',
	},
	weekNum: {
		color: colors.text,
		fontSize: 18,
		fontWeight: '600',
	},
	weekRange: {
		color: colors.primary,
		fontSize: 13,
		marginTop: 2,
	},
	navBtn: {
		padding: 8,
	},
	info: {
		color: colors.textMuted,
		fontSize: 13,
		marginBottom: 16,
	},
	rmRow: {
		marginBottom: 16,
		padding: 12,
		backgroundColor: colors.backgroundCard,
		borderRadius: 8,
	},
	rmName: {
		color: colors.text,
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 8,
	},
	rmWeightRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	rmWeightInput: {
		flex: 1,
		backgroundColor: colors.backgroundInput,
		color: colors.text,
		padding: 10,
		borderRadius: 6,
		fontSize: 16,
	},
	rmUnit: {
		color: colors.textMuted,
		fontSize: 13,
	},
	rmMeta: {
		color: colors.primary,
		fontSize: 12,
		marginTop: 6,
	},
	suggestions: {
		marginTop: 10,
	},
	suggestionsLabel: {
		color: colors.textMuted,
		fontSize: 12,
		marginBottom: 6,
	},
	suggestionChip: {
		backgroundColor: colors.backgroundInput,
		padding: 8,
		borderRadius: 6,
		marginTop: 4,
	},
	suggestionText: {
		color: colors.text,
		fontSize: 13,
	},
	manualBtn: {
		marginTop: 8,
		padding: 8,
		alignItems: 'center',
	},
	manualBtnText: {
		color: colors.primary,
		fontSize: 13,
	},
	topSpace: {
		marginTop: 16,
	},
});
