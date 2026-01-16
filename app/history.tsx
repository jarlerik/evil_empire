import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { format, parseISO, subDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { supabase } from '../lib/supabase';
import { commonStyles, colors } from '../styles/common';
import { Exercise, Workout } from '../types/workout';
import { WorkoutCard } from '../components/WorkoutCard';
import { NavigationBar } from '../components/NavigationBar';

export default function History() {
	const { user, loading: authLoading } = useAuth();
	const { loading: settingsLoading } = useUserSettings();
	const [workout, setWorkout] = useState<Workout | null>(null);
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorState, setErrorState] = useState<string | null>(null);

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	useFocusEffect(
		useCallback(() => {
			if (!user || !supabase) {return;}
			const fetchLatestWorkout = async () => {
				if (!supabase) {
					setWorkout(null);
					setExercises([]);
					return;
				}
				setIsLoading(true);
				setErrorState(null);
				const cutoffDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
				const { data, error } = await supabase
					.from('workouts')
					.select('*')
					.eq('user_id', user.id)
					.gte('workout_date', cutoffDate)
					.order('workout_date', { ascending: false })
					.limit(1);
				if (error) {
					setErrorState('Failed to load workout history.');
					setWorkout(null);
					setExercises([]);
					setIsLoading(false);
					return;
				}
				if (!data || data.length === 0) {
					setWorkout(null);
					setExercises([]);
					setIsLoading(false);
					return;
				}
				const latestWorkout = data[0];
				if (!supabase) {
					setWorkout(latestWorkout);
					setExercises([]);
					setIsLoading(false);
					return;
				}
				const { data: exerciseData } = await supabase
					.from('exercises')
					.select('*')
					.eq('workout_id', latestWorkout.id)
					.order('created_at', { ascending: true });
				setWorkout(latestWorkout);
				setExercises(exerciseData ?? []);
				setIsLoading(false);
			};
			fetchLatestWorkout();
		}, [user]),
	);

	if (authLoading || settingsLoading || isLoading) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.title}>Loading...</Text>
			</View>
		);
	}

	const workoutDateLabel = workout?.workout_date
		? format(parseISO(workout.workout_date), 'EEEE, LLLL d')
		: workout?.created_at
			? format(parseISO(workout.created_at), 'EEEE, LLLL d')
			: null;

	return (
		<View style={styles.screen}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Text style={commonStyles.title}>History</Text>
					</View>
					<Text style={styles.subtitle}>Last workout in the past 30 days</Text>
					{errorState && <Text style={styles.errorText}>{errorState}</Text>}
					{!errorState && !workout && (
						<Text style={styles.emptyText}>No workouts logged in the last 30 days.</Text>
					)}
					{workout && (
						<View style={styles.cardSection}>
							{workoutDateLabel && (
								<Text style={styles.dateText}>{workoutDateLabel}</Text>
							)}
							<WorkoutCard
								workout={workout}
								exercises={exercises}
								isReadOnly
								onEdit={() => router.push({ pathname: '/add-exercises', params: { workoutName: workout.name, workoutId: workout.id } })}
								onStart={() => router.push({ pathname: '/start-workout', params: { workoutName: workout.name, workoutId: workout.id } })}
							/>
						</View>
					)}
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
