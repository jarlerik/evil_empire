import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  DayPicker,
  Input,
  Text,
  type DayOfWeek,
} from '@evil-empire/ui';
import {
  defaultDayForSession,
  parseProgramText,
  serializeProgramText,
} from '@evil-empire/peaktrack-services';
import {
  useProgramDetail,
  useSaveProgramPlan,
  useUpdateProgram,
  type SavePlanSession,
} from '../hooks/use-programs';
import { ProgramPlanEditor } from '../components/ProgramPlanEditor';

export const Route = createFileRoute('/_app/programs/$id/edit')({
  component: ProgramEditPage,
});

function ProgramEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useProgramDetail(id);
  const updateProgram = useUpdateProgram();
  const savePlan = useSaveProgramPlan();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planText, setPlanText] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState('');

  const initialPlanText = useMemo(() => {
    if (!data) return '';
    if (data.sessions.length === 0) return '';
    const exsBySession = new Map(
      data.sessions.map((s) => [s.id, [] as { name: string; raw_input: string }[]]),
    );
    for (const ex of data.exercises) {
      const list = exsBySession.get(ex.program_session_id);
      if (list) list.push({ name: ex.name, raw_input: ex.raw_input });
    }
    return serializeProgramText(
      data.sessions.map((s) => ({
        week_offset: s.week_offset,
        day_of_week: s.day_of_week,
        exercises: exsBySession.get(s.id) ?? [],
      })),
      data.program.name,
    );
  }, [data]);

  // Hydrate the form once per detail load. Subsequent refetches don't reset
  // in-progress edits.
  useEffect(() => {
    if (hydrated || !data) return;
    setName(data.program.name);
    setDescription(data.program.description ?? '');
    setPlanText(initialPlanText);
    const distinctDays = Array.from(new Set(data.sessions.map((s) => s.day_of_week)))
      .sort((a, b) => a - b) as DayOfWeek[];
    setSelectedDays(distinctDays);
    setHydrated(true);
  }, [hydrated, data, initialPlanText]);

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

  const { program } = data;
  const isSaving = updateProgram.isPending || savePlan.isPending;

  const handleSave = async () => {
    setSaveError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError('Please enter a name.');
      return;
    }
    const trimmedPlan = planText.trim();
    if (!trimmedPlan) {
      setSaveError('Plan cannot be empty.');
      return;
    }
    const parsed = parseProgramText(trimmedPlan);
    if (parsed.errors.length > 0 || parsed.weeks.length === 0) {
      setSaveError(parsed.errors[0] ?? 'Could not parse the plan.');
      return;
    }

    if (program.status === 'active') {
      const ok = window.confirm(
        'Rewrite active program? Past workouts stay intact. Future virtual sessions will shift to the new plan.',
      );
      if (!ok) return;
    }

    const sessionsPerWeek = parsed.sessionsPerWeek ?? 1;
    const resolveDay = (sessionIndex: number): number => {
      if (sessionIndex < selectedDays.length) {
        return selectedDays[sessionIndex];
      }
      return defaultDayForSession(sessionIndex, sessionsPerWeek);
    };

    const sessions: SavePlanSession[] = [];
    for (const week of parsed.weeks) {
      const weekOffset = week.weekNumber - 1;
      for (let i = 0; i < week.sessions.length; i++) {
        const sess = week.sessions[i];
        sessions.push({
          weekOffset,
          dayOfWeek: resolveDay(i),
          exerciseName: sess.name ?? trimmedName,
          rawInput: sess.rawInput,
        });
      }
    }

    try {
      const metaChanged =
        trimmedName !== program.name ||
        (description.trim() || null) !== (program.description ?? null);
      if (metaChanged) {
        await updateProgram.mutateAsync({
          id: program.id,
          patch: {
            name: trimmedName,
            description: description.trim() || null,
          },
        });
      }
      await savePlan.mutateAsync({
        programId: program.id,
        sessions,
        durationWeeks: parsed.weeks.length,
      });
      navigate({ to: '/programs/$id', params: { id: program.id } });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save program');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button
          title="‹ Back"
          variant="ghost"
          size="sm"
          onPress={() =>
            navigate({ to: '/programs/$id', params: { id: program.id } })
          }
        />
        <Text variant="display">Edit program</Text>
      </View>
      <Text variant="caption">{program.name}</Text>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
      </Card>

      <Card variant="bordered" style={{ gap: 12 }}>
        <DayPicker
          label="Session days"
          value={selectedDays}
          onChange={setSelectedDays}
        />
        <Text variant="caption">
          {selectedDays.length === 0
            ? 'Pick which days sessions land on. If left empty, a default split is used (2 → Mon/Thu, 3 → Mon/Wed/Fri, …).'
            : 'Session order matches the order of picks.'}
        </Text>
      </Card>

      <Card variant="bordered">
        <ProgramPlanEditor value={planText} onChange={setPlanText} disabled={isSaving} />
      </Card>

      {saveError ? <Text variant="caption">{saveError}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title="Save"
          variant="primary"
          loading={isSaving}
          onPress={handleSave}
        />
        <Button
          title="Cancel"
          variant="ghost"
          onPress={() =>
            navigate({ to: '/programs/$id', params: { id: program.id } })
          }
          disabled={isSaving}
        />
      </View>
    </ScrollView>
  );
}
