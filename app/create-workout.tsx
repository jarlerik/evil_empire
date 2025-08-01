import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { addDays, startOfWeek, format, isToday, getISOWeek, isSameWeek } from 'date-fns';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';

interface Workout {
	id: string;
	name: string;
	user_id: string;
	created_at?: string;
	workout_date?: string;
}

export default function CreateWorkout() {
	const [workoutName, setWorkoutName] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { user } = useAuth();
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [selectedDate, setSelectedDate] = useState<Date>(new Date());
	const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

	// Helper to get week options
	const weekOptions = Array.from({ length: 12 }).map((_, i) => {
		const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i * 7);
		return {
			label: `Week ${getISOWeek(weekStart)}`,
			value: format(weekStart, 'yyyy-MM-dd'),
			weekStart,
		};
	});

	// When week changes, update selectedDate
	const handleWeekChange = (weekStartStr: string) => {
		const weekStart = new Date(weekStartStr);
		setSelectedWeekStart(weekStart);
		// If current week, highlight today; else, highlight Monday
		if (isSameWeek(new Date(), weekStart, { weekStartsOn: 1 })) {
			setSelectedDate(new Date());
		} else {
			setSelectedDate(weekStart);
		}
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
				if (!error && data) setWorkouts(data);
			};
			fetchWorkouts();
		}, [supabase, user])
	);

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
		// Refetch workouts after creation
		const { data, error } = await supabase
			.from('workouts')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });
		if (!error && data) setWorkouts(data);
	};

	const handleDeleteWorkout = async (id: string) => {
		if (!supabase) return;
		setDeletingId(id);
		await supabase.from('workouts').delete().eq('id', id);
		setDeletingId(null);
		// Refetch workouts after deletion
		if (!user) return;
		const { data, error } = await supabase
			.from('workouts')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });
		if (!error && data) setWorkouts(data);
	};

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
					<Text style={styles.title}>{'Workouts'}</Text>

					<Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
						{format(selectedDate, 'LLLL')}
					</Text>

					{/* Week Selector Dropdown */}
					<View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 }}>
						<View style={styles.pickerContainer}>
							<Picker
								selectedValue={format(selectedWeekStart, 'yyyy-MM-dd')}
								onValueChange={handleWeekChange}
								style={styles.picker}
								dropdownIconColor="#fff"
								itemStyle={styles.pickerItem}
								mode="dropdown"
							>
								{weekOptions.map((opt) => (
									<Picker.Item key={opt.value} label={opt.label} value={opt.value} />
								))}
							</Picker>
						</View>
					</View>

					{/* Week Day Selector */}
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
						{Array.from({ length: 7 }).map((_, i) => {
							const day = addDays(selectedWeekStart, i);
							const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
							const isPast = day < new Date(new Date().setHours(0, 0, 0, 0)); // compare to today at midnight

							return (
								<Pressable
									key={i}
									onPress={isPast ? undefined : () => setSelectedDate(day)}
									disabled={isPast}
									style={{
										alignItems: 'center',
										flex: 1,
										paddingVertical: 4,
										opacity: isPast ? 0.5 : 1, // visually indicate disabled
									}}
								>
									<Text
										style={{
											color: isPast ? '#ccc' : '#fff',
											fontWeight: 'bold',
											fontSize: 13,
											letterSpacing: 1,
											textAlign: 'center',
										}}
									>
										{format(day, 'EEE').toUpperCase()}
									</Text>
									<View
										style={{
											backgroundColor: isSelected ? '#fff' : 'transparent',
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
												color: isPast ? '#ccc' : isSelected ? '#000' : '#fff',
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
									<View key={w.id} style={{ backgroundColor: '#111', padding: 16, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
										<View style={{ flex: 1 }}>
											<Text style={{ color: '#fff', fontSize: 16 }}>{w.name}</Text>
										</View>
										<View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
											<Pressable onPress={() => router.push({ pathname: '/add-exercises', params: { workoutName: w.name, workoutId: w.id } })} style={{ padding: 8 }}>
												<Ionicons name="pencil" size={22} color="#fff" />
											</Pressable>
										</View>
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
						<Pressable style={styles.button} onPress={handleCreateWorkout} disabled={isLoading}>
							<Text style={styles.buttonText}>{isLoading ? 'Creating...' : 'Create'}</Text>
						</Pressable>
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
		padding: 20,
	},
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: '#fff',
		marginTop: 8,
		marginBottom: 16,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 16,
		color: '#666',
		marginTop: 8,
		marginBottom: 40,
	},
	input: {
		backgroundColor: '#111',
		color: '#fff',
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
	},
	button: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	pickerContainer: {
		width: 140,
		backgroundColor: '#111',
		borderRadius: 8,
		overflow: 'hidden',
	},
	picker: {
		color: '#fff',
		backgroundColor: 'transparent',
		height: 40,
		fontSize: 16,
		fontWeight: 'bold',
	},
	pickerItem: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
		backgroundColor: '#111',
	},
});
