import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { addDays, startOfWeek, format, getISOWeek, isSameWeek, subDays } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';

interface Workout {
	id: string;
	name: string;
	user_id: string;
	created_at?: string;
	workout_date?: string;
}

interface Exercise {
	id: string;
	name: string;
	workout_id: string;
	created_at?: string;
}

export default function Index() {
	const [workoutName, setWorkoutName] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
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
			if (!user || !supabase) return;
			const fetchWorkouts = async () => {
				if (!supabase) return;
				const { data, error } = await supabase
					.from('workouts')
					.select('*')
					.eq('user_id', user.id)
					.order('created_at', { ascending: false });
				if (!error && data) {
					setWorkouts(data);
					// Fetch exercises for each workout
					await fetchExercises(data);
				}
			};
			fetchWorkouts();
		}, [supabase, user])
	);

	const fetchExercises = async (workoutList: Workout[]) => {
		if (!supabase) return;
		
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
		if (!workoutName.trim()) return;
		if (!supabase) {
			setError('Database not available.');
			return;
		}
		if (!user) {
			setError('You must be signed in to create a workout.');
			return;
		}
		setIsLoading(true);
		setError(null);
		const { error: insertError } = await supabase
			.from('workouts')
			.insert([{ name: workoutName.trim(), user_id: user.id, workout_date: format(selectedDate, 'yyyy-MM-dd') }]);
		setIsLoading(false);
		if (insertError) {
			setError('Failed to create workout. Please try again.');
			return;
		}
		setWorkoutName('');
		// Refetch workouts and exercises after creation
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
			<View style={styles.container}>
				<Text style={styles.title}>Loading...</Text>
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={{ flex: 1 }}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<View style={styles.headerRow}>
						<Text style={styles.title}>Workouts</Text>
						<Pressable onPress={() => router.push('/settings')} style={styles.settingsButton}>
							<Ionicons name="settings-outline" size={24} color="#fff" />
						</Pressable>
					</View>

					<Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
						{format(selectedDate, 'LLLL yyyy')}
					</Text>

					{/* Week Selector with Navigation Arrows */}
					<View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 }}>
						<View style={styles.pickerContainer}>
							<Pressable 
								style={[
									styles.arrowButton,
								]}
								onPress={prevWeek}
							>
								<Text style={[
									styles.arrowText,
								]}>‹</Text>
							</Pressable>
							
							<Text style={styles.pickerText}>
								{getCurrentWeek()}
							</Text>
							
							<Pressable 
								style={styles.arrowButton}
								onPress={nextWeek}
							>
								<Text style={styles.arrowText}>›</Text>
							</Pressable>
						</View>
					</View>

					{/* Week Day Selector */}
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
						{Array.from({ length: 7 }).map((_, i) => {
							const day = addDays(selectedWeekStart, i);
							const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
							
							return (
								<Pressable
									key={i}
									onPress={() => setSelectedDate(day)}
									style={{
										alignItems: 'center',
										flex: 1,
										paddingVertical: 4,
									}}
								>
									<Text
										style={{
											fontWeight: 'bold',
											fontSize: 13,
											letterSpacing: 1,
											textAlign: 'center',
											color: '#fff',
										}}
									>
										{format(day, 'EEE').toUpperCase()}
									</Text>
									<View
										style={{
											backgroundColor: isSelected ? '#fff' : 'rgba(26, 26, 26, 1.00)',
											borderRadius: 20,
											width: 40,
											height: 40,
											alignItems: 'center',
											justifyContent: 'center',
											marginTop: 2,
										}}
									>
										<Text
											style={{
												color: isSelected ? '#000' : '#fff',
												fontWeight: 'bold',
												fontSize: 20,
												textAlign: 'center',
											}}
										>
											{format(day, 'd')}
										</Text>
									</View>
								</Pressable>
							);
						})}
					</View>
					{/* List of created workouts */}
					<View style={{ marginTop: 32 }}>
						<Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
							Workout for {format(selectedDate, 'EEEE, LLLL d')}
						</Text>
						{workouts.filter(w => w.workout_date === format(selectedDate, 'yyyy-MM-dd')).length === 0 ? (
							<Text style={{ color: '#666' }}>No workout yet.</Text>
						) : (
							workouts
								.filter(w => w.workout_date === format(selectedDate, 'yyyy-MM-dd'))
								.map((w) => (
									<View key={w.id} style={{ backgroundColor: '#262626', padding: 16, borderRadius: 8, marginBottom: 12 }}>
										<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: exercises[w.id] && exercises[w.id].length > 0 ? 8 : 0 }}>
											<View style={{ flex: 1 }}>
												<Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{w.name}</Text>
											</View>
											<View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
												<Pressable onPress={() => router.push({ pathname: '/add-exercises', params: { workoutName: w.name, workoutId: w.id } })} style={{ padding: 8 }}>
													<Ionicons name="pencil" size={22} color="#fff" />
												</Pressable>
												<Pressable onPress={() => router.push({ pathname: '/start-workout', params: { workoutName: w.name, workoutId: w.id } })} style={{ padding: 8 }}>
													<Ionicons name="play" size={22} color="#fff" />
												</Pressable>
											</View>
										</View>
										{exercises[w.id] && exercises[w.id].length > 0 && (
											<View style={{ marginTop: 8 }}>
												{exercises[w.id].map((exercise, index) => (
													<Text key={exercise.id} style={{ color: '#C65D24', fontSize: 14, marginTop: 2 }}>
														{index + 1}. {exercise.name}
													</Text>
												))}
											</View>
										)}
									</View>
								))
						)}
					</View>
					<View style={{ marginTop: 'auto' }}>
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
						{error && <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>}
						<Button title={isLoading ? 'Creating...' : 'Create'} onPress={handleCreateWorkout} disabled={isLoading} />
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#171717',
		padding: 20,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 20,
		marginBottom: 16,
	},
	settingsButton: {
		padding: 8,
	},
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#c65d24',
		textTransform: 'uppercase',
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 8,
		marginBottom: 40,
	},
	input: {
		backgroundColor: '#262626',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
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
	pickerArrow: {
		color: '#fff',
		fontSize: 12,
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
	// arrowButtonDisabled: {
	// 	opacity: 0.3,
	// },
	// arrowTextDisabled: {
	// 	color: '#666',
	// },
});
