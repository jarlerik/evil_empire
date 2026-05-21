import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Suspense, lazy, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import {
  buildSessionLayout,
  type SessionLayout,
} from '@evil-empire/peaktrack-services';
import { useProgramProgression } from '../hooks/use-progression';
import { useProgramDetail } from '../hooks/use-programs';
import type { ChartSession } from '../components/ProgressionChart';
import { PROGRESSION_PRIMARY } from '../components/ProgressionChart.constants';

const ProgressionChart = lazy(() =>
  import('../components/ProgressionChart').then((m) => ({ default: m.ProgressionChart })),
);

interface ProgressionSearch {
  exercise?: string;
}

export const Route = createFileRoute('/_app/programs/$id_/progression')({
  component: ProgramProgressionPage,
  validateSearch: (search: Record<string, unknown>): ProgressionSearch => ({
    exercise: typeof search.exercise === 'string' ? search.exercise : undefined,
  }),
});

function ProgramProgressionPage() {
  const { id } = Route.useParams();
  const { exercise } = Route.useSearch();
  const navigate = useNavigate();

  const { data: detail } = useProgramDetail(id);

  const uniqueExerciseNames = useMemo(() => {
    if (!detail) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const ex of detail.exercises) {
      const key = ex.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        names.push(ex.name);
      }
    }
    return names;
  }, [detail]);

  if (!exercise) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Button
            title="‹ Back"
            variant="ghost"
            size="sm"
            onPress={() => navigate({ to: '/programs/$id', params: { id } })}
          />
          <Text variant="display">Progression</Text>
        </View>
        <Text variant="caption">Pick an exercise to view its progression across this program.</Text>
        {uniqueExerciseNames.length === 0 ? (
          <Card variant="bordered">
            <Text variant="body">No exercises in this program yet.</Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {uniqueExerciseNames.map((name) => (
              <Button
                key={name}
                title={name}
                variant="outline"
                onPress={() =>
                  navigate({
                    to: '/programs/$id/progression',
                    params: { id },
                    search: { exercise: name },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return <ProgramProgressionChart programId={id} exerciseName={exercise} />;
}

interface ChartProps {
  programId: string;
  exerciseName: string;
}

function ProgramProgressionChart({ programId, exerciseName }: ChartProps) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useProgramProgression(programId, exerciseName);

  const layouts = useMemo<SessionLayout[]>(() => {
    if (!data) return [];
    return data.sessions.map((row) =>
      buildSessionLayout({
        sessionId: row.session.id,
        weekOffset: row.session.week_offset,
        dayOfWeek: row.session.day_of_week,
        prescribed: row.prescribed,
        performed: row.performedLog,
        programRms: data.programRms,
      }),
    );
  }, [data]);

  const sessions = useMemo<ChartSession[]>(
    () =>
      layouts.map((l) => ({
        key: l.sessionId,
        columns: l.columns,
        volume: l.performedVolume ?? l.prescribedVolume,
        volumeDim: !l.hasPerformed,
        ...(l.headerWeightLabel ? { headerWeightLabel: l.headerWeightLabel } : {}),
        primaryLabel: l.dayLabel,
        secondaryLabel: `W${l.weekOffset + 1}`,
        dotFilled: l.hasPerformed,
      })),
    [layouts],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button
          title="‹ Back"
          variant="ghost"
          size="sm"
          onPress={() =>
            navigate({ to: '/programs/$id', params: { id: programId } })
          }
        />
        <View style={{ flex: 1 }}>
          <Text variant="display">{exerciseName}</Text>
          {data ? <Text variant="caption">{data.program.name}</Text> : null}
        </View>
      </View>

      {isLoading ? <Text variant="caption">Loading…</Text> : null}
      {error ? <Text variant="caption">Failed to load progression.</Text> : null}

      {!isLoading && layouts.length === 0 ? (
        <Card variant="bordered">
          <Text variant="body">No sessions for this exercise yet.</Text>
        </Card>
      ) : null}

      {layouts.length > 0 ? (
        <Card variant="bordered" style={{ gap: 8 }}>
          <Text variant="heading-sm">Volume per session</Text>
          <Suspense fallback={<Text variant="caption">Loading chart…</Text>}>
            <ProgressionChart
              sessions={sessions}
              weightUnit="kg"
              legend={[
                { color: PROGRESSION_PRIMARY, label: 'Performed' },
                { color: PROGRESSION_PRIMARY, opacity: 0.2, label: 'Not performed' },
              ]}
            />
          </Suspense>
        </Card>
      ) : null}
    </ScrollView>
  );
}
