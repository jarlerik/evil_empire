import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { addDays, startOfWeek, format, getISOWeek, subDays } from 'date-fns';
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
			if (!user || !supabase) {return;}
			const fetchWorkouts = async () => {
				if (!supabase) {return;}
				const { data, error } = await supabase
					.from('workouts')
					.select('*')
					.eq('user_id', user.id)
					.order('created_at', { ascending: false });
				if (!error && data) {
					setWorkouts(data);
					await fetchExercises(data);
				}
			};
			fetchWorkouts();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [supabase, user]),
	);

	const fetchExercises = async (workoutList: Workout[]) => {
		if (!supabase) {return;}

		const exercisesMap: Record<string, Exercise[]> = {};

		for (const workout of workoutList) {
			const { data, error } = await supabase
				.from('exercises')
				.select('*')
				.eq('workout_id', workout.id)
				.order('created_at', { ascending: true });

			if (!error && data) {
				exercisesMap[workout.id] = data;
			}
		}

		setExercises(exercisesMap);
	};

	const handleCreateWorkout = async () => {
		if (!workoutName.trim()) {return;}
		if (!supabase) {
			setErrorState('Database not available.');
			return;
		}
		if (!user) {
			setErrorState('You must be signed in to create a workout.');
			return;
		}
		setIsLoading(true);
		setErrorState(null);
		const { error: insertError } = await supabase
			.from('workouts')
			.insert([{ name: workoutName.trim(), user_id: user.id, workout_date: format(selectedDate, 'yyyy-MM-dd') }]);
		setIsLoading(false);
		if (insertError) {
			setErrorState('Failed to create workout. Please try again.');
			return;
		}
		setWorkoutName('');
		const { data, error } = await supabase
			.from('workouts')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });
		if (!error && data) {
			setWorkouts(data);
			await fetchExercises(data);
		}
	};

	if (authLoading || settingsLoading) {
		return (
			<View style={commonStyles.container}>
				<Text style={commonStyles.title}>Loading...</Text>
			</View>
		);
	}

	const filteredWorkouts = workouts.filter(w => w.workout_date === format(selectedDate, 'yyyy-MM-dd'));

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
							/>

							<View style={styles.workoutsSection}>
								<Text style={styles.workoutDateTitle}>
									Workout for {format(selectedDate, 'EEEE, LLLL d')}
								</Text>
								{filteredWorkouts.length === 0 ? (
									<Text style={styles.noWorkoutText}>No workout yet.</Text>
								) : (
									filteredWorkouts.map((w) => (
										<WorkoutCard
											key={w.id}
											workout={w}
											exercises={exercises[w.id] || []}
											onEdit={() => router.push({ pathname: '/add-exercises', params: { workoutName: w.name, workoutId: w.id } })}
											onStart={() => router.push({ pathname: '/start-workout', params: { workoutName: w.name, workoutId: w.id } })}
										/>
									))
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
