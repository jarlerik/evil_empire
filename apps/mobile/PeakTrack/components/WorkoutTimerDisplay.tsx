import React from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Alert, AlertButton } from 'react-native';
import { Button } from './Button';
import { ExercisePhase } from '@evil-empire/parsers';
import { interpolateWeight } from '@evil-empire/peaktrack-services';

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

interface WorkoutTimerDisplayProps {
	workoutState: WorkoutState;
	exerciseName: string | undefined;
	exercisePhase: ExercisePhase | null;
	allPhases: ExercisePhase[];
	nextPhase: ExercisePhase | null;
	currentSetInPhase: number;
	restTimeRemaining: number;
	blinkOpacity: Animated.Value;
	onEditFinishedExercise: () => void;
	onEndEarly?: () => void;
	onSkipCurrent?: () => void;
	unit: string;
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseCircuitExercises(exercisePhase: ExercisePhase | null): Array<{reps: string, name: string}> | null {
	if (!exercisePhase?.circuit_exercises) {
		return null;
	}

	if (typeof exercisePhase.circuit_exercises === 'string') {
		try {
			return JSON.parse(exercisePhase.circuit_exercises);
		} catch {
			return null;
		}
	}
	return exercisePhase.circuit_exercises;
}

function parseReps(exercisePhase: ExercisePhase | null, currentSet?: number): string {
	if (!exercisePhase) {
		return '';
	}

	// Wave: show per-set rep count
	if (exercisePhase.exercise_type === 'wave' && exercisePhase.compound_reps && currentSet) {
		return String(exercisePhase.compound_reps[currentSet - 1] ?? exercisePhase.repetitions);
	}

	if (exercisePhase.compound_reps) {
		return exercisePhase.compound_reps.join(' + ');
	}
	return String(exercisePhase.repetitions);
}

function parseWeight(exercisePhase: ExercisePhase | null, currentSet: number, totalSets: number, unit: string): string {
	if (!exercisePhase) {
		return '';
	}

	// Per-set weights with optional trailing range (e.g., "52, 55, 57-59kg")
	if (exercisePhase.weights && exercisePhase.weights.length > 1) {
		// Wave with multiple weights: map set index to weight group
		if (exercisePhase.exercise_type === 'wave' && exercisePhase.compound_reps) {
			const repsPerWeight = exercisePhase.compound_reps.length / exercisePhase.weights.length;
			const weightIdx = Math.floor((currentSet - 1) / repsPerWeight);
			const weight = exercisePhase.weights[weightIdx] ?? exercisePhase.weights[exercisePhase.weights.length - 1];
			return `@${weight}${unit}`;
		}

		const weight = exercisePhase.weights[currentSet - 1] ?? exercisePhase.weights[exercisePhase.weights.length - 1];
		// If this is the last set and there's a weight range, show the range
		if (currentSet >= exercisePhase.weights.length
			&& exercisePhase.weight_min != null && exercisePhase.weight_max != null
			&& exercisePhase.weight_min !== exercisePhase.weight_max) {
			return `@${exercisePhase.weight_min}-${exercisePhase.weight_max}${unit}`;
		}
		return `@${weight}${unit}`;
	}

	if (exercisePhase.weight_min != null && exercisePhase.weight_max != null && exercisePhase.weight_min !== exercisePhase.weight_max) {
		const weight = interpolateWeight(exercisePhase.weight_min, exercisePhase.weight_max, currentSet, totalSets);
		return `@${weight}${unit}`;
	}

	return `@${exercisePhase.weight}${unit}`;
}

function formatPhaseForDisplay(phase: ExercisePhase, unit: string): string {
	const circuits = parseCircuitExercises(phase);
	if (circuits && circuits.length > 0) {
		const exercisesStr = circuits.map(ex => `${ex.reps} ${ex.name}`).join(', ');
		return `${phase.sets} x ${exercisesStr}`;
	}

	// Wave display: "3-2-1-3-2-1 @56, 60kg"
	if (phase.exercise_type === 'wave' && phase.compound_reps && phase.compound_reps.length > 0) {
		const repsStr = phase.compound_reps.join('-');
		let weightStr: string;
		if (phase.weights && phase.weights.length > 1) {
			weightStr = phase.weights.map(w => `${w}`).join(', ') + unit;
		} else {
			weightStr = `${phase.weight}${unit}`;
		}
		return `${repsStr} @${weightStr}`;
	}

	const sets = phase.sets;
	const reps = phase.compound_reps
		? phase.compound_reps.join(' + ')
		: String(phase.repetitions);

	let weight: string;
	if (phase.weights && phase.weights.length > 1) {
		// Per-set weights with optional trailing range
		const hasRange = phase.weight_min != null && phase.weight_max != null && phase.weight_min !== phase.weight_max;
		const parts = phase.weights.map((w, i) => {
			if (hasRange && i === phase.weights!.length - 1) {
				return `${phase.weight_min}-${phase.weight_max}`;
			}
			return `${w}`;
		});
		weight = `@${parts.join(' ')}${unit}`;
	} else if (phase.weight_min != null && phase.weight_max != null && phase.weight_min !== phase.weight_max) {
		weight = `@${phase.weight_min}-${phase.weight_max}${unit}`;
	} else {
		weight = `@${phase.weight}${unit}`;
	}
	return `${sets} x ${reps} ${weight}`;
}

export function WorkoutTimerDisplay({
	workoutState,
	exerciseName,
	exercisePhase,
	allPhases,
	nextPhase,
	currentSetInPhase,
	restTimeRemaining,
	blinkOpacity,
	onEditFinishedExercise,
	onEndEarly,
	onSkipCurrent,
	unit,
}: WorkoutTimerDisplayProps) {

	// Determine which phase to display (current or next)
	const displayPhase = nextPhase || exercisePhase;
	const circuitExercises = parseCircuitExercises(displayPhase);
	const isCircuit = circuitExercises && circuitExercises.length > 0;

	// Count text reflects the current/most-recent set (no rest-time increment).
	const setNumber = nextPhase ? 1 : currentSetInPhase;
	const totalSets = displayPhase?.sets || 0;

	// During rest (within the same phase), preview the next set's reps/weight
	// so the user can prepare. The count text above stays on the just-completed set.
	const previewSet = workoutState === 'rest' && !nextPhase && setNumber < totalSets
		? setNumber + 1
		: setNumber;
	const reps = parseReps(displayPhase, nextPhase ? 1 : previewSet);
	const weight = parseWeight(displayPhase, previewSet, totalSets, unit);

	const showMenuButton =
		(workoutState === 'work' || workoutState === 'rest' || workoutState === 'idle')
		&& (!!onEndEarly || !!onSkipCurrent);

	const handleMenuPress = () => {
		const buttons: AlertButton[] = [];
		if (onEndEarly && (workoutState === 'work' || workoutState === 'rest')) {
			buttons.push({ text: 'End exercise early', style: 'destructive', onPress: onEndEarly });
		}
		if (onSkipCurrent) {
			buttons.push({ text: 'Skip exercise', style: 'destructive', onPress: onSkipCurrent });
		}
		buttons.push({ text: 'Cancel', style: 'cancel' });
		Alert.alert(exerciseName || 'Exercise', undefined, buttons);
	};

	// Render exercise done state with all phases
	if (workoutState === 'exercise_done') {
		return (
			<View style={styles.timerContainer}>
				<View style={styles.doneTopSection}>
					<Text style={styles.exerciseName}>
						{exerciseName}
					</Text>
					<View style={styles.phasesList}>
						{allPhases.map((phase, index) => (
							<Text key={phase.id || index} style={styles.phaseItem}>
								{formatPhaseForDisplay(phase, unit)}
							</Text>
						))}
					</View>
				</View>

				<View style={styles.doneBottomSection}>
					<Text
						style={styles.stateDone}
						adjustsFontSizeToFit
						numberOfLines={1}
					>
						Exercise done
					</Text>
					<Button
						title="Edit finished exercise"
						variant="secondary"
						onPress={onEditFinishedExercise}
					/>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.timerContainer}>
			{showMenuButton && (
				<Pressable
					onPress={handleMenuPress}
					style={styles.menuButton}
					hitSlop={8}
					accessibilityLabel="Exercise actions"
					accessibilityRole="button"
				>
					<Text style={styles.menuButtonText}>⋮</Text>
				</Pressable>
			)}
			{/* Exercise name pinned at top */}
			<Text
				style={styles.exerciseName}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{exerciseName}
			</Text>

			{/* Middle section: Exercise info */}
			<View style={styles.timerTopSection}>
				{workoutState !== 'idle' && workoutState !== 'workout_done' && (
					<Text style={styles.setInfo}>
						{isCircuit ? 'Round' : 'Set'} {setNumber} of {totalSets}
					</Text>
				)}

				{(nextPhase || workoutState === 'rest') && (
					<Text style={styles.nextPhaseLabel}>
						{nextPhase ? 'Next phase:' : 'Next set:'}
					</Text>
				)}

				{isCircuit ? (
					circuitExercises.map((ex, i) => (
						<Text key={i} style={styles.circuitExercise}>
							{ex.reps} {ex.name}
						</Text>
					))
				) : (
					<>
						<Text style={styles.reps}>{reps}</Text>
						<Text style={styles.weight}>{weight}</Text>
					</>
				)}
			</View>

			{/* Bottom section: State and countdown */}
			<View style={styles.timerBottomSection}>
				{workoutState === 'idle' && (
					<Text
						style={styles.stateIdle}
						adjustsFontSizeToFit
						numberOfLines={1}
					>
						NOT STARTED
					</Text>
				)}
				{workoutState === 'work' && (
					<>
						<Animated.Text style={[styles.stateWork, { opacity: blinkOpacity }]} adjustsFontSizeToFit numberOfLines={1}>WORKING</Animated.Text>
						{exercisePhase?.emom_interval_seconds && restTimeRemaining > 0 && (
							<Animated.Text style={[styles.countdown, { opacity: blinkOpacity }]}>
								{formatTime(restTimeRemaining)}
							</Animated.Text>
						)}
					</>
				)}
				{workoutState === 'rest' && (
					<>
						<Animated.Text style={[styles.stateRest, { opacity: blinkOpacity }]} adjustsFontSizeToFit numberOfLines={1}>RESTING</Animated.Text>
						{restTimeRemaining > 0 && (
							<Animated.Text style={[styles.countdown, { opacity: blinkOpacity }]}>
								{formatTime(restTimeRemaining)}
							</Animated.Text>
						)}
					</>
				)}
				{workoutState === 'workout_done' && (
					<Text
						style={styles.stateDone}
						adjustsFontSizeToFit
						numberOfLines={1}
					>
						Workout done
					</Text>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	timerContainer: {
		flex: 1,
		marginTop: 8,
		backgroundColor: '#262626',
		borderWidth: 1,
		borderColor: '#fff',
		borderRadius: 8,
		justifyContent: 'space-around',
		alignItems: 'center',
		padding: 16,
		overflow: 'hidden',
	},
	timerTopSection: {
		alignItems: 'center',
		width: '100%',
	},
	timerBottomSection: {
		alignItems: 'center',
		width: '100%',
	},
	doneTopSection: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	doneBottomSection: {
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	exerciseName: {
		color: '#fff',
		fontSize: 22,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	phasesList: {
		alignItems: 'center',
		marginTop: 8,
	},
	phaseItem: {
		color: '#C65D24',
		fontSize: 20,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 4,
	},
	nextPhaseLabel: {
		color: '#C65D24',
		fontSize: 16,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	setInfo: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 2,
	},
	circuitExercise: {
		color: '#C65D24',
		fontSize: 22,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 2,
	},
	reps: {
		color: '#C65D24',
		fontSize: 28,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	weight: {
		color: '#C65D24',
		fontSize: 28,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateIdle: {
		color: '#fff',
		fontSize: 42,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateWork: {
		color: '#ef4444',
		fontSize: 42,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateRest: {
		color: '#22c55e',
		fontSize: 42,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateDone: {
		color: '#C65D24',
		fontSize: 42,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	countdown: {
		color: '#fff',
		fontSize: 42,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	menuButton: {
		position: 'absolute',
		top: 4,
		right: 8,
		paddingHorizontal: 8,
		paddingVertical: 4,
		zIndex: 1,
	},
	menuButtonText: {
		color: '#fff',
		fontSize: 28,
		fontWeight: 'bold',
		lineHeight: 28,
	},
});
