import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { parseSetInput } from '@evil-empire/parsers';
import {
  exerciseNeedsRmSnapshot,
  resolveWeightsFromSnapshot,
} from '@evil-empire/peaktrack-services';
import type { ProgramExercise, ProgramSession } from '@evil-empire/types';
import {
  useDeleteProgram,
  useProgramDetail,
  useUpdateProgram,
} from '../hooks/use-programs';
import { useUserSettings } from '../contexts/UserSettingsContext';

export const Route = createFileRoute('/_app/programs/$id')({
  component: ProgramDetailPage,
});

const DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

interface SessionWithExercises extends ProgramSession {
  exs: ProgramExercise[];
}

function ProgramDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';

  const { data, isLoading, error } = useProgramDetail(id);
  const updateProgram = useUpdateProgram();
  const deleteProgram = useDeleteProgram();

  const [actionError, setActionError] = useState('');

  const weeks = useMemo(() => {
    if (!data) return [];
    const exsBySession = new Map<string, ProgramExercise[]>();
    for (const ex of data.exercises) {
      const list = exsBySession.get(ex.program_session_id) ?? [];
      list.push(ex);
      exsBySession.set(ex.program_session_id, list);
    }
    const byWeek = new Map<number, SessionWithExercises[]>();
    for (const s of data.sessions) {
      const exs = exsBySession.get(s.id) ?? [];
      if (exs.length === 0) continue;
      const list = byWeek.get(s.week_offset) ?? [];
      list.push({ ...s, exs });
      byWeek.set(s.week_offset, list);
    }
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekOffset, sessions]) => ({
        weekOffset,
        sessions: sessions.slice().sort((a, b) => a.day_of_week - b.day_of_week),
      }));
  }, [data]);

  if (isLoading || !data) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {error ? (
          <Text variant="caption">Failed to load program.</Text>
        ) : (
          <Text variant="caption">Loading…</Text>
        )}
      </ScrollView>
    );
  }

  const { program, rms } = data;
  const isActive = program.status === 'active';
  const hasPlan = weeks.length > 0;
  const assignedLabel =
    program.start_iso_year != null && program.start_iso_week != null
      ? ` · Week ${program.start_iso_week}, ${program.start_iso_year}`
      : '';

  const handleArchive = async () => {
    setActionError('');
    const next = program.status === 'archived' ? 'draft' : 'archived';
    const patch: Parameters<typeof updateProgram.mutateAsync>[0]['patch'] =
      next === 'draft'
        ? { status: next, start_iso_year: null, start_iso_week: null }
        : { status: next };
    try {
      await updateProgram.mutateAsync({ id: program.id, patch });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update program');
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete "${program.name}"? Your workout history from this program will be preserved.`,
      )
    )
      return;
    setActionError('');
    try {
      await deleteProgram.mutateAsync(program.id);
      navigate({ to: '/programs' });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete program');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button
          title="‹ Back"
          variant="ghost"
          size="sm"
          onPress={() => navigate({ to: '/programs' })}
        />
        <Text variant="display">{program.name}</Text>
      </View>

      <Text variant="caption">
        {program.status === 'draft'
          ? STATUS_LABELS[program.status]
          : `${program.duration_weeks} week${program.duration_weeks === 1 ? '' : 's'} · ${STATUS_LABELS[program.status] ?? program.status}`}
        {assignedLabel}
      </Text>
      {program.description ? (
        <Text variant="body-sm">{program.description}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          title="Edit plan"
          variant="outline"
          size="sm"
          onPress={() =>
            navigate({ to: '/programs/$id/edit', params: { id: program.id } })
          }
        />
      </View>

      {hasPlan ? (
        <View style={{ gap: 16 }}>
          {weeks.map((week) => (
            <Card key={week.weekOffset} variant="bordered" style={{ gap: 8 }}>
              <Text variant="heading-sm">Week {week.weekOffset + 1}</Text>
              {week.sessions.map((s) => {
                const ex = s.exs[0];
                if (!ex) return null;
                const parsed = parseSetInput(ex.raw_input);
                let display = ex.raw_input;
                let showRaw = false;
                if (
                  parsed.isValid &&
                  exerciseNeedsRmSnapshot(parsed) &&
                  rms.length > 0
                ) {
                  try {
                    const r = resolveWeightsFromSnapshot(ex.name, parsed, rms);
                    const baseSpec = parsed.compoundReps
                      ? `${parsed.sets} × ${parsed.compoundReps.join('+')}`
                      : `${parsed.sets} × ${parsed.reps}`;
                    if (r.weightMin !== undefined && r.weightMax !== undefined) {
                      display = `${baseSpec} @ ${r.weightMin}–${r.weightMax}${weightUnit}`;
                    } else {
                      display = `${baseSpec} @ ${r.weight}${weightUnit}`;
                    }
                    showRaw = true;
                  } catch {
                    display = ex.raw_input;
                  }
                }
                return (
                  <View
                    key={s.id}
                    style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}
                  >
                    <Text variant="body-sm" style={{ width: 40 }}>
                      {DAY_LABELS[s.day_of_week]}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{display}</Text>
                      {showRaw ? <Text variant="caption">{ex.raw_input}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          ))}
        </View>
      ) : (
        <Card variant="bordered" style={{ gap: 4 }}>
          <Text variant="heading-sm">No plan yet</Text>
          <Text variant="caption">Click "Edit plan" to add sessions.</Text>
        </Card>
      )}

      {rms.length > 0 ? (
        <Card variant="bordered" style={{ gap: 6 }}>
          <Text variant="heading-sm">Program 1RMs</Text>
          {rms.map((rm) => (
            <View
              key={rm.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 4,
              }}
            >
              <Text variant="body">{rm.exercise_name}</Text>
              <Text variant="body">
                {rm.weight}
                {weightUnit}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {actionError ? <Text variant="caption">{actionError}</Text> : null}

      <View style={{ gap: 8 }}>
        {!isActive && hasPlan ? (
          <Button
            title="Assign start week"
            variant="primary"
            onPress={() =>
              navigate({
                to: '/programs/$id/assign',
                params: { id: program.id },
              })
            }
          />
        ) : null}
        {isActive ? (
          <Button
            title="Re-assign start week"
            variant="outline"
            onPress={() =>
              navigate({
                to: '/programs/$id/assign',
                params: { id: program.id },
                search: { reassign: 1 },
              })
            }
          />
        ) : null}
        <Button
          title={program.status === 'archived' ? 'Unarchive' : 'Archive'}
          variant="outline"
          onPress={handleArchive}
          loading={updateProgram.isPending}
        />
        <Button
          title="Delete program"
          variant="destructive"
          onPress={handleDelete}
          loading={deleteProgram.isPending}
        />
      </View>
    </ScrollView>
  );
}
