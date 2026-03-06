import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { fetchWorkoutsByUserId, createWorkout, updateWorkoutDate } from '../services/workoutService';
import { fetchExercisesByWorkoutId } from '../services/exerciseService';
import { fetchCompletedWorkoutIds } from '../services/workoutExecutionLogService';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { addDays, startOfWeek, format, getISOWeek, subDays, isBefore, startOfDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';
import { WorkoutCard } from '../components/WorkoutCard';
import { WeekDaySelector } from '../components/WeekDaySelector';
import { commonStyles } from '../styles/common';
import { Exercise, Workout } from '../types/workout';
import { NavigationBar } from '../components/NavigationBar';

export default function Index() {
	const [workoutName, setWorkoutName] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [errorState, setErrorState] = useState<string | null>(null);
	const { user, loading: authLoading } = useAuth();
	const { loading: settingsLoading } = useUserSettings();

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [exercises, setExercises] = useState<Record<string, Exercise[]>>({});
	const [completedWorkoutIds, setCompletedWorkoutIds] = useState<Set<string>>(new Set());
	const [selectedDate, setSelectedDate] = useState<Date>(new Date());
	const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

	const getCurrentWeek = () => {
		return `Week ${getISOWeek(selectedWeekStart)}`;
	};

	const nextWeek = () => {
		const nextStart = addDays(selectedWeekStart, 7);
		setSelectedWeekStart(nextStart);
		setSelectedDate(nextStart);
	};

	const prevWeek = () => {
		const prevStart = subDays(selectedWeekStart, 7);
		setSelectedWeekStart(prevStart);
		setSelectedDate(prevStart);
	};

	useFocusEffect(
		useCallback(() => {
			if (!user) {return;}
			const fetchWorkouts = async () => {
				const { data, error } = await fetchWorkoutsByUserId(user.id);
				if (!error && data) {
					setWorkouts(data);
					await fetchExercises(data);
					const ids = data.map((w) => w.id);
					const { data: completed } = await fetchCompletedWorkoutIds(ids);
					if (completed) {
						setCompletedWorkoutIds(new Set(completed));
					}
				}
			};
			fetchWorkouts();

		}, [user]),
	);

	const fetchExercises = async (workoutList: Workout[]) => {
		const exercisesMap: Record<string, Exercise[]> = {};

		for (const workout of workoutList) {
			const { data, error } = await fetchExercisesByWorkoutId(workout.id);

			if (!error && data) {
				exercisesMap[workout.id] = data;
			}
		}

		setExercises(exercisesMap);
	};

	const handleCreateWorkout = async () => {
		if (!workoutName.trim()) {return;}
		if (!user) {
			setErrorState('You must be signed in to create a workout.');
			return;
		}
		setIsLoading(true);
		setErrorState(null);
		const trimmedName = workoutName.trim();
		const { data: newWorkout, error: insertError } = await createWorkout(trimmedName, user.id, format(selectedDate, 'yyyy-MM-dd'));
		setIsLoading(false);
		if (insertError || !newWorkout) {
			setErrorState('Failed to create workout. Please try again.');
			return;
		}
		setWorkoutName('');
		router.push({ pathname: '/add-exercises', params: { workoutName: newWorkout.name, workoutId: newWorkout.id } });
	};

	if (authLoading || settingsLoading) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.title}>Loading...</Text>
			</View>
		);
	}

	const todayStr = format(new Date(), 'yyyy-MM-dd');
	const filteredWorkouts = workouts.filter(w => w.workout_date === format(selectedDate, 'yyyy-MM-dd'));

	const handleMoveToToday = async (workoutId: string) => {
		const { error } = await updateWorkoutDate(workoutId, todayStr);
		if (!error) {
			setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, workout_date: todayStr } : w));
			setSelectedDate(new Date());
			setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
		}
	};

	const today = startOfDay(new Date());
	const dayStatuses: Record<string, 'completed' | 'missed'> = {};
	for (const w of workouts) {
		const dateKey = w.workout_date;
		if (!dateKey) continue;
		const workoutDay = startOfDay(new Date(dateKey + 'T00:00:00'));
		if (completedWorkoutIds.has(w.id)) {
			dayStatuses[dateKey] = 'completed';
		} else if (isBefore(workoutDay, today)) {
			if (dayStatuses[dateKey] !== 'completed') {
				dayStatuses[dateKey] = 'missed';
			}
		}
	}

		return (
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.flex}>
					<ScrollView
						contentContainerStyle={styles.scrollContent}
						keyboardShouldPersistTaps="handled"
					>
						<View style={commonStyles.container}>
							<View style={[commonStyles.headerRow, styles.headerRow]}>
								<Text style={commonStyles.title}>Workouts</Text>
							</View>

							<Text style={styles.monthTitle}>
								{format(selectedDate, 'LLLL yyyy')}
							</Text>

							<View style={styles.weekSelectorContainer}>
								<View style={styles.pickerContainer}>
									<Pressable style={styles.arrowButton} onPress={prevWeek}>
										<Text style={styles.arrowText}>‹</Text>
									</Pressable>
									<Text style={styles.pickerText}>{getCurrentWeek()}</Text>
									<Pressable style={styles.arrowButton} onPress={nextWeek}>
										<Text style={styles.arrowText}>›</Text>
									</Pressable>
								</View>
							</View>

							<WeekDaySelector
								weekStart={selectedWeekStart}
								selectedDate={selectedDate}
								onSelectDate={setSelectedDate}
								dayStatuses={dayStatuses}
							/>

							<View style={styles.workoutsSection}>
								<Text style={styles.workoutDateTitle}>
									Workout for {format(selectedDate, 'EEEE, LLLL d')}
								</Text>
								{filteredWorkouts.length === 0 ? (
									<Text style={styles.noWorkoutText}>No workout yet.</Text>
								) : (
									filteredWorkouts.map((w) => {
										const isMissed = !completedWorkoutIds.has(w.id) && !!w.workout_date && w.workout_date < todayStr;
										return (
										<WorkoutCard
											key={w.id}
											workout={w}
											exercises={exercises[w.id] || []}
											isCompleted={completedWorkoutIds.has(w.id)}
											isMissed={isMissed}
											onMoveToToday={isMissed ? () => handleMoveToToday(w.id) : undefined}
											onEdit={() => router.push({ pathname: '/add-exercises', params: { workoutName: w.name, workoutId: w.id } })}
											onStart={() => router.push({ pathname: '/start-workout', params: { workoutName: w.name, workoutId: w.id } })}
										/>
										);
									})
								)}
							</View>
							<View style={styles.bottomSection}>
								<TextInput
									style={styles.input}
									value={workoutName}
									onChangeText={setWorkoutName}
									placeholder="Workout name"
									placeholderTextColor="#666"
									returnKeyType="done"
									onSubmitEditing={handleCreateWorkout}
									editable={!isLoading}
								/>
								{errorState && <Text style={styles.errorText}>{errorState}</Text>}
								<Button title={isLoading ? 'Creating...' : 'Create'} onPress={handleCreateWorkout} disabled={isLoading} />
							</View>
						</View>
					</ScrollView>
					<NavigationBar />
				</View>
			</KeyboardAvoidingView>
		);
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
	},
	headerRow: {
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	input: {
		backgroundColor: '#262626',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
	},
	monthTitle: {
		color: '#fff',
		fontSize: 28,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	weekSelectorContainer: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		marginBottom: 8,
	},
	pickerContainer: {
		width: 160,
		backgroundColor: '#262626',
		borderRadius: 8,
		padding: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: 40,
	},
	pickerText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
		lineHeight: 16,
		textAlignVertical: 'center',
		includeFontPadding: false,
	},
	arrowButton: {
		padding: 4,
		backgroundColor: 'transparent',
		borderRadius: 16,
		width: 24,
		height: 24,
		alignItems: 'center',
		justifyContent: 'center',
		display: 'flex',
	},
	arrowText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
		lineHeight: 18,
		textAlignVertical: 'center',
		includeFontPadding: false,
	},
	workoutsSection: {
		marginTop: 32,
	},
	workoutDateTitle: {
		color: '#fff',
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 12,
	},
	noWorkoutText: {
		color: '#666',
	},
	bottomSection: {
		marginTop: 'auto',
	},
	errorText: {
		color: 'red',
		marginBottom: 10,
	},
});
