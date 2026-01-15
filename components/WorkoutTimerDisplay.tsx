import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Button } from './Button';
import { ExercisePhase } from '@/lib/formatExercisePhase';

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

interface WorkoutTimerDisplayProps {
	workoutState: WorkoutState;
	exerciseName: string | undefined;
	exercisePhase: ExercisePhase | null;
	restTimeRemaining: number;
	blinkOpacity: Animated.Value;
	onEditFinishedExercise: () => void;
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseSetsAndReps(exercisePhase: ExercisePhase | null): string {
	if (!exercisePhase) {
		return '';
	}
	const sets = exercisePhase.sets;

	if (exercisePhase.compound_reps) {
		const reps = exercisePhase.compound_reps.join(' + ');
		return `${sets} x ${reps}`;
	}
	const reps = exercisePhase.repetitions;
	return `${sets} x ${reps}`;
}

function parseWeight(exercisePhase: ExercisePhase | null): string {
	if (!exercisePhase) {
		return '';
	}
	return `@${exercisePhase.weight}kg`;
}
export function WorkoutTimerDisplay({
	workoutState,
	exerciseName,
	exercisePhase,
	restTimeRemaining,
	blinkOpacity,
	onEditFinishedExercise,
}: WorkoutTimerDisplayProps) {

	const setsAndReps = parseSetsAndReps(exercisePhase);
	const weight = parseWeight(exercisePhase);
	return (
		<View style={styles.timerContainer}>
			{/* Top half: Exercise name, set number, repetitions */}
			<View style={styles.timerTopHalf}>
				<Text style={styles.timerExerciseName}>
					{exerciseName}
				</Text>
				<Text style={styles.timerRepetitions}>
					{setsAndReps}
				</Text>
				<Text style={styles.timerWeight}>{weight}</Text>
			</View>

			{/* Bottom half: State and countdown */}
			<View style={styles.timerBottomHalf}>
				{workoutState === 'idle' && (
					<Text style={styles.timerStateIdle}>NOT STARTED</Text>
				)}
				{workoutState === 'work' && (
					<Animated.Text style={[styles.timerStateWork, { opacity: blinkOpacity }]}>WORKING</Animated.Text>
				)}
				{workoutState === 'rest' && (
					<>
						<Animated.Text style={[styles.timerStateRest, { opacity: blinkOpacity }]}>RESTING</Animated.Text>
						<Animated.Text style={[styles.timerCountdown, { opacity: blinkOpacity }]}>
							{formatTime(restTimeRemaining)}
						</Animated.Text>
					</>
				)}
				{workoutState === 'exercise_done' && (
					<>
						<Text
							style={styles.timerStateDone}
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
					</>
				)}
				{workoutState === 'workout_done' && (
					<Text
						style={styles.timerStateDone}
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
	timerTopHalf: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	timerBottomHalf: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		width: '100%',
	},
	timerExerciseName: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 12,
	},
	timerRepetitions: {
		color: '#C65D24',
		fontSize: 24,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerWeight: {
		color: '#C65D24',
		fontSize: 36,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerStateIdle: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerStateWork: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerStateRest: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 12,
	},
	timerStateDone: {
		color: '#C65D24',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	timerCountdown: {
		color: '#fff',
		fontSize: 48,
		fontWeight: 'bold',
		textAlign: 'center',
	},
});
