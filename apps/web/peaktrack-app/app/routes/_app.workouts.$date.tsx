import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Input, Text, Pressable } from '@evil-empire/ui';
import { format, isValid, parseISO } from 'date-fns';
import { formatExercisePhase, type ExercisePhase } from '@evil-empire/parsers';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import {
  useWorkoutsForDateRange,
  useCreateWorkout,
  useDeleteWorkout,
} from '../hooks/use-workouts';
import { useCreateExercise } from '../hooks/use-exercises';
import { DateNav } from '../components/DateNav';

export const Route = createFileRoute('/_app/workouts/$date')({
  component: WorkoutsForDate,
});

function WorkoutsForDate() {
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';

  const parsed = parseISO(date);
  const dateValid = isValid(parsed);

  const { data: workoutsData, isLoading } = useWorkoutsForDateRange(
    user?.id,
    dateValid ? date : '',
    dateValid ? date : '',
  );

  const workouts = useMemo(() => {
    return [...(workoutsData ?? [])].reverse();
  }, [workoutsData]);

  const createWorkout = useCreateWorkout(user?.id);
  const deleteWorkout = useDeleteWorkout();
  const createExercise = useCreateExercise();

  const [exerciseName, setExerciseName] = useState('');
  const [error, setError] = useState('');
  const isMutating =
    createWorkout.isPending || createExercise.isPending || deleteWorkout.isPending;

  const handleAddExercise = async () => {
    if (!exerciseName.trim() || !user) return;
    setError('');
    try {
      let workoutId = workouts[workouts.length - 1]?.id;
      if (!workoutId) {
        const autoName = `Workout - ${format(parsed, 'MMM d')}`;
        const w = await createWorkout.mutateAsync({ name: autoName, date });
        workoutId = w.id;
      }
      const ex = await createExercise.mutateAsync({
        name: exerciseName.trim(),
        workoutId,
      });
      setExerciseName('');
      navigate({ to: '/exercises/$id/edit', params: { id: ex.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add exercise');
    }
  };

  const handleAddAnother = async () => {
    if (!user) return;
    const autoName = `Workout ${workouts.length + 1} - ${format(parsed, 'MMM d')}`;
    try {
      await createWorkout.mutateAsync({ name: autoName, date });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workout');
    }
  };

  const handleDeleteWorkout = async (workoutId: string, hasExercises: boolean) => {
    const msg = hasExercises
      ? 'Delete this workout and all its exercises?'
      : 'Delete this workout?';
    if (!window.confirm(msg)) return;
    try {
      await deleteWorkout.mutateAsync(workoutId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete workout');
    }
  };

  if (!dateValid) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text variant="body">Invalid date.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Text variant="display">PEAKTRACK</Text>
        <DateNav
          date={date}
          onChange={(d) => navigate({ to: '/workouts/$date', params: { date: d } })}
        />
      </View>

      {isLoading ? (
        <Text variant="caption">Loading…</Text>
      ) : workouts.length === 0 ? (
        <Card variant="bordered">
          <Text variant="body">No workouts for this day yet.</Text>
          <Text variant="caption">
            Add an exercise below to start, or paste a workout text.
          </Text>
        </Card>
      ) : (
        workouts.map((workout) => {
          const hasExercises = (workout.exercises ?? []).length > 0;
          return (
            <Card key={workout.id} variant="bordered" style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="heading-sm">{workout.name}</Text>
                <Button
                  title="Delete workout"
                  variant="ghost"
                  size="sm"
                  onPress={() => handleDeleteWorkout(workout.id, hasExercises)}
                />
              </View>
              {workout.exercises && workout.exercises.length > 0 ? (
                workout.exercises.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() =>
                      navigate({ to: '/exercises/$id/edit', params: { id: exercise.id } })
                    }
                  >
                    <Card variant="bordered" style={{ gap: 6 }}>
                      <Text variant="heading-sm">{exercise.name}</Text>
                      {(exercise.exercise_phases ?? []).map((phase: ExercisePhase) => (
                        <Text key={phase.id} variant="body-sm">
                          {formatExercisePhase(phase, weightUnit)}
                        </Text>
                      ))}
                      {(exercise.exercise_phases ?? []).length === 0 ? (
                        <Text variant="caption">No sets yet — tap to edit.</Text>
                      ) : null}
                    </Card>
                  </Pressable>
                ))
              ) : (
                <Text variant="caption">No exercises yet.</Text>
              )}
            </Card>
          );
        })
      )}

      <Card variant="bordered" style={{ gap: 12 }}>
        <Text variant="heading-sm">Add exercise</Text>
        <Input
          placeholder="Exercise name"
          value={exerciseName}
          onChangeText={setExerciseName}
          onSubmitEditing={handleAddExercise}
          editable={!isMutating}
          error={error || undefined}
        />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            title="Add exercise"
            variant="primary"
            loading={isMutating}
            onPress={handleAddExercise}
          />
          <Button
            title="Paste workout"
            variant="outline"
            onPress={() =>
              navigate({ to: '/workouts/import', search: { date } })
            }
          />
          {workouts.length > 0 ? (
            <Button title="Add another workout" variant="ghost" onPress={handleAddAnother} />
          ) : null}
        </View>
      </Card>
    </ScrollView>
  );
}
