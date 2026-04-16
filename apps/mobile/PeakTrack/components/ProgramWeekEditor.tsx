import { useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
	ProgramSession,
	ProgramExercise,
	ProgramRepetitionMaximum,
} from '@evil-empire/types';
import {
	getOrCreateProgramSession,
	upsertProgramExercise,
	deleteProgramExercise,
} from '@evil-empire/peaktrack-services';
import { parseSetInput } from '@evil-empire/parsers';
import { exerciseNeedsRmSnapshot, resolveWeightsFromSnapshot } from '../lib/resolveProgramWeights';
import { colors } from '../styles/common';
import { ProgramCellEditor } from './ProgramCellEditor';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ProgramWeekEditorProps {
	programId: string;
	durationWeeks: number;
	weekIndex: number;
	onChangeWeek: (i: number) => void;
	sessionsForWeek: ProgramSession[];
	exercisesBySession: Map<string, ProgramExercise[]>;
	allSessions: ProgramSession[];
	allExercises: ProgramExercise[];
	rms: ProgramRepetitionMaximum[];
	programStatus: 'draft' | 'active' | 'archived';
	onChange: () => void;
}

interface EditTarget {
	session_id: string;
	program_exercise?: ProgramExercise;
	day_of_week: number;
	next_order_index: number;
}

export function ProgramWeekEditor({
	programId,
	durationWeeks,
	weekIndex,
	onChangeWeek,
	sessionsForWeek,
	exercisesBySession,
	allSessions,
	allExercises,
	rms,
	programStatus,
	onChange,
}: ProgramWeekEditorProps) {
	const [editor, setEditor] = useState<EditTarget | null>(null);

	const openAdd = async (day: number) => {
		const existing = sessionsForWeek.find(s => s.day_of_week === day);
		const sessionId = existing
			? existing.id
			: (await getOrCreateProgramSession({
					program_id: programId,
					week_offset: weekIndex,
					day_of_week: day,
			  })).data?.id;
		if (!sessionId) {
			return;
		}
		const existingExs = existing ? exercisesBySession.get(existing.id) ?? [] : [];
		setEditor({
			session_id: sessionId,
			day_of_week: day,
			next_order_index: existingExs.length,
		});
	};

	const openEdit = (session: ProgramSession, ex: ProgramExercise) => {
		setEditor({
			session_id: session.id,
			program_exercise: ex,
			day_of_week: session.day_of_week,
			next_order_index: ex.order_index,
		});
	};

	const handleSaveExercise = async (input: { name: string; raw_input: string; notes: string }) => {
		if (!editor) {
			return;
		}
		const { error } = await upsertProgramExercise({
			id: editor.program_exercise?.id,
			program_session_id: editor.session_id,
			order_index: editor.next_order_index,
			name: input.name,
			raw_input: input.raw_input,
			notes: input.notes ? input.notes : null,
		});
		if (error) {
			Alert.alert('Could not save', error);
			return;
		}
		setEditor(null);
		onChange();
	};

	const handleDeleteExercise = (ex: ProgramExercise) => {
		Alert.alert('Remove exercise', `Remove "${ex.name}"?`, [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Remove',
				style: 'destructive',
				onPress: async () => {
					const { error } = await deleteProgramExercise(ex.id);
					if (!error) {
						onChange();
					}
				},
			},
		]);
	};

	const handleCopyPreviousWeek = async () => {
		if (weekIndex === 0) {
			return;
		}
		const prevSessions = allSessions.filter(s => s.week_offset === weekIndex - 1);
		if (prevSessions.length === 0) {
			Alert.alert('Nothing to copy', `Week ${weekIndex} is empty.`);
			return;
		}

		for (const prev of prevSessions) {
			const { data: newSession } = await getOrCreateProgramSession({
				program_id: programId,
				week_offset: weekIndex,
				day_of_week: prev.day_of_week,
			});
			if (!newSession) {
				continue;
			}
			const existingTargetExs = exercisesBySession.get(newSession.id) ?? [];
			let order = existingTargetExs.length;
			const prevExs = allExercises.filter(e => e.program_session_id === prev.id);
			for (const ex of prevExs) {
				await upsertProgramExercise({
					program_session_id: newSession.id,
					order_index: order++,
					name: ex.name,
					raw_input: ex.raw_input,
					notes: ex.notes,
				});
			}
		}
		onChange();
	};

	const handleCopyDayFromPrev = async (day: number) => {
		if (weekIndex === 0) {
			return;
		}
		const prev = allSessions.find(s => s.week_offset === weekIndex - 1 && s.day_of_week === day);
		if (!prev) {
			Alert.alert('Nothing to copy', `No exercises on ${DAY_LABELS[day - 1]} of week ${weekIndex}.`);
			return;
		}
		const { data: newSession } = await getOrCreateProgramSession({
			program_id: programId,
			week_offset: weekIndex,
			day_of_week: day,
		});
		if (!newSession) {
			return;
		}
		const existingTargetExs = exercisesBySession.get(newSession.id) ?? [];
		let order = existingTargetExs.length;
		const prevExs = allExercises.filter(e => e.program_session_id === prev.id);
		for (const ex of prevExs) {
			await upsertProgramExercise({
				program_session_id: newSession.id,
				order_index: order++,
				name: ex.name,
				raw_input: ex.raw_input,
				notes: ex.notes,
			});
		}
		onChange();
	};

	return (
		<View style={styles.container}>
			<View style={styles.weekNav}>
				<Pressable
					onPress={() => onChangeWeek(Math.max(0, weekIndex - 1))}
					disabled={weekIndex === 0}
					style={[styles.navBtn, weekIndex === 0 && styles.navBtnDisabled]}
				>
					<Ionicons name="chevron-back" size={24} color={colors.text} />
				</Pressable>
				<Text style={styles.weekTitle}>
					Week {weekIndex + 1} of {durationWeeks}
				</Text>
				<Pressable
					onPress={() => onChangeWeek(Math.min(durationWeeks - 1, weekIndex + 1))}
					disabled={weekIndex >= durationWeeks - 1}
					style={[styles.navBtn, weekIndex >= durationWeeks - 1 && styles.navBtnDisabled]}
				>
					<Ionicons name="chevron-forward" size={24} color={colors.text} />
				</Pressable>
			</View>

			{weekIndex > 0 && (
				<Pressable onPress={handleCopyPreviousWeek} style={styles.copyRow}>
					<Ionicons name="copy-outline" size={16} color={colors.primary} />
					<Text style={styles.copyText}>Copy week {weekIndex} to week {weekIndex + 1}</Text>
				</Pressable>
			)}

			{DAY_LABELS.map((label, idx) => {
				const day = idx + 1;
				const session = sessionsForWeek.find(s => s.day_of_week === day);
				const exs = session ? exercisesBySession.get(session.id) ?? [] : [];
				return (
					<View key={day} style={styles.daySection}>
						<View style={styles.dayHeader}>
							<Text style={styles.dayLabel}>{label}</Text>
							<View style={styles.dayHeaderActions}>
								{weekIndex > 0 && (
									<Pressable
										onPress={() => handleCopyDayFromPrev(day)}
										style={styles.smallIconBtn}
										accessibilityLabel={`Copy ${label} from previous week`}
									>
										<Ionicons name="copy-outline" size={14} color={colors.textMuted} />
									</Pressable>
								)}
								<Pressable
									onPress={() => openAdd(day)}
									style={styles.smallIconBtn}
									accessibilityLabel={`Add exercise to ${label}`}
								>
									<Ionicons name="add" size={18} color={colors.primary} />
								</Pressable>
							</View>
						</View>
						{exs.length === 0 ? (
							<Pressable onPress={() => openAdd(day)} style={styles.emptyDay}>
								<Text style={styles.emptyDayText}>Tap + to add an exercise</Text>
							</Pressable>
						) : (
							exs.map(ex => {
								const parsed = parseSetInput(ex.raw_input);
								let resolvedLine: string | null = null;
								if (parsed.isValid && exerciseNeedsRmSnapshot(parsed)) {
									try {
										const r = resolveWeightsFromSnapshot(ex.name, parsed, rms);
										resolvedLine =
											r.weightMin !== undefined && r.weightMax !== undefined
												? `${parsed.sets} × ${parsed.reps} @ ${r.weightMin}–${r.weightMax}kg`
												: `${parsed.sets} × ${parsed.reps} @ ${r.weight}kg`;
									} catch {
										resolvedLine = null;
									}
								}
								return (
									<Pressable
										key={ex.id}
										onPress={() => session && openEdit(session, ex)}
										style={styles.exRow}
									>
										<View style={styles.exBody}>
											<Text style={styles.exName}>{ex.name}</Text>
											<Text style={styles.exSpec}>{resolvedLine ?? ex.raw_input}</Text>
											{resolvedLine ? (
												<Text style={styles.exSpecRaw}>{ex.raw_input}</Text>
											) : null}
										</View>
										<Pressable
											onPress={() => handleDeleteExercise(ex)}
											style={styles.removeBtn}
											hitSlop={8}
											accessibilityLabel={`Remove ${ex.name}`}
										>
											<Ionicons name="close" size={18} color={colors.textMuted} />
										</Pressable>
									</Pressable>
								);
							})
						)}
					</View>
				);
			})}

			{editor !== null && (
				<ProgramCellEditor
					visible={true}
					initial={
						editor.program_exercise
							? {
									name: editor.program_exercise.name,
									raw_input: editor.program_exercise.raw_input,
									notes: editor.program_exercise.notes ?? '',
							  }
							: null
					}
					programRms={rms}
					programStatus={programStatus}
					onCancel={() => setEditor(null)}
					onSave={handleSaveExercise}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { marginTop: 16 },
	weekNav: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	navBtn: {
		padding: 8,
	},
	navBtnDisabled: {
		opacity: 0.3,
	},
	weekTitle: {
		color: colors.text,
		fontSize: 18,
		fontWeight: '600',
	},
	copyRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: '#333',
		borderStyle: 'dashed',
		borderRadius: 8,
		marginBottom: 16,
	},
	copyText: {
		color: colors.primary,
		fontSize: 13,
	},
	daySection: {
		marginBottom: 16,
	},
	dayHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 6,
		borderBottomWidth: 1,
		borderBottomColor: '#222',
	},
	dayHeaderActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	dayLabel: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '600',
	},
	smallIconBtn: {
		padding: 4,
	},
	emptyDay: {
		paddingVertical: 10,
	},
	emptyDayText: {
		color: colors.textMuted,
		fontSize: 13,
		fontStyle: 'italic',
	},
	exRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#1a1a1a',
	},
	exBody: {
		flex: 1,
	},
	exName: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '500',
	},
	exSpec: {
		color: colors.textMuted,
		fontSize: 13,
		marginTop: 2,
	},
	exSpecRaw: {
		color: '#444',
		fontSize: 11,
		marginTop: 2,
	},
	removeBtn: {
		padding: 6,
	},
});
