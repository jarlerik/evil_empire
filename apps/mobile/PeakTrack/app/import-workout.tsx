import {
	View,
	Text,
	TextInput,
	Pressable,
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Alert,
} from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { parseWorkoutText, ParsedWorkoutBlock, ParsedSetData } from '@evil-empire/parsers';
import {
	createWorkout,
	createExercise,
	insertPhase,
	createRepetitionMaximum,
	fetchWorkoutsByUserId,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useRmLookup, RmMatch } from '../hooks/useRmLookup';
import { buildPhaseData } from '../lib/buildPhaseData';
import { Button } from '../components/Button';
import { RmFormModal, RmFormData } from '../components/RmFormModal';
import { RmSelectModal } from '../components/RmSelectModal';
import { commonStyles, colors } from '../styles/common';

interface BlockState {
	block: ParsedWorkoutBlock;
	name: string;
	notes: string;
	skipped: boolean;
	/** Resolved 1RM weight (set when user picks a match or creates a new RM). */
	rmWeight?: number;
	/** Source exercise name the 1RM came from. */
	rmSourceName?: string;
}

/**
 * Build the auto-generated RM-source note appended to a phase whose weight was
 * resolved from a percentage. Mirrors the format used in `useAddExercisePhase`
 * so phases created via paste-import look the same as those typed by hand.
 */
function buildRmSourceNote(
	parsedData: ParsedSetData,
	rmWeight: number,
	rmName: string,
	weightUnit: string,
): string {
	const pct = parsedData.weightPercentage;
	const pctMin = parsedData.weightMinPercentage;
	const pctMax = parsedData.weightMaxPercentage;

	let pctLabel: string;
	if (parsedData.weights && parsedData.weights.length > 1 && pctMin !== undefined && pctMax !== undefined) {
		const parts = parsedData.weights.map((w, i) => {
			if (i === parsedData.weights!.length - 1) {
				return `${pctMin}-${pctMax}%`;
			}
			return `${w}%`;
		});
		pctLabel = parts.join(', ');
	} else if (pctMin !== undefined && pctMax !== undefined) {
		pctLabel = `${pctMin}-${pctMax}%`;
	} else if (parsedData.weights && parsedData.weights.length > 1) {
		pctLabel = parsedData.weights.map(w => `${w}%`).join(', ');
	} else if (pct !== undefined) {
		pctLabel = `${pct}%`;
	} else {
		pctLabel = '';
	}

	return pctLabel
		? `${pctLabel} of ${rmName} 1RM (${rmWeight}${weightUnit})`
		: `${rmName} 1RM (${rmWeight}${weightUnit})`;
}

function isBlockReady(state: BlockState): boolean {
	if (state.skipped) {return true;}
	if (!state.block.parsed.isValid) {return false;}
	if (!state.name.trim()) {return false;}
	if (state.block.parsed.needsRmLookup && state.rmWeight === undefined) {return false;}
	return true;
}

export default function ImportWorkoutScreen() {
	const params = useLocalSearchParams<{ selectedDate?: string }>();
	const dateParam = Array.isArray(params.selectedDate) ? params.selectedDate[0] : params.selectedDate;
	const parsedDate = dateParam ? parseISO(dateParam) : new Date();
	const targetDate = isValidDate(parsedDate) ? parsedDate : new Date();
	const targetDateStr = format(targetDate, 'yyyy-MM-dd');

	const { user } = useAuth();
	const { settings } = useUserSettings();
	const weightUnit = settings?.weight_unit || 'kg';
	const { lookupRm, calculateWeightsFromParsedData } = useRmLookup();

	const [step, setStep] = useState<'paste' | 'review'>('paste');
	const [rawText, setRawText] = useState('');
	const [blocks, setBlocks] = useState<BlockState[]>([]);
	const [isParsing, setIsParsing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// RM modal state — `activeBlockIdx` identifies which block the modal is operating on.
	const [activeBlockIdx, setActiveBlockIdx] = useState<number | null>(null);
	const [rmSelectVisible, setRmSelectVisible] = useState(false);
	const [rmModalVisible, setRmModalVisible] = useState(false);
	const [rmPartialMatches, setRmPartialMatches] = useState<RmMatch[]>([]);
	const [rmSaving, setRmSaving] = useState(false);

	const handleParse = async () => {
		if (!user) {
			setError('You must be signed in to import a workout.');
			return;
		}
		if (!rawText.trim()) {
			setError('Paste some workout text first.');
			return;
		}

		setIsParsing(true);
		setError(null);

		try {
			const parsedBlocks = parseWorkoutText(rawText);

			// Eagerly resolve any percentages with an exact 1RM match so the user
			// only sees "% reference needed" chips for blocks that genuinely need input.
			const initial: BlockState[] = await Promise.all(
				parsedBlocks.map(async (b): Promise<BlockState> => {
					const base: BlockState = {
						block: b,
						name: b.suggestedName,
						notes: b.notes ?? '',
						skipped: false,
					};
					if (b.parsed.needsRmLookup && b.suggestedName) {
						const lookup = await lookupRm(user.id, b.suggestedName);
						if (lookup.found) {
							return { ...base, rmWeight: lookup.weight, rmSourceName: b.suggestedName };
						}
					}
					return base;
				}),
			);

			setBlocks(initial);
			setStep('review');
		} finally {
			setIsParsing(false);
		}
	};

	const handleResolveRm = async (idx: number) => {
		if (!user) {return;}
		setActiveBlockIdx(idx);
		const target = blocks[idx];
		const lookup = await lookupRm(user.id, target.name.trim() || target.block.suggestedName);

		if (lookup.partialMatches && lookup.partialMatches.length > 0) {
			setRmPartialMatches(lookup.partialMatches);
			setRmSelectVisible(true);
		} else {
			setRmPartialMatches([]);
			setRmModalVisible(true);
		}
	};

	const handleSelectMatch = (match: RmMatch) => {
		if (activeBlockIdx === null) {return;}
		const idx = activeBlockIdx;
		setBlocks(prev =>
			prev.map((b, i) => (i === idx ? { ...b, rmWeight: match.weight, rmSourceName: match.exerciseName } : b)),
		);
		setRmSelectVisible(false);
		setActiveBlockIdx(null);
	};

	const handleAddNewFromSelect = () => {
		setRmSelectVisible(false);
		setRmModalVisible(true);
	};

	const handleRmSave = async (data: RmFormData) => {
		if (!user || activeBlockIdx === null) {return;}
		setRmSaving(true);
		const { error: rmError } = await createRepetitionMaximum({
			userId: user.id,
			exerciseName: data.exerciseName,
			reps: data.reps,
			weight: data.weight,
			date: data.date,
		});
		setRmSaving(false);

		if (rmError) {
			Alert.alert('Error', rmError);
			return;
		}

		const idx = activeBlockIdx;
		setBlocks(prev =>
			prev.map((b, i) => (i === idx ? { ...b, rmWeight: data.weight, rmSourceName: data.exerciseName } : b)),
		);
		setRmModalVisible(false);
		setActiveBlockIdx(null);
	};

	const handleSave = async () => {
		if (!user) {return;}
		const ready = blocks.every(isBlockReady);
		if (!ready) {
			Alert.alert('Resolve all blocks', 'Each block must be skipped, parsed, or have its 1RM source set before saving.');
			return;
		}
		const importable = blocks.filter(b => !b.skipped && b.block.parsed.isValid && b.name.trim());
		if (importable.length === 0) {
			Alert.alert('Nothing to import', 'All blocks were skipped or invalid.');
			return;
		}

		setIsSaving(true);
		setError(null);

		try {
			// Number the new workout based on how many already exist for the same date
			// (matches the home screen's "Add another workout" naming convention).
			const { data: allWorkouts } = await fetchWorkoutsByUserId(user.id);
			const existingForDate = (allWorkouts ?? []).filter(w => w.workout_date === targetDateStr);
			const workoutNumber = existingForDate.length + 1;
			const workoutName = `Workout #${workoutNumber} ${format(targetDate, 'MMM d')}`;

			const { data: workout, error: workoutError } = await createWorkout(workoutName, user.id, targetDateStr);
			if (workoutError || !workout) {
				setError('Failed to create workout. Please try again.');
				return;
			}

			for (const state of importable) {
				const trimmedName = state.name.trim();
				const { data: exercise, error: exError } = await createExercise(trimmedName, workout.id);
				if (exError || !exercise) {
					setError(`Failed to create exercise "${trimmedName}".`);
					return;
				}

				// Resolve weights from the parsed data + any user-resolved RM.
				const weightResult = await calculateWeightsFromParsedData(
					user.id,
					trimmedName,
					state.block.parsed,
					state.rmWeight,
					state.rmSourceName,
				);
				if (!weightResult.success) {
					setError(`Couldn't resolve weights for "${trimmedName}": ${weightResult.error ?? 'unknown error'}`);
					return;
				}

				const { weight, weightMin, weightMax, weights: resolvedWeights, rmWeight, rmSourceName } = weightResult.weights;
				const weightRange =
					weightMin !== undefined && weightMax !== undefined ? { min: weightMin, max: weightMax } : undefined;

				let finalParsed: ParsedSetData = state.block.parsed;
				if (resolvedWeights) {
					finalParsed = { ...finalParsed, weights: resolvedWeights };
				}

				// Combine user-edited notes with auto-generated RM source line.
				const userNotes = state.notes.trim();
				const rmSourceNote =
					state.block.parsed.needsRmLookup && rmWeight
						? buildRmSourceNote(state.block.parsed, rmWeight, rmSourceName ?? trimmedName, weightUnit)
						: '';
				const combinedNotes = [userNotes, rmSourceNote].filter(Boolean).join('\n');
				if (combinedNotes) {
					finalParsed = { ...finalParsed, notes: combinedNotes };
				}

				// For wave exercises with percentage weights, resolve to kg values
				// (mirrors the special-case in useAddExercisePhase).
				if (finalParsed.exerciseType === 'wave' && finalParsed.needsRmLookup && finalParsed.weights && rmWeight) {
					const resolved = finalParsed.weights.map(pct => Math.round((rmWeight * pct) / 100));
					finalParsed = { ...finalParsed, weights: resolved };
				}

				const phaseData = buildPhaseData(exercise.id, finalParsed, weight, weightRange);
				const { error: phaseError } = await insertPhase(phaseData);
				if (phaseError) {
					setError(`Failed to insert phase for "${trimmedName}": ${phaseError}`);
					return;
				}
			}

			router.back();
		} finally {
			setIsSaving(false);
		}
	};

	const updateBlock = (idx: number, patch: Partial<BlockState>) => {
		setBlocks(prev => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
	};

	return (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
			>
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Pressable onPress={() => router.back()} style={commonStyles.backButton}>
							<Text style={commonStyles.backButtonText}>←</Text>
						</Pressable>
						<Text style={[commonStyles.titleFlex, styles.title]}>Import workout</Text>
					</View>
					<Text style={styles.dateLabel}>{format(targetDate, 'EEEE, LLLL d')}</Text>

					{step === 'paste' ? (
						<View>
							<Text style={styles.helperText}>
								Paste a workout from another app. Each exercise should be on its own block (separated by a blank line).
							</Text>
							<TextInput
								style={styles.pasteInput}
								value={rawText}
								onChangeText={setRawText}
								placeholder={'Snatch grip DL with pause\n4 x 5 @95% of 1RM\npause at knee for 3 sec'}
								placeholderTextColor={colors.textMuted}
								multiline
								textAlignVertical="top"
								editable={!isParsing}
							/>
							{error && <Text style={styles.errorText}>{error}</Text>}
							<Button
								title={isParsing ? 'Parsing…' : 'Parse'}
								onPress={handleParse}
								disabled={isParsing || !rawText.trim()}
								style={styles.actionButton}
							/>
						</View>
					) : (
						<View>
							<Text style={styles.helperText}>
								Review {blocks.length} block{blocks.length === 1 ? '' : 's'}. Resolve any "1RM needed" chips, then save.
							</Text>
							{blocks.map((state, idx) => (
								<BlockCard
									key={idx}
									state={state}
									weightUnit={weightUnit}
									onChangeName={name => updateBlock(idx, { name })}
									onChangeNotes={notes => updateBlock(idx, { notes })}
									onToggleSkip={() => updateBlock(idx, { skipped: !state.skipped })}
									onResolveRm={() => handleResolveRm(idx)}
								/>
							))}
							{error && <Text style={styles.errorText}>{error}</Text>}
							<Button
								title={isSaving ? 'Saving…' : 'Add to workout'}
								onPress={handleSave}
								disabled={isSaving || !blocks.every(isBlockReady)}
								style={styles.actionButton}
							/>
							<Pressable onPress={() => setStep('paste')} style={styles.backToPaste} disabled={isSaving}>
								<Text style={styles.backToPasteText}>← Edit pasted text</Text>
							</Pressable>
						</View>
					)}
				</View>
			</ScrollView>

			<RmSelectModal
				visible={rmSelectVisible}
				onClose={() => {
					setRmSelectVisible(false);
					setActiveBlockIdx(null);
				}}
				onSelect={handleSelectMatch}
				onAddNew={handleAddNewFromSelect}
				matches={rmPartialMatches}
				exerciseName={activeBlockIdx !== null ? blocks[activeBlockIdx]?.name ?? '' : ''}
				unit={weightUnit}
			/>
			<RmFormModal
				visible={rmModalVisible}
				onClose={() => {
					setRmModalVisible(false);
					setActiveBlockIdx(null);
				}}
				onSave={handleRmSave}
				defaultExerciseName={activeBlockIdx !== null ? blocks[activeBlockIdx]?.name ?? '' : ''}
				isLoading={rmSaving}
				unit={weightUnit}
			/>
		</KeyboardAvoidingView>
	);
}

interface BlockCardProps {
	state: BlockState;
	weightUnit: string;
	onChangeName: (name: string) => void;
	onChangeNotes: (notes: string) => void;
	onToggleSkip: () => void;
	onResolveRm: () => void;
}

function BlockCard({ state, weightUnit, onChangeName, onChangeNotes, onToggleSkip, onResolveRm }: BlockCardProps) {
	const { block, skipped } = state;
	const isUnparseable = !block.parsed.isValid;
	const needsRm = block.parsed.needsRmLookup && state.rmWeight === undefined;

	return (
		<View style={[styles.card, skipped && styles.cardSkipped]}>
			<View style={styles.cardHeader}>
				<TextInput
					style={[styles.nameInput, skipped && styles.dimmed]}
					value={state.name}
					onChangeText={onChangeName}
					placeholder="Exercise name"
					placeholderTextColor={colors.textMuted}
					editable={!skipped}
				/>
				<Pressable onPress={onToggleSkip} style={styles.skipButton}>
					<Ionicons
						name={skipped ? 'arrow-undo-outline' : 'close-outline'}
						size={20}
						color={colors.textMuted}
					/>
				</Pressable>
			</View>

			{!isUnparseable ? (
				<Text style={[styles.specSummary, skipped && styles.dimmed]}>
					{summarizeSpec(block.parsed, state.rmWeight, weightUnit)}
				</Text>
			) : (
				<Text style={styles.unparseableText}>
					Couldn't parse this block. Skip it, or go back and fix the pasted text.
				</Text>
			)}

			{!isUnparseable && (
				<TextInput
					style={[styles.notesInput, skipped && styles.dimmed]}
					value={state.notes}
					onChangeText={onChangeNotes}
					placeholder="Notes (optional)"
					placeholderTextColor={colors.textMuted}
					multiline
					editable={!skipped}
				/>
			)}

			{!skipped && needsRm && (
				<Pressable style={styles.chipNeedsRm} onPress={onResolveRm}>
					<Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
					<Text style={styles.chipNeedsRmText}>1RM needed — tap to set</Text>
				</Pressable>
			)}
			{!skipped && !needsRm && state.rmSourceName && (
				<View style={styles.chipResolved}>
					<Ionicons name="checkmark-circle-outline" size={16} color="#5cb85c" />
					<Text style={styles.chipResolvedText}>
						{state.rmSourceName} 1RM: {state.rmWeight}
						{weightUnit}
					</Text>
				</View>
			)}
			{skipped && <Text style={styles.skippedLabel}>Skipped</Text>}
		</View>
	);
}

function summarizeSpec(parsed: ParsedSetData, rmWeight: number | undefined, unit: string): string {
	const repsStr = parsed.compoundReps ? parsed.compoundReps.join('+') : String(parsed.reps);
	const setsRepsStr = `${parsed.sets} × ${repsStr}`;

	let weightStr = '';
	if (parsed.needsRmLookup) {
		// Percentage-based — show the percentage, plus the resolved kg if RM is known.
		if (parsed.weightMinPercentage !== undefined && parsed.weightMaxPercentage !== undefined) {
			weightStr = `@${parsed.weightMinPercentage}-${parsed.weightMaxPercentage}%`;
		} else if (parsed.weightPercentage !== undefined) {
			weightStr = `@${parsed.weightPercentage}%`;
		}
		if (rmWeight !== undefined && parsed.weightPercentage !== undefined) {
			const resolved = Math.round((rmWeight * parsed.weightPercentage) / 100);
			weightStr += ` (~${resolved}${unit})`;
		}
	} else if (parsed.weightMin !== undefined && parsed.weightMax !== undefined) {
		weightStr = `@${parsed.weightMin}-${parsed.weightMax}${unit}`;
	} else if (parsed.weight) {
		weightStr = `@${parsed.weight}${unit}`;
	}

	let suffix = '';
	if (parsed.restTimeSeconds) {suffix += ` · rest ${parsed.restTimeSeconds}s`;}
	if (parsed.rirMin !== undefined) {
		const rirRange = parsed.rirMax && parsed.rirMax !== parsed.rirMin ? `${parsed.rirMin}-${parsed.rirMax}` : `${parsed.rirMin}`;
		suffix += ` · ${rirRange} RIR`;
	}

	return `${setsRepsStr} ${weightStr}${suffix}`.trim();
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	scroll: { flexGrow: 1 },
	headerRow: {
		marginBottom: 8,
	},
	title: {
		fontSize: 22,
		textTransform: 'none',
	},
	dateLabel: {
		color: colors.textMuted,
		fontSize: 14,
		marginBottom: 24,
	},
	helperText: {
		color: colors.textMuted,
		fontSize: 14,
		marginBottom: 16,
		lineHeight: 20,
	},
	pasteInput: {
		backgroundColor: colors.backgroundInputAlt,
		color: colors.text,
		borderRadius: 8,
		padding: 15,
		fontSize: 14,
		minHeight: 200,
		fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
	},
	errorText: {
		color: colors.error,
		marginTop: 12,
	},
	actionButton: {
		marginTop: 16,
	},
	card: {
		backgroundColor: colors.backgroundCard,
		borderRadius: 8,
		padding: 16,
		marginBottom: 12,
	},
	cardSkipped: {
		opacity: 0.5,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	nameInput: {
		flex: 1,
		color: colors.text,
		fontSize: 16,
		fontWeight: '600',
		paddingVertical: 4,
	},
	skipButton: {
		padding: 8,
	},
	specSummary: {
		color: colors.primary,
		fontSize: 16,
		marginTop: 8,
	},
	notesInput: {
		backgroundColor: colors.backgroundInputAlt,
		color: colors.text,
		borderRadius: 6,
		padding: 10,
		fontSize: 13,
		marginTop: 10,
		minHeight: 40,
	},
	chipNeedsRm: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		alignSelf: 'flex-start',
		backgroundColor: 'rgba(198, 93, 36, 0.15)',
		borderColor: colors.primary,
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: 10,
		paddingVertical: 4,
		marginTop: 10,
	},
	chipNeedsRmText: {
		color: colors.primary,
		fontSize: 12,
		fontWeight: '600',
	},
	chipResolved: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		alignSelf: 'flex-start',
		backgroundColor: 'rgba(92, 184, 92, 0.12)',
		borderColor: '#5cb85c',
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: 10,
		paddingVertical: 4,
		marginTop: 10,
	},
	chipResolvedText: {
		color: '#5cb85c',
		fontSize: 12,
		fontWeight: '600',
	},
	unparseableText: {
		color: colors.error,
		fontSize: 14,
		marginTop: 8,
	},
	dimmed: {
		opacity: 0.6,
	},
	skippedLabel: {
		color: colors.textMuted,
		fontSize: 12,
		marginTop: 8,
		fontStyle: 'italic',
	},
	backToPaste: {
		marginTop: 16,
		alignSelf: 'center',
	},
	backToPasteText: {
		color: colors.textMuted,
		fontSize: 14,
	},
});

