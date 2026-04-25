import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { formatExercisePhase } from '@evil-empire/parsers';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useHistory, formatExecutedDate } from '../hooks/use-history';
import { useCopyWorkout } from '../hooks/use-workouts';

export const Route = createFileRoute('/_app/history')({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';
  const navigate = useNavigate();

  const { data: history = [], isLoading, error } = useHistory(user?.id, 90);
  const copyWorkout = useCopyWorkout(user?.id);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  const handleCopy = async (workoutId: string) => {
    setCopyingId(workoutId);
    setCopyError('');
    try {
      await copyWorkout.mutateAsync(workoutId);
      navigate({ to: '/' });
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Failed to copy workout');
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text variant="display">History</Text>
      <Text variant="caption">Completed workouts in the last 90 days.</Text>

      {isLoading ? <Text variant="caption">Loading…</Text> : null}
      {error ? <Text variant="caption">Failed to load history.</Text> : null}
      {copyError ? <Text variant="caption">{copyError}</Text> : null}

      {!isLoading && history.length === 0 ? (
        <Card variant="bordered">
          <Text variant="body">No completed workouts yet.</Text>
        </Card>
      ) : null}

      {history.map(({ workout, exercises, phasesByExerciseId, executedAt, rating }) => (
        <Card key={workout.id} variant="bordered" style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <View>
              <Text variant="heading-sm">{workout.name}</Text>
              <Text variant="caption">{formatExecutedDate(executedAt)}</Text>
            </View>
            <Button
              title="Copy to today"
              variant="outline"
              size="sm"
              loading={copyingId === workout.id}
              onPress={() => handleCopy(workout.id)}
            />
          </View>
          {rating !== null ? <Text variant="caption">Rating: {rating}/5</Text> : null}
          {exercises.map((ex) => {
            const phases = phasesByExerciseId[ex.id] ?? [];
            return (
              <View key={ex.id} style={{ gap: 4, paddingTop: 4 }}>
                <Text variant="body">{ex.name}</Text>
                {phases.map((phase) => (
                  <Text key={phase.id} variant="body-sm">
                    {formatExercisePhase(phase, weightUnit)}
                  </Text>
                ))}
              </View>
            );
          })}
        </Card>
      ))}
    </ScrollView>
  );
}
