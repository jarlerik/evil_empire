import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Button } from './Button';
import { ExercisePhase } from '@/lib/formatExercisePhase';
import { interpolateWeight } from '@/lib/interpolateWeight';

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

function parseWeight(exercisePhase: ExercisePhase | null, currentSet: number, totalSets: number): string {
	if (!exercisePhase) {
		return '';
	}

	if (exercisePhase.weight_min != null && exercisePhase.weight_max != null && exercisePhase.weight_min !== exercisePhase.weight_max) {
		const weight = interpolateWeight(exercisePhase.weight_min, exercisePhase.weight_max, currentSet, totalSets);
		return `@${weight}kg`;
	}

	// Wave with multiple weights: map set index to weight group
	if (exercisePhase.exercise_type === 'wave' && exercisePhase.weights && exercisePhase.weights.length > 1 && exercisePhase.compound_reps) {
		const repsPerWeight = exercisePhase.compound_reps.length / exercisePhase.weights.length;
		const weightIdx = Math.floor((currentSet - 1) / repsPerWeight);
		const weight = exercisePhase.weights[weightIdx] ?? exercisePhase.weights[exercisePhase.weights.length - 1];
		return `@${weight}kg`;
	}

	if (exercisePhase.weights && exercisePhase.weights.length > 1) {
		const weight = exercisePhase.weights[currentSet - 1] ?? exercisePhase.weights[exercisePhase.weights.length - 1];
		return `@${weight}kg`;
	}

	return `@${exercisePhase.weight}kg`;
}

function formatPhaseForDisplay(phase: ExercisePhase): string {
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
			weightStr = phase.weights.map(w => `${w}`).join(', ') + 'kg';
		} else {
			weightStr = `${phase.weight}kg`;
		}
		return `${repsStr} @${weightStr}`;
	}

	const sets = phase.sets;
	const reps = phase.compound_reps
		? phase.compound_reps.join(' + ')
		: String(phase.repetitions);
	const weight = (phase.weight_min != null && phase.weight_max != null && phase.weight_min !== phase.weight_max)
		? `@${phase.weight_min}-${phase.weight_max}kg`
		: `@${phase.weight}kg`;
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
}: WorkoutTimerDisplayProps) {

	// Determine which phase to display (current or next)
	const displayPhase = nextPhase || exercisePhase;
	const circuitExercises = parseCircuitExercises(displayPhase);
	const isCircuit = circuitExercises && circuitExercises.length > 0;
	const reps = parseReps(displayPhase, nextPhase ? 1 : currentSetInPhase);

	// Set info: if showing next phase, show "1 of X", otherwise show current set
	const setNumber = nextPhase ? 1 : currentSetInPhase;
	const totalSets = displayPhase?.sets || 0;
	const weight = parseWeight(displayPhase, setNumber, totalSets);

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
								{formatPhaseForDisplay(phase)}
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
				{nextPhase ? (
					<Text style={styles.nextPhaseLabel}>Next phase:</Text>
				) : workoutState === 'rest' ? (
					<Text style={styles.nextPhaseLabel}>Next set:</Text>
				) : null}

				{workoutState !== 'idle' && workoutState !== 'workout_done' && (
					<Text style={styles.setInfo}>
						{setNumber} of {totalSets} {isCircuit ? 'rounds' : 'sets'}
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
						<Animated.Text style={[styles.stateWork, { opacity: blinkOpacity }]}>WORKING</Animated.Text>
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
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
		overflow: 'hidden',
	},
	timerTopSection: {
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	timerBottomSection: {
		flex: 1,
		justifyContent: 'center',
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
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 8,
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
		fontSize: 18,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	setInfo: {
		color: '#fff',
		fontSize: 20,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 4,
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
		fontSize: 32,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	weight: {
		color: '#C65D24',
		fontSize: 32,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateIdle: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateWork: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateRest: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	stateDone: {
		color: '#C65D24',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	countdown: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
});
