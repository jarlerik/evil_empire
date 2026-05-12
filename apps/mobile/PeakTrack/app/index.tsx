import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { fetchWorkoutsWithNestedForDateRange, createWorkout, deleteWorkout, updateWorkoutDate, createExercise } from '@evil-empire/peaktrack-services';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { addDays, startOfWeek, format, getISOWeek, subDays, isBefore, startOfDay } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../components/Button';
import { ExerciseItem } from '../components/ExerciseItem';
import { WeekDaySelector } from '../components/WeekDaySelector';
import { commonStyles } from '../styles/common';
import { Exercise, Workout } from '../types/workout';
import { ExercisePhase } from '@evil-empire/parsers';
import { NavigationBar } from '../components/NavigationBar';
import { LoadScreen } from './components/LoadScreen';
import { CoachMark } from '../components/CoachMark';
import { useCoachMark } from '../hooks/useCoachMark';
import { ProgramSessionCard } from '../components/ProgramSessionCard';
import { WorkoutActionsModal } from '../components/WorkoutActionsModal';
import { usePrograms } from '../contexts/ProgramsContext';
import { ProgramSessionForDate } from '@evil-empire/types';
import { prepareMaterializeInputs, sessionLabel } from '@evil-empire/peaktrack-services';

type PendingMove =
	| { kind: 'workout'; id: string }
	| { kind: 'session'; id: string };

export default function Index() {
	const [exerciseName, setExerciseName] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isFetchingWorkouts, setIsFetchingWorkouts] = useState(true);
	const [errorState, setErrorState] = useState<string | null>(null);
	const { user, loading: authLoading } = useAuth();
	const { settings, loading: settingsLoading } = useUserSettings();
	const weightUnit = settings?.weight_unit || 'kg';

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [exercises, setExercises] = useState<Record<string, Exercise[]>>({});
	const [exercisePhases, setExercisePhases] = useState<Record<string, ExercisePhase[]>>({});
	const [completedWorkoutIds, setCompletedWorkoutIds] = useState<Set<string>>(new Set());
	const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());
	const [selectedDate, setSelectedDate] = useState<Date>(new Date());
	const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
	const [programSessions, setProgramSessions] = useState<ProgramSessionForDate[]>([]);
	const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
	const [actionsForWorkoutId, setActionsForWorkoutId] = useState<string | null>(null);
	const { fetchSessionsForRange, materializeSession } = usePrograms();

	const weekDayCoach = useCoachMark('week-day-selector');
	const addExerciseCoach = useCoachMark('add-exercise-area');

	const getCurrentWeek = () => {
		return `Week ${getISOWeek(selectedWeekStart)}`;
	};

	const nextWeek = () => {
		const nextStart = addDays(selectedWeekStart, 7);
		setSelectedWeekStart(nextStart);
		setSelectedDate(nextStart);
		setPendingMove(null);
	};

	const prevWeek = () => {
		const prevStart = subDays(selectedWeekStart, 7);
		setSelectedWeekStart(prevStart);
		setSelectedDate(prevStart);
		setPendingMove(null);
	};

	// Dedupe concurrent loadData calls. useFocusEffect can fire twice on mount
	// (React Navigation quirk) and the app also triggers loadData from a few
	// user-interaction paths — none of them want to run in parallel with an
	// already-in-flight load.
	const loadingPromiseRef = useRef<Promise<void> | null>(null);

	const loadData = useCallback(async (opts?: { showLoader?: boolean }): Promise<void> => {
		if (loadingPromiseRef.current) {
			return loadingPromiseRef.current;
		}
		if (!user) {return;}

		const run = async (): Promise<void> => {
			const showLoader = opts?.showLoader ?? true;
			if (showLoader) {setIsFetchingWorkouts(true);}

			const t0 = performance.now();
			const rangeEnd = addDays(selectedWeekStart, 6);
			const rangeStartStr = format(selectedWeekStart, 'yyyy-MM-dd');
			const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');

			// Single parallel fetch: workouts+exercises+phases+execution_logs
			// via nested select, in parallel with program sessions. Replaces
			// the three sequential waves with one round-trip wall-clock (plus
			// the programs-sessions chain internally).
			const tFetch = performance.now();
			const [workoutsRes, sessionsRes] = await Promise.all([
				fetchWorkoutsWithNestedForDateRange(user.id, rangeStartStr, rangeEndStr),
				fetchSessionsForRange(selectedWeekStart, rangeEnd),
			]);
			if (__DEV__) {console.log(`[loadData] workouts+nested / sessions: ${(performance.now() - tFetch).toFixed(1)}ms`);}

			setProgramSessions(sessionsRes);

			if (!workoutsRes.error && workoutsRes.data) {
				const workoutsData = workoutsRes.data;

				// Unpack the nested shape into the flat state the UI expects.
				const flatWorkouts: Workout[] = [];
				const exercisesMap: Record<string, Exercise[]> = {};
				const phasesMap: Record<string, ExercisePhase[]> = {};
				const completedIds = new Set<string>();
				const completedExIds = new Set<string>();

				for (const w of workoutsData) {
					const { exercises: nestedExercises, workout_execution_logs: logs, ...workout } = w;
					flatWorkouts.push(workout);
					if (logs && logs.length > 0) {
						completedIds.add(workout.id);
						for (const log of logs) {
							completedExIds.add(log.exercise_id);
						}
					}
					const exerciseList: Exercise[] = [];
					for (const ex of nestedExercises ?? []) {
						const { exercise_phases: nestedPhases, ...exercise } = ex;
						exerciseList.push(exercise);
						if (nestedPhases && nestedPhases.length > 0) {
							phasesMap[exercise.id] = nestedPhases;
						}
					}
					exercisesMap[workout.id] = exerciseList;
				}

				setWorkouts(flatWorkouts);
				setExercises(exercisesMap);
				setExercisePhases(phasesMap);
				setCompletedWorkoutIds(completedIds);
				setCompletedExerciseIds(completedExIds);
			}

			if (__DEV__) {console.log(`[loadData] TOTAL: ${(performance.now() - t0).toFixed(1)}ms`);}

			if (showLoader) {setIsFetchingWorkouts(false);}
		};

		const p = run();
		loadingPromiseRef.current = p;
		try {
			await p;
		} finally {
			loadingPromiseRef.current = null;
		}
	}, [user, selectedWeekStart, fetchSessionsForRange]);

	useFocusEffect(
		useCallback(() => {
			loadData();
		}, [loadData]),
	);

	const filteredWorkouts = workouts.filter(w => w.workout_date === format(selectedDate, 'yyyy-MM-dd'));
	// Workouts come sorted by created_at DESC (newest first). Reverse for display (oldest first).
	const sortedWorkouts = [...filteredWorkouts].reverse();
	const activeWorkout = filteredWorkouts[0] ?? null; // newest workout
	const activeWorkoutHasExercises = activeWorkout ? (exercises[activeWorkout.id] || []).length > 0 : false;

	const handleAddAnotherWorkout = async () => {
		if (!user) {return;}
		const workoutNumber = filteredWorkouts.length + 1;
		const autoName = `Workout ${workoutNumber} - ${format(selectedDate, 'MMM d')}`;
		const { data: newWorkout, error: createError } = await createWorkout(autoName, user.id, format(selectedDate, 'yyyy-MM-dd'));
		if (createError || !newWorkout) {
			setErrorState('Failed to create workout. Please try again.');
			return;
		}
		setWorkouts(prev => [newWorkout, ...prev]);
		setExercises(prev => ({ ...prev, [newWorkout.id]: [] }));
	};

	const handleAddExercise = async () => {
		if (!exerciseName.trim()) {return;}
		if (!user) {
			setErrorState('You must be signed in to add an exercise.');
			return;
		}
		setIsLoading(true);
		setErrorState(null);

		let workoutId = activeWorkout?.id;

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

	const handleDeleteWorkout = (workout: Workout) => {
		const hasExercises = (exercises[workout.id] || []).length > 0;
		Alert.alert(
			'Delete workout',
			hasExercises
				? 'Are you sure you want to delete this workout and all its exercises?'
				: 'Are you sure you want to delete this workout?',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						const { error } = await deleteWorkout(workout.id);
						if (!error) {
							setWorkouts(prev => prev.filter(w => w.id !== workout.id));
							setExercises(prev => {
								const next = { ...prev };
								delete next[workout.id];
								return next;
							});
						}
					},
				},
			],
		);
	};

	const handleMoveWorkout = async (workoutId: string, targetDate: Date) => {
		const dateStr = format(targetDate, 'yyyy-MM-dd');
		const { error } = await updateWorkoutDate(workoutId, dateStr);
		if (!error) {
			setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, workout_date: dateStr } : w));
			setSelectedDate(targetDate);
			setSelectedWeekStart(startOfWeek(targetDate, { weekStartsOn: 1 }));
			setPendingMove(null);
		}
	};

	const handleMoveSession = async (sessionId: string, targetDate: Date) => {
		const ps = programSessions.find(p => p.session.id === sessionId);
		if (!ps) {return;}
		const prep = prepareMaterializeInputs(ps, settings?.default_rest_seconds ?? null);
		if (!prep.ok) {
			setErrorState(prep.error);
			return;
		}
		const dateStr = format(targetDate, 'yyyy-MM-dd');
		const { workout_id, error } = await materializeSession({
			session_id: sessionId,
			target_date: dateStr,
			name: sessionLabel(ps),
			exercises: prep.exercises,
		});
		if (error || !workout_id) {
			setErrorState(error ?? 'Could not move session.');
			return;
		}
		setSelectedDate(targetDate);
		setSelectedWeekStart(startOfWeek(targetDate, { weekStartsOn: 1 }));
		setPendingMove(null);
		setErrorState(null);
		await loadData({ showLoader: false });
	};

	const handleDaySelect = (date: Date) => {
		if (!pendingMove) {
			setSelectedDate(date);
			return;
		}
		if (pendingMove.kind === 'workout') {
			handleMoveWorkout(pendingMove.id, date);
		} else {
			handleMoveSession(pendingMove.id, date);
		}
	};

	useEffect(() => {
		if (!pendingMove) {return;}
		if (pendingMove.kind === 'workout') {
			const stillPresent = workouts.some(w => w.id === pendingMove.id);
			if (!stillPresent) {setPendingMove(null);}
		} else {
			const stillPresent = programSessions.some(
				ps => ps.session.id === pendingMove.id && !ps.materializedWorkoutId,
			);
			if (!stillPresent) {setPendingMove(null);}
		}
	}, [workouts, programSessions, pendingMove]);

	if (authLoading || settingsLoading) {
		return <LoadScreen />;
	}

	if (isFetchingWorkouts) {
		return (
			<View style={styles.flex}>
				<LoadScreen />
				<NavigationBar />
			</View>
		);
	}

	const today = startOfDay(new Date());
	// A day is only 'completed' when every workout/session on that day is done.
	// Any incomplete item downgrades the day to 'missed' (past) or 'planned' (today/future).
	const dayInfo: Record<string, { hasCompleted: boolean; hasIncompletePast: boolean; hasIncompleteFuture: boolean }> = {};
	const ensureDay = (dateKey: string) => {
		if (!dayInfo[dateKey]) {
			dayInfo[dateKey] = { hasCompleted: false, hasIncompletePast: false, hasIncompleteFuture: false };
		}
		return dayInfo[dateKey];
	};
	for (const w of workouts) {
		const dateKey = w.workout_date;
		if (!dateKey) continue;
		const workoutExercises = exercises[w.id] || [];
		if (workoutExercises.length === 0) continue;
		const info = ensureDay(dateKey);
		const workoutDay = startOfDay(new Date(dateKey + 'T00:00:00'));
		if (completedWorkoutIds.has(w.id)) {
			info.hasCompleted = true;
		} else if (isBefore(workoutDay, today)) {
			info.hasIncompletePast = true;
		} else {
			info.hasIncompleteFuture = true;
		}
	}
	// Virtual program sessions: past = missed (user never materialized them),
	// future/today = planned. Materialized sessions are reflected via the
	// workouts loop above.
	for (const ps of programSessions) {
		if (ps.materializedWorkoutId) {continue;}
		const info = ensureDay(ps.date);
		const psDay = startOfDay(new Date(ps.date + 'T00:00:00'));
		if (isBefore(psDay, today)) {
			info.hasIncompletePast = true;
		} else {
			info.hasIncompleteFuture = true;
		}
	}
	const dayStatuses: Record<string, 'completed' | 'missed' | 'planned'> = {};
	for (const [dateKey, info] of Object.entries(dayInfo)) {
		if (info.hasIncompletePast) {
			dayStatuses[dateKey] = 'missed';
		} else if (info.hasIncompleteFuture) {
			dayStatuses[dateKey] = 'planned';
		} else if (info.hasCompleted) {
			dayStatuses[dateKey] = 'completed';
		}
	}

	const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
	const virtualSessionsForDate = programSessions.filter(
		ps => ps.date === selectedDateStr && !ps.materializedWorkoutId,
	);

		return (
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.flex}>
					<CoachMark />
					<ScrollView
						contentContainerStyle={styles.scrollContent}
						keyboardShouldPersistTaps="handled"
					>
						<View style={commonStyles.container}>
							<View style={[commonStyles.headerRow, styles.headerRow, styles.headerRowWithSettings]}>
								<View style={styles.headerSpacer} />
								<Text style={commonStyles.title}>PEAKTRACK</Text>
								<Pressable
									onPress={() => router.push('/settings')}
									style={styles.settingsIconButton}
									accessibilityRole="button"
									accessibilityLabel="Open settings"
								>
									<Ionicons name="settings-outline" size={24} color="#fff" />
								</Pressable>
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

							{pendingMove && (
								<View style={styles.moveBanner}>
									<Text style={styles.moveBannerText} numberOfLines={1}>
										Tap a day to move &ldquo;{
											pendingMove.kind === 'workout'
												? (workouts.find(w => w.id === pendingMove.id)?.name ?? 'workout')
												: (() => {
													const ps = programSessions.find(p => p.session.id === pendingMove.id);
													return ps ? sessionLabel(ps) : 'session';
												})()
										}&rdquo;
									</Text>
									<Pressable
										onPress={() => setPendingMove(null)}
										style={styles.moveBannerCancel}
										accessibilityRole="button"
										accessibilityLabel="Cancel move"
									>
										<Text style={styles.moveBannerCancelText}>Cancel</Text>
									</Pressable>
								</View>
							)}

							<View ref={weekDayCoach.ref} onLayout={weekDayCoach.onLayout}>
								<WeekDaySelector
									weekStart={selectedWeekStart}
									selectedDate={selectedDate}
									onSelectDate={handleDaySelect}
									dayStatuses={dayStatuses}
									isMoveMode={pendingMove !== null}
								/>
							</View>

							<View style={styles.workoutsSection}>
								<Text style={styles.workoutDateTitle}>
									{format(selectedDate, 'EEEE, LLLL d')}
								</Text>

								{sortedWorkouts.length === 0 && virtualSessionsForDate.length === 0 ? (
									<Text style={styles.noWorkoutText}>No exercises yet.</Text>
								) : (
									sortedWorkouts.map((workout) => {
										const workoutExercises = exercises[workout.id] || [];
										const workoutHasExercises = workoutExercises.length > 0;
										const workoutCompleted = completedWorkoutIds.has(workout.id);

										return (
											<View key={workout.id} style={styles.workoutCard}>
												<View style={styles.workoutCardHeader}>
													<Text style={styles.workoutCardTitle}>{workout.name}</Text>
													<View style={styles.dateTitleActions}>
														{!workoutCompleted && (
															<Pressable
																onPress={() => setActionsForWorkoutId(workout.id)}
																style={styles.iconButton}
																accessibilityRole="button"
																accessibilityLabel="Workout actions"
															>
																<Ionicons name="ellipsis-vertical" size={22} color="#fff" />
															</Pressable>
														)}
													</View>
												</View>
												{workoutHasExercises ? (
													workoutExercises.map((exercise) => (
														<ExerciseItem
															key={exercise.id}
															exercise={exercise}
															phases={exercisePhases[exercise.id] || []}
															onEdit={() => router.push({ pathname: '/edit-exercise', params: { exerciseId: exercise.id, exerciseName: exercise.name } })}
															isCompleted={completedExerciseIds.has(exercise.id)}
														unit={weightUnit}
														/>
													))
												) : (
													<Text style={styles.noWorkoutText}>No exercises yet.</Text>
												)}
											</View>
										);
									})
								)}

								{virtualSessionsForDate.map(ps => {
									const psMoveActive = pendingMove?.kind === 'session' && pendingMove.id === ps.session.id;
									return (
										<ProgramSessionCard
											key={ps.session.id}
											item={ps}
											unit={weightUnit}
											isMoveActive={psMoveActive}
											onMoveRequest={() =>
												setPendingMove(prev =>
													prev?.kind === 'session' && prev.id === ps.session.id
														? null
														: { kind: 'session', id: ps.session.id },
												)
											}
										/>
									);
								})}

								{sortedWorkouts.length > 0 && activeWorkoutHasExercises && (
									<Pressable onPress={handleAddAnotherWorkout} style={styles.addWorkoutButton}>
										<Ionicons name="add" size={18} color="#C87E25" />
										<Text style={styles.addWorkoutText}>Add another workout</Text>
									</Pressable>
								)}
							</View>

							<View style={styles.bottomSection} ref={addExerciseCoach.ref} onLayout={addExerciseCoach.onLayout}>
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
								<Pressable
									onPress={() => router.push({
										pathname: '/import-workout',
										params: { selectedDate: format(selectedDate, 'yyyy-MM-dd') },
									})}
									style={styles.pasteWorkoutLink}
									disabled={isLoading}
								>
									<Ionicons name="clipboard-outline" size={16} color="#C87E25" />
									<Text style={styles.pasteWorkoutLinkText}>Paste workout</Text>
								</Pressable>
							</View>
						</View>
					</ScrollView>
					<NavigationBar />
					{(() => {
						const actionsWorkout = actionsForWorkoutId
							? workouts.find(w => w.id === actionsForWorkoutId) ?? null
							: null;
						if (!actionsWorkout) {return null;}
						const actionsHasExercises = (exercises[actionsWorkout.id] || []).length > 0;
						const actionsMoveActive =
							pendingMove?.kind === 'workout' && pendingMove.id === actionsWorkout.id;
						return (
							<WorkoutActionsModal
								visible={true}
								workoutName={actionsWorkout.name}
								canStart={actionsHasExercises}
								isMoveActive={actionsMoveActive}
								onClose={() => setActionsForWorkoutId(null)}
								onStart={() =>
									router.push({
										pathname: '/start-workout',
										params: { workoutName: actionsWorkout.name, workoutId: actionsWorkout.id },
									})
								}
								onReschedule={() =>
									setPendingMove(prev =>
										prev?.kind === 'workout' && prev.id === actionsWorkout.id
											? null
											: { kind: 'workout', id: actionsWorkout.id },
									)
								}
								onDelete={() => handleDeleteWorkout(actionsWorkout)}
							/>
						);
					})()}
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
	headerRowWithSettings: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerSpacer: {
		width: 40,
	},
	settingsIconButton: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
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
	noWorkoutText: {
		color: '#666',
	},
	workoutCard: {
		marginTop: 16,
	},
	workoutCardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	workoutCardTitle: {
		color: '#C87E25',
		fontSize: 16,
		fontWeight: '600',
		flex: 1,
	},
	addWorkoutButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		marginTop: 16,
		borderWidth: 1,
		borderColor: '#333',
		borderRadius: 8,
		borderStyle: 'dashed',
	},
	addWorkoutText: {
		color: '#C87E25',
		fontSize: 14,
		fontWeight: '500',
		marginLeft: 6,
	},
	bottomSection: {
		marginTop: 'auto',
	},
	errorText: {
		color: 'red',
		marginBottom: 10,
	},
	pasteWorkoutLink: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 12,
		marginTop: 8,
	},
	pasteWorkoutLinkText: {
		color: '#C87E25',
		fontSize: 14,
		fontWeight: '500',
	},
	moveBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#262626',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 12,
	},
	moveBannerText: {
		color: '#C87E25',
		fontSize: 14,
		fontWeight: '500',
		flex: 1,
		marginRight: 12,
	},
	moveBannerCancel: {
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	moveBannerCancelText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '500',
	},
});
