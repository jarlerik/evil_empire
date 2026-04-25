import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProgramSessionForDate } from '@evil-empire/types';
import { parseSetInput } from '@evil-empire/parsers';
import {
	exerciseNeedsRmSnapshot,
	resolveWeightsFromSnapshot,
	findProgramRm,
} from '@evil-empire/peaktrack-services';
import { prepareMaterializeInputs, sessionLabel as buildSessionLabel } from '@evil-empire/peaktrack-services';
import { colors } from '../styles/common';
import { usePrograms } from '../contexts/ProgramsContext';

interface ProgramSessionCardProps {
	item: ProgramSessionForDate;
	unit?: 'kg' | 'lbs';
	isMissed?: boolean;
	isMoveActive?: boolean;
	onMoveRequest?: () => void;
}

export function ProgramSessionCard({ item, unit = 'kg', isMissed = false, isMoveActive = false, onMoveRequest }: ProgramSessionCardProps) {
	const { materializeSession } = usePrograms();
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Check for missing snapshots up-front so we can surface a recovery banner.
	const missingNames: string[] = [];
	for (const ex of item.exercises) {
		const parsed = parseSetInput(ex.raw_input);
		if (exerciseNeedsRmSnapshot(parsed) && !findProgramRm(ex.name, item.rms)) {
			missingNames.push(ex.name);
		}
	}

	const sessionLabel = buildSessionLabel(item);

	const handleStart = async () => {
		setError(null);
		const prep = prepareMaterializeInputs(item);
		if (!prep.ok) {
			setError(prep.error);
			return;
		}

		setStarting(true);
		const { workout_id, error: rpcError } = await materializeSession({
			session_id: item.session.id,
			target_date: item.date,
			name: sessionLabel,
			exercises: prep.exercises,
		});
		setStarting(false);

		if (rpcError || !workout_id) {
			setError(rpcError ?? 'Could not start workout');
			return;
		}

		router.push({
			pathname: '/start-workout',
			params: { workoutName: sessionLabel, workoutId: workout_id },
		});
	};

	const handleOpenProgram = () => {
		router.push({ pathname: '/program-detail', params: { programId: item.program.id } });
	};

	return (
		<View style={styles.card}>
			<View style={styles.header}>
				<View style={styles.headerBody}>
					<Text style={styles.title}>{sessionLabel}</Text>
				</View>
				{isMissed && onMoveRequest && (
					<Pressable
						onPress={onMoveRequest}
						style={styles.moveBtn}
						accessibilityRole="button"
						accessibilityLabel={isMoveActive ? 'Cancel move' : 'Move to another day'}
					>
						<Ionicons
							name="arrow-forward-outline"
							size={22}
							color={isMoveActive ? colors.primary : '#fff'}
						/>
					</Pressable>
				)}
				<Pressable
					onPress={handleStart}
					disabled={starting || missingNames.length > 0}
					style={[styles.startBtn, starting && styles.startBtnDisabled]}
					accessibilityLabel="Start workout"
				>
					{starting ? (
						<ActivityIndicator size="small" color="#fff" />
					) : (
						<Ionicons name="stopwatch-outline" size={22} color="#fff" />
					)}
				</Pressable>
			</View>

			{missingNames.length > 0 && (
				<Pressable onPress={handleOpenProgram} style={styles.banner}>
					<Ionicons name="alert-circle-outline" size={16} color={colors.error} />
					<Text style={styles.bannerText}>
						Missing 1RM for {missingNames.join(', ')}. Tap to resolve.
					</Text>
				</Pressable>
			)}

			{item.exercises.map(ex => {
				const parsed = parseSetInput(ex.raw_input);
				let display = ex.raw_input;
				let showRaw = false;
				if (parsed.isValid && exerciseNeedsRmSnapshot(parsed)) {
					try {
						const r = resolveWeightsFromSnapshot(ex.name, parsed, item.rms);
						const baseSpec = parsed.compoundReps
							? `${parsed.sets} × ${parsed.compoundReps.join('+')}`
							: `${parsed.sets} × ${parsed.reps}`;
						if (r.weightMin !== undefined && r.weightMax !== undefined) {
							display = `${baseSpec} @ ${r.weightMin}–${r.weightMax}${unit}`;
						} else {
							display = `${baseSpec} @ ${r.weight}${unit}`;
						}
						showRaw = true;
					} catch {
						display = ex.raw_input;
					}
				}
				return (
					<View key={ex.id} style={styles.exItem}>
						<Text style={styles.exName}>{ex.name}</Text>
						<Text style={styles.exSpec}>{display}</Text>
						{showRaw ? <Text style={styles.exSpecRaw}>{ex.raw_input}</Text> : null}
						{ex.notes ? <Text style={styles.exNotes}>{ex.notes}</Text> : null}
					</View>
				);
			})}

			{error ? <Text style={styles.errorText}>{error}</Text> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		marginTop: 16,
		backgroundColor: colors.backgroundCard,
		borderRadius: 8,
		padding: 14,
		borderWidth: 1,
		borderColor: '#222',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 10,
	},
	headerBody: {
		flex: 1,
	},
	title: {
		color: colors.primary,
		fontSize: 15,
		fontWeight: '600',
	},
	moveBtn: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 4,
	},
	startBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	startBtnDisabled: {
		opacity: 0.4,
	},
	banner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: 'rgba(239,68,68,0.1)',
		padding: 10,
		borderRadius: 6,
		marginBottom: 10,
	},
	bannerText: {
		color: colors.error,
		fontSize: 12,
		flex: 1,
	},
	exItem: {
		paddingVertical: 8,
		borderTopWidth: 1,
		borderTopColor: '#1a1a1a',
	},
	exName: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '500',
	},
	exSpec: {
		color: colors.primary,
		fontSize: 13,
		marginTop: 2,
	},
	exSpecRaw: {
		color: '#555',
		fontSize: 11,
		marginTop: 2,
	},
	exNotes: {
		color: colors.textMuted,
		fontSize: 12,
		marginTop: 4,
	},
	errorText: {
		color: colors.error,
		fontSize: 12,
		marginTop: 8,
	},
});
