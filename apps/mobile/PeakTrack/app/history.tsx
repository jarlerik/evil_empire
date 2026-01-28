import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { format, parseISO, subDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { commonStyles, colors } from '../styles/common';
import { fetchRecentExecutionLogs } from '../services/workoutExecutionLogService';
import { fetchWorkoutsByIds } from '../services/workoutService';
import { fetchExercisesByWorkoutIds } from '../services/exerciseService';
import { Exercise, Workout } from '../types/workout';
import { WorkoutCard } from '../components/WorkoutCard';
import { NavigationBar } from '../components/NavigationBar';

interface CompletedWorkout {
	workout: Workout;
	exercises: Exercise[];
	executedAt: string;
}

export default function History() {
	const { user, loading: authLoading } = useAuth();
	const { loading: settingsLoading } = useUserSettings();
	const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorState, setErrorState] = useState<string | null>(null);

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	useFocusEffect(
		useCallback(() => {
			if (!user) {return;}
			const fetchCompletedWorkouts = async () => {
				setIsLoading(true);
				setErrorState(null);

				const cutoffDate = subDays(new Date(), 30).toISOString();

				// Fetch execution logs from the last 30 days
				const { data: logs, error: logsError } = await fetchRecentExecutionLogs(cutoffDate);

				if (logsError) {
					setErrorState('Failed to load workout history.');
					setCompletedWorkouts([]);
					setIsLoading(false);
					return;
				}

				if (!logs || logs.length === 0) {
					setCompletedWorkouts([]);
					setIsLoading(false);
					return;
				}

				// Group by workout_id, keeping the most recent executed_at per workout
				const workoutMap = new Map<string, string>();
				for (const log of logs) {
					if (!workoutMap.has(log.workout_id)) {
						workoutMap.set(log.workout_id, log.executed_at);
					}
				}

				const workoutIds = [...workoutMap.keys()];

				// Fetch workout details
				const { data: workouts, error: workoutsError } = await fetchWorkoutsByIds(workoutIds, user.id);

				if (workoutsError || !workouts) {
					setErrorState('Failed to load workout details.');
					setCompletedWorkouts([]);
					setIsLoading(false);
					return;
				}

				// Fetch exercises for all workouts
				const { data: allExercises } = await fetchExercisesByWorkoutIds(workoutIds);

				// Combine into CompletedWorkout[], sorted by most recent execution
				const completed: CompletedWorkout[] = workoutIds
					.map((id) => {
						const workout = workouts.find((w) => w.id === id);
						if (!workout) {return null;}
						return {
							workout,
							exercises: (allExercises ?? []).filter((e) => e.workout_id === id),
							executedAt: workoutMap.get(id)!,
						};
					})
					.filter((entry): entry is CompletedWorkout => entry !== null);

				setCompletedWorkouts(completed);
				setIsLoading(false);
			};
			fetchCompletedWorkouts();
		}, [user]),
	);

	if (authLoading || settingsLoading || isLoading) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.title}>Loading...</Text>
			</View>
		);
	}

	return (
		<View style={styles.screen}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Text style={commonStyles.title}>History</Text>
					</View>
					<Text style={styles.subtitle}>Completed workouts in the last 30 days</Text>
					{errorState && <Text style={styles.errorText}>{errorState}</Text>}
					{!errorState && completedWorkouts.length === 0 && (
						<Text style={styles.emptyText}>No completed workouts in the last 30 days.</Text>
					)}
					{completedWorkouts.map(({ workout, exercises, executedAt }) => {
						const dateLabel = format(parseISO(executedAt), 'EEEE, LLLL d');
						return (
							<View key={workout.id} style={styles.cardSection}>
								<Text style={styles.dateText}>{dateLabel}</Text>
								<WorkoutCard
									workout={workout}
									exercises={exercises}
									isReadOnly
									onEdit={() => router.push({ pathname: '/add-exercises', params: { workoutName: workout.name, workoutId: workout.id } })}
									onStart={() => router.push({ pathname: '/start-workout', params: { workoutName: workout.name, workoutId: workout.id } })}
								/>
							</View>
						);
					})}
				</View>
			</ScrollView>
			<NavigationBar />
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
	},
	headerRow: {
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	subtitle: {
		fontSize: 18,
		color: colors.text,
		marginBottom: 12,
	},
	cardSection: {
		marginTop: 12,
	},
	dateText: {
		color: colors.textMuted,
		marginBottom: 8,
	},
	emptyText: {
		color: colors.textMuted,
		marginTop: 12,
	},
	errorText: {
		color: 'red',
		marginTop: 12,
	},
});
