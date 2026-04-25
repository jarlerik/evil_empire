import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import type { Program } from '@evil-empire/types';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../hooks/use-programs';

export const Route = createFileRoute('/_app/programs/')({
  component: ProgramsList,
});

const STATUS_LABELS: Record<Program['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

function programSubtitle(p: Program): string {
  return [
    p.status === 'draft'
      ? null
      : `${p.duration_weeks} week${p.duration_weeks === 1 ? '' : 's'}`,
    p.start_iso_year != null && p.start_iso_week != null
      ? `Week ${p.start_iso_week}, ${p.start_iso_year}`
      : null,
    STATUS_LABELS[p.status],
  ]
    .filter(Boolean)
    .join(' · ');
}

function ProgramsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: programs = [], isLoading, error } = usePrograms(user?.id);

  const grouped = useMemo(() => {
    const order: Program['status'][] = ['active', 'draft', 'archived'];
    const byStatus: Record<Program['status'], Program[]> = {
      active: [],
      draft: [],
      archived: [],
    };
    for (const p of programs) {
      byStatus[p.status].push(p);
    }
    return order
      .map((status) => ({ status, items: byStatus[status] }))
      .filter((g) => g.items.length > 0);
  }, [programs]);

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="display">Programs</Text>
        <Button
          title="+ New program"
          variant="primary"
          onPress={() => navigate({ to: '/programs/new' })}
        />
      </View>

      {isLoading ? <Text variant="caption">Loading…</Text> : null}
      {error ? <Text variant="caption">Failed to load programs.</Text> : null}

      {!isLoading && programs.length === 0 ? (
        <Card variant="bordered" style={{ gap: 6 }}>
          <Text variant="heading-sm">No programs yet</Text>
          <Text variant="caption">
            Build a multi-week block and assign it to a start week.
          </Text>
        </Card>
      ) : null}

      {grouped.map(({ status, items }) => (
        <View key={status} style={{ gap: 8 }}>
          <Text variant="heading-sm">{STATUS_LABELS[status]}</Text>
          {items.map((p) => (
            <Pressable
              key={p.id}
              onPress={() =>
                navigate({ to: '/programs/$id', params: { id: p.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open program ${p.name}`}
            >
              <Card variant="bordered" style={{ gap: 4 }}>
                <Text variant="heading-sm">{p.name}</Text>
                <Text variant="caption">{programSubtitle(p)}</Text>
                {p.description ? (
                  <Text variant="body-sm">{p.description}</Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
