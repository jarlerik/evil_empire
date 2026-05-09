import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { parseSetInput } from '@evil-empire/parsers';
import {
  exerciseNeedsRmSnapshot,
  findProgramRm,
  prepareMaterializeInputs,
  resolveWeightsFromSnapshot,
  sessionLabel,
} from '@evil-empire/peaktrack-services';
import type { ProgramSessionForDate } from '@evil-empire/types';
import { useNavigate } from '@tanstack/react-router';
import { useMaterializeProgramSession } from '../hooks/use-programs';
import { useUserSettings } from '../contexts/UserSettingsContext';

interface VirtualProgramSessionCardProps {
  item: ProgramSessionForDate;
  unit: 'kg' | 'lbs';
}

export function VirtualProgramSessionCard({ item, unit }: VirtualProgramSessionCardProps) {
  const navigate = useNavigate();
  const materialize = useMaterializeProgramSession();
  const { settings } = useUserSettings();
  const [error, setError] = useState<string | null>(null);

  const missingNames: string[] = [];
  for (const ex of item.exercises) {
    const parsed = parseSetInput(ex.raw_input);
    if (exerciseNeedsRmSnapshot(parsed) && !findProgramRm(ex.name, item.rms)) {
      missingNames.push(ex.name);
    }
  }

  const label = sessionLabel(item);

  const handleMaterialize = async () => {
    setError(null);
    const prep = prepareMaterializeInputs(item, settings?.default_rest_seconds ?? null);
    if (!prep.ok) {
      setError(prep.error);
      return;
    }
    try {
      await materialize.mutateAsync({
        session_id: item.session.id,
        target_date: item.date,
        name: label,
        exercises: prep.exercises,
      });
      // Stay on the day view — the materialized workout will appear in the
      // normal workouts list once queries refetch.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to materialize');
    }
  };

  return (
    <Card variant="bordered" style={{ gap: 12, opacity: 0.95 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="heading-sm">{label}</Text>
          <Text variant="caption">Scheduled · {item.program.name}</Text>
        </View>
        <Button
          title="Materialize"
          variant="primary"
          size="sm"
          loading={materialize.isPending}
          disabled={missingNames.length > 0}
          onPress={handleMaterialize}
        />
      </View>

      {missingNames.length > 0 ? (
        <Card variant="bordered" style={{ gap: 4 }}>
          <Text variant="caption">
            Missing 1RM for {missingNames.join(', ')}.
          </Text>
          <Button
            title="Set 1RMs"
            variant="outline"
            size="sm"
            onPress={() =>
              navigate({
                to: '/programs/$id/assign',
                params: { id: item.program.id },
                search: { reassign: 1 },
              })
            }
          />
        </Card>
      ) : null}

      {item.exercises.map((ex) => {
        const parsed = parseSetInput(ex.raw_input);
        let display = ex.raw_input;
        let showRaw = false;
        if (parsed.isValid && exerciseNeedsRmSnapshot(parsed)) {
          try {
            const r = resolveWeightsFromSnapshot(ex.name, parsed, item.rms);
            const baseSpec = parsed.compoundReps
              ? `${parsed.sets} × ${parsed.compoundReps.join('+')}`
              : `${parsed.sets} × ${parsed.reps}`;
            if (r.weightMin !== undefined && r.weightMax !== undefined) {
              display = `${baseSpec} @ ${r.weightMin}–${r.weightMax}${unit}`;
            } else {
              display = `${baseSpec} @ ${r.weight}${unit}`;
            }
            showRaw = true;
          } catch {
            display = ex.raw_input;
          }
        }
        return (
          <View key={ex.id} style={{ paddingVertical: 4 }}>
            <Text variant="body">{ex.name}</Text>
            <Text variant="body-sm">{display}</Text>
            {showRaw ? <Text variant="caption">{ex.raw_input}</Text> : null}
            {ex.notes ? <Text variant="caption">{ex.notes}</Text> : null}
          </View>
        );
      })}

      {error ? <Text variant="caption">{error}</Text> : null}
    </Card>
  );
}
