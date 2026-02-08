import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Button } from './Button';
import { ExercisePhase } from '@/lib/formatExercisePhase';

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

function parseReps(exercisePhase: ExercisePhase | null): string {
	if (!exercisePhase) {
		return '';
	}

	if (exercisePhase.compound_reps) {
		return exercisePhase.compound_reps.join(' + ');
	}
	return String(exercisePhase.repetitions);
}

function parseWeight(exercisePhase: ExercisePhase | null): string {
	if (!exercisePhase) {
		return '';
	}
	return `@${exercisePhase.weight}kg`;
}

function formatPhaseForDisplay(phase: ExercisePhase): string {
	const sets = phase.sets;
	const reps = phase.compound_reps
		? phase.compound_reps.join(' + ')
		: String(phase.repetitions);
	const weight = `@${phase.weight}kg`;
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
	const reps = parseReps(displayPhase);
	const weight = parseWeight(displayPhase);

	// Set info: if showing next phase, show "1 of X", otherwise show current set
	const setNumber = nextPhase ? 1 : currentSetInPhase;
	const totalSets = displayPhase?.sets || 0;

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
			{/* Top section: Exercise info */}
			<View style={styles.timerTopSection}>
				<Text style={styles.exerciseName}>
					{exerciseName}
				</Text>

				{nextPhase && (
					<Text style={styles.nextPhaseLabel}>Next phase:</Text>
				)}

				{workoutState !== 'idle' && workoutState !== 'workout_done' && (
					<Text style={styles.setInfo}>
						{setNumber} of {totalSets} sets
					</Text>
				)}

				<Text style={styles.reps}>{reps}</Text>
				<Text style={styles.weight}>{weight}</Text>
			</View>

			{/* Bottom section: State and countdown */}
			<View style={styles.timerBottomSection}>
				{workoutState === 'idle' && (
					<Text style={styles.stateIdle}>NOT STARTED</Text>
				)}
				{workoutState === 'work' && (
					<Animated.Text style={[styles.stateWork, { opacity: blinkOpacity }]}>WORKING</Animated.Text>
				)}
				{workoutState === 'rest' && (
					<>
						<Animated.Text style={[styles.stateRest, { opacity: blinkOpacity }]}>RESTING</Animated.Text>
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
		flex: 0.9,
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
		flex: 1,
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
