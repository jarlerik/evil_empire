import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Suspense, lazy, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { format } from 'date-fns';
import {
  buildExerciseSessionLayout,
  type ExerciseSessionLayout,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useExerciseProgression } from '../hooks/use-progression';
import type { ChartSession } from '../components/ProgressionChart';
import { PROGRESSION_PRIMARY } from '../components/ProgressionChart.constants';

const ProgressionChart = lazy(() =>
  import('../components/ProgressionChart').then((m) => ({ default: m.ProgressionChart })),
);

export const Route = createFileRoute('/_app/exercises/$id/progression')({
  component: ExerciseProgression,
});

function formatDayLabel(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d');
  } catch {
    return iso;
  }
}

function ExerciseProgression() {
  const { id } = Route.useParams();
  const exerciseName = decodeURIComponent(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';

  const { data: rows = [], isLoading, error } = useExerciseProgression(user?.id, exerciseName);

  const layouts = useMemo<ExerciseSessionLayout[]>(() => {
    const out: ExerciseSessionLayout[] = [];
    for (const row of rows) {
      const layout = buildExerciseSessionLayout({ row, weightUnit });
      if (layout) out.push(layout);
    }
    return out;
  }, [rows, weightUnit]);

  const sessions = useMemo<ChartSession[]>(
    () =>
      layouts.map((l) => ({
        key: l.logId,
        columns: l.columns,
        volume: l.volume,
        ...(l.headerWeightLabel ? { headerWeightLabel: l.headerWeightLabel } : {}),
        primaryLabel: formatDayLabel(l.workoutDate),
      })),
    [layouts],
  );

  const hasAnyCompound = layouts.some((l) => l.isCompound);

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button title="‹ Back" variant="ghost" size="sm" onPress={() => navigate({ to: '/rms' })} />
        <Text variant="display">{exerciseName}</Text>
      </View>

      {isLoading ? <Text variant="caption">Loading…</Text> : null}
      {error ? <Text variant="caption">Failed to load progression.</Text> : null}

      {!isLoading && layouts.length === 0 ? (
        <Card variant="bordered">
          <Text variant="body">No recorded sessions for {exerciseName} yet.</Text>
          <Text variant="caption">
            Execute a workout containing this exercise on mobile to start building progression
            history.
          </Text>
        </Card>
      ) : null}

      {layouts.length > 0 ? (
        <Card variant="bordered" style={{ gap: 8 }}>
          <Text variant="heading-sm">Volume per session ({weightUnit})</Text>
          <Suspense fallback={<Text variant="caption">Loading chart…</Text>}>
            <ProgressionChart
              sessions={sessions}
              weightUnit={weightUnit}
              legend={
                hasAnyCompound
                  ? [
                      { color: PROGRESSION_PRIMARY, label: 'Analysed segment' },
                      { color: PROGRESSION_PRIMARY, opacity: 0.5, label: 'Other segments' },
                    ]
                  : undefined
              }
            />
          </Suspense>
        </Card>
      ) : null}
    </ScrollView>
  );
}
