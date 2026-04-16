import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
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
} from '@evil-empire/peaktrack-services';
import { commonStyles, colors } from '../styles/common';
import { Button } from '../components/Button';
import { LoadScreen } from './components/LoadScreen';
import { ProgramWeekEditor } from '../components/ProgramWeekEditor';

export default function ProgramDetail() {
	const { user } = useAuth();
	const params = useLocalSearchParams<{ programId: string }>();
	const programId = typeof params.programId === 'string' ? params.programId : null;
	const { reloadPrograms, invalidateSessionCache } = usePrograms();

	const [program, setProgram] = useState<Program | null>(null);
	const [sessions, setSessions] = useState<ProgramSession[]>([]);
	const [exercises, setExercises] = useState<ProgramExercise[]>([]);
	const [rms, setRms] = useState<ProgramRepetitionMaximum[]>([]);
	const [weekIndex, setWeekIndex] = useState(0);
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

	useEffect(() => {
		if (program && weekIndex >= program.duration_weeks) {
			setWeekIndex(Math.max(0, program.duration_weeks - 1));
		}
	}, [program, weekIndex]);

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
		// When unarchiving to draft, clear the start-week fields so the UI
		// doesn't show a stale "starts week N" subtitle and users go
		// through the assign flow again.
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
	const sessionsForWeek = sessions.filter(s => s.week_offset === weekIndex);
	const exercisesBySession = new Map<string, ProgramExercise[]>();
	for (const ex of exercises) {
		const list = exercisesBySession.get(ex.program_session_id) ?? [];
		list.push(ex);
		exercisesBySession.set(ex.program_session_id, list);
	}

	return (
		<View style={styles.flex}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Pressable onPress={() => router.back()} style={commonStyles.backButton}>
							<Ionicons name="chevron-back" size={24} color={colors.text} />
						</Pressable>
						<Text style={commonStyles.titleFlex} numberOfLines={1}>
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

					<ProgramWeekEditor
						programId={program.id}
						durationWeeks={program.duration_weeks}
						weekIndex={weekIndex}
						onChangeWeek={setWeekIndex}
						sessionsForWeek={sessionsForWeek}
						exercisesBySession={exercisesBySession}
						allSessions={sessions}
						allExercises={exercises}
						rms={rms}
						programStatus={program.status}
						onChange={loadAll}
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
						{!isActive && sessions.length > 0 && (
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
	subtitle: {
		color: colors.primary,
		fontSize: 14,
		marginBottom: 8,
	},
	description: {
		color: colors.textMuted,
		fontSize: 14,
		marginBottom: 16,
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
