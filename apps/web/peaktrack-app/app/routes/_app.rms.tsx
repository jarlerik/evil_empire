import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { format } from 'date-fns';
import type { RepetitionMaximum } from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useCreateRm, useDeleteRm, useRms, useUpdateRm } from '../hooks/use-rms';
import { RmFormModal, type RmFormData } from '../components/RmFormModal';

export const Route = createFileRoute('/_app/rms')({
  component: RmsPage,
});

interface GroupedRm {
  exerciseName: string;
  rms: RepetitionMaximum[];
}

function groupRms(rms: RepetitionMaximum[]): GroupedRm[] {
  const byName: Record<string, Record<string, RepetitionMaximum>> = {};
  for (const rm of rms) {
    const repsKey = String(rm.reps);
    const group = (byName[rm.exercise_name] ??= {});
    const existing = group[repsKey];
    if (
      !existing ||
      rm.weight > existing.weight ||
      (rm.weight === existing.weight && new Date(rm.date) > new Date(existing.date))
    ) {
      group[repsKey] = rm;
    }
  }
  return Object.entries(byName).map(([name, repsMap]) => ({
    exerciseName: name,
    rms: Object.values(repsMap).sort((a, b) => a.reps - b.reps),
  }));
}

function RmsPage() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';

  const { data: rms = [], isLoading } = useRms(user?.id);
  const createRm = useCreateRm(user?.id);
  const updateRm = useUpdateRm();
  const deleteRm = useDeleteRm();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RepetitionMaximum | null>(null);
  const [error, setError] = useState('');

  const grouped = groupRms(rms);

  const handleSave = async (data: RmFormData) => {
    setError('');
    try {
      if (editing) {
        await updateRm.mutateAsync({ id: editing.id, ...data });
      } else {
        await createRm.mutateAsync(data);
      }
      setOpen(false);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save RM');
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this RM?')) return;
    deleteRm.mutate(id);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="display">Rep maxes</Text>
        <Button
          title="Add RM"
          variant="primary"
          onPress={() => {
            setEditing(null);
            setOpen(true);
          }}
        />
      </View>

      {error ? <Text variant="caption">{error}</Text> : null}
      {isLoading ? <Text variant="caption">Loading…</Text> : null}
      {!isLoading && grouped.length === 0 ? (
        <Card variant="bordered">
          <Text variant="body">No RMs yet.</Text>
          <Text variant="caption">
            Add your first RM to unlock percentage-based weight inputs.
          </Text>
        </Card>
      ) : null}

      {grouped.map(({ exerciseName, rms: groupRms }) => (
        <Card key={exerciseName} variant="bordered" style={{ gap: 8 }}>
          <Text variant="heading-sm">{exerciseName}</Text>
          {groupRms.map((rm) => (
            <View
              key={rm.id}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">
                  {rm.reps}RM: {rm.weight}
                  {weightUnit}
                </Text>
                <Text variant="caption">{format(new Date(rm.date), 'MMM d, yyyy')}</Text>
              </View>
              <Button
                title="Edit"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setEditing(rm);
                  setOpen(true);
                }}
              />
              <Button
                title="×"
                variant="ghost"
                size="sm"
                onPress={() => handleDelete(rm.id)}
              />
            </View>
          ))}
        </Card>
      ))}

      <RmFormModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        editingRm={editing}
        unit={weightUnit}
        isLoading={createRm.isPending || updateRm.isPending}
      />
    </ScrollView>
  );
}
