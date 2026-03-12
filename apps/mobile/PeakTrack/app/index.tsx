import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { fetchWorkoutsByUserId, createWorkout, deleteWorkout, updateWorkoutDate } from '../services/workoutService';
import { fetchExercisesByWorkoutId, createExercise } from '../services/exerciseService';
import { fetchPhasesByExerciseId } from '../services/exercisePhaseService';
import { fetchCompletedWorkoutIds } from '../services/workoutExecutionLogService';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { addDays, startOfWeek, format, getISOWeek, subDays, isBefore, startOfDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';
import { ExerciseItem } from '../components/ExerciseItem';
import { WeekDaySelector } from '../components/WeekDaySelector';
import { commonStyles, colors } from '../styles/common';
import { Exercise, Workout } from '../types/workout';
import { ExercisePhase } from '../lib/formatExercisePhase';
import { NavigationBar } from '../components/NavigationBar';
import { LoadScreen } from './components/LoadScreen';

export default function Index() {
	const [exerciseName, setExerciseName] = useState('');
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
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});
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

	const fetchExercisePhasesForList = async (exerciseList: Exercise[]) => {
		const phasesMap: Record<string, ExercisePhase[]> = {};
		for (const exercise of exerciseList) {
			const { data, error } = await fetchPhasesByExerciseId(exercise.id);
			if (!error && data) {
				phasesMap[exercise.id] = data;
			}
		}
		return phasesMap;
	};

	useFocusEffect(
		useCallback(() => {
			if (!user) {return;}
			const fetchWorkouts = async () => {
				const { data, error } = await fetchWorkoutsByUserId(user.id);
				if (!error && data) {
					setWorkouts(data);

					// Fetch exercises and phases for all workouts
					const exercisesMap: Record<string, Exercise[]> = {};
					const allPhasesMap: Record<string, ExercisePhase[]> = {};

					for (const workout of data) {
						const { data: exData, error: exError } = await fetchExercisesByWorkoutId(workout.id);
						if (!exError && exData) {
							exercisesMap[workout.id] = exData;
							const phases = await fetchExercisePhasesForList(exData);
							Object.assign(allPhasesMap, phases);
						}
					}

					setExercises(exercisesMap);
					setExercisePhases(allPhasesMap);

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

	const filteredWorkouts = workouts.filter(w => w.workout_date === format(selectedDate, 'yyyy-MM-dd'));
	const workoutForSelectedDate = filteredWorkouts[0] ?? null;
	const currentExercises = workoutForSelectedDate ? (exercises[workoutForSelectedDate.id] || []) : [];
	const hasExercises = currentExercises.length > 0;

	const handleAddExercise = async () => {
		if (!exerciseName.trim()) {return;}
		if (!user) {
			setErrorState('You must be signed in to add an exercise.');
			return;
		}
		setIsLoading(true);
		setErrorState(null);

		let workoutId = workoutForSelectedDate?.id;

		// Auto-create workout if none exists for this date
		if (!workoutId) {
			const autoName = `Workout - ${format(selectedDate, 'MMM d')}`;
			const { data: newWorkout, error: createError } = await createWorkout(autoName, user.id, format(selectedDate, 'yyyy-MM-dd'));
			if (createError || !newWorkout) {
				setErrorState('Failed to create workout. Please try again.');
				setIsLoading(false);
				return;
			}
			setWorkouts(prev => [newWorkout, ...prev]);
			setExercises(prev => ({ ...prev, [newWorkout.id]: [] }));
			workoutId = newWorkout.id;
		}

		const trimmedName = exerciseName.trim();
		const { data: newExercise, error: exerciseError } = await createExercise(trimmedName, workoutId);

		if (exerciseError || !newExercise) {
			setErrorState('Failed to add exercise. Please try again.');
			setIsLoading(false);
			return;
		}

		setExercises(prev => ({
			...prev,
			[workoutId]: [...(prev[workoutId] || []), newExercise],
		}));
		setExerciseName('');
		setIsLoading(false);

		router.push({
			pathname: '/edit-exercise',
			params: { exerciseId: newExercise.id, exerciseName: trimmedName },
		});
	};

	const handleDeleteWorkout = () => {
		if (!workoutForSelectedDate) {return;}
		Alert.alert(
			'Delete workout',
			'Are you sure you want to delete this workout and all its exercises?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						const { error } = await deleteWorkout(workoutForSelectedDate.id);
						if (!error) {
							setWorkouts(prev => prev.filter(w => w.id !== workoutForSelectedDate.id));
							setExercises(prev => {
								const next = { ...prev };
								delete next[workoutForSelectedDate.id];
								return next;
							});
						}
					},
				},
			],
		);
	};

	const handleMoveToToday = async (workoutId: string) => {
		const todayStr = format(new Date(), 'yyyy-MM-dd');
		const { error } = await updateWorkoutDate(workoutId, todayStr);
		if (!error) {
			setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, workout_date: todayStr } : w));
			setSelectedDate(new Date());
			setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
		}
	};

	if (authLoading || settingsLoading) {
		return <LoadScreen />;
	}

	const todayStr = format(new Date(), 'yyyy-MM-dd');

	const today = startOfDay(new Date());
	const dayStatuses: Record<string, 'completed' | 'missed' | 'planned'> = {};
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
		} else {
			if (!dayStatuses[dateKey]) {
				dayStatuses[dateKey] = 'planned';
			}
		}
	}

	const isMissed = workoutForSelectedDate && !completedWorkoutIds.has(workoutForSelectedDate.id) && !!workoutForSelectedDate.workout_date && workoutForSelectedDate.workout_date < todayStr;

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
							<View style={[commonStyles.headerRow, styles.headerRow, { justifyContent: 'center' }]}>
								<Text style={commonStyles.title}>PEAKTRACK</Text>
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
								<View style={styles.dateTitleRow}>
									<Text style={styles.workoutDateTitle}>
										Workout for {format(selectedDate, 'EEEE, LLLL d')}
									</Text>
									<View style={styles.dateTitleActions}>
										{workoutForSelectedDate && hasExercises && (
											<Pressable
												onPress={() => router.push({ pathname: '/start-workout', params: { workoutName: workoutForSelectedDate.name, workoutId: workoutForSelectedDate.id } })}
												style={styles.iconButton}
											>
												<Ionicons name="stopwatch-outline" size={22} color="#fff" />
											</Pressable>
										)}
										{workoutForSelectedDate && (
											<Pressable
												onPress={handleDeleteWorkout}
												style={styles.iconButton}
											>
												<Text style={styles.deleteButtonText}>×</Text>
											</Pressable>
										)}
										{isMissed && (
											<Pressable
												onPress={() => handleMoveToToday(workoutForSelectedDate!.id)}
												style={styles.iconButton}
											>
												<Ionicons name="arrow-forward-outline" size={22} color="#fff" />
											</Pressable>
										)}
									</View>
								</View>

								{!workoutForSelectedDate || !hasExercises ? (
									<Text style={styles.noWorkoutText}>No exercises yet.</Text>
								) : (
									currentExercises.map((exercise) => (
										<ExerciseItem
											key={exercise.id}
											exercise={exercise}
											phases={exercisePhases[exercise.id] || []}
											onEdit={() => router.push({ pathname: '/edit-exercise', params: { exerciseId: exercise.id, exerciseName: exercise.name } })}
										/>
									))
								)}
							</View>

							<View style={styles.bottomSection}>
								<TextInput
									style={styles.input}
									value={exerciseName}
									onChangeText={setExerciseName}
									placeholder="Exercise name"
									placeholderTextColor="#666"
									returnKeyType="done"
									onSubmitEditing={handleAddExercise}
									editable={!isLoading}
								/>
								{errorState && <Text style={styles.errorText}>{errorState}</Text>}
								<Button title={isLoading ? 'Adding...' : 'Add exercise'} onPress={handleAddExercise} disabled={isLoading} />
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
	dateTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	dateTitleActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	workoutDateTitle: {
		color: '#fff',
		fontSize: 20,
		fontWeight: 'bold',
		flex: 1,
	},
	iconButton: {
		padding: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	deleteButtonText: {
		color: '#666',
		fontSize: 24,
		lineHeight: 24,
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
