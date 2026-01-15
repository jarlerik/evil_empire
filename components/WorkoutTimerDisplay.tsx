import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Button } from './Button';

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

interface WorkoutTimerDisplayProps {
	workoutState: WorkoutState;
	currentSetNumber: number;
	totalSets: number;
	exerciseName: string;
	repetitions: number;
	restTimeRemaining: number;
	blinkOpacity: Animated.Value;
	onEditFinishedExercise: () => void;
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function WorkoutTimerDisplay({
	workoutState,
	currentSetNumber,
	totalSets,
	exerciseName,
	repetitions,
	restTimeRemaining,
	blinkOpacity,
	onEditFinishedExercise,
}: WorkoutTimerDisplayProps) {
	if (workoutState === 'idle') {
		return null;
	}

	return (
		<View style={styles.timerContainer}>
			{/* Top half: Exercise name, set number, repetitions */}
			<View style={styles.timerTopHalf}>
				<Text style={styles.timerExerciseName}>
					{currentSetNumber}/{totalSets} {exerciseName}
				</Text>
				<Text style={styles.timerRepetitions}>
					{repetitions} {repetitions === 1 ? 'repetition' : 'repetitions'}
				</Text>
			</View>

			{/* Bottom half: State and countdown */}
			<View style={styles.timerBottomHalf}>
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
		color: '#fff',
		fontSize: 18,
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
