import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import {
  useCreateProgram,
  useDeleteProgram,
  useSaveProgramPlan,
  type SavePlanSession,
} from '../hooks/use-programs';
import { ProgramPlanEditor } from '../components/ProgramPlanEditor';

export const Route = createFileRoute('/_app/programs/new')({
  component: NewProgramPage,
});

function NewProgramPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createProgram = useCreateProgram(user?.id);
  const savePlan = useSaveProgramPlan();
  const deleteProgram = useDeleteProgram();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planText, setPlanText] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [error, setError] = useState('');

  const isSaving = createProgram.isPending || savePlan.isPending;

  const handleCreate = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name.');
      return;
    }
    const trimmedPlan = planText.trim();
    if (!trimmedPlan) {
      setError('Paste a plan before creating the program.');
      return;
    }
    const parsed = parseProgramText(trimmedPlan);
    if (parsed.errors.length > 0 || parsed.weeks.length === 0) {
      setError(parsed.errors[0] ?? 'Could not parse the plan.');
      return;
    }
    const sessionsPerWeek = parsed.sessionsPerWeek ?? 1;
    if (selectedDays.length > 0 && selectedDays.length < sessionsPerWeek) {
      // Soft warning surfaced inline; saving still proceeds with default-day
      // fallback for the missing slots, mirroring mobile.
      setError(
        `You picked ${selectedDays.length} day${selectedDays.length === 1 ? '' : 's'} but the plan has ${sessionsPerWeek} sessions/week. Extra sessions will use default days.`,
      );
    } else {
      setError('');
    }

    const resolveDay = (sessionIndex: number): number => {
      if (sessionIndex < selectedDays.length) {
        return selectedDays[sessionIndex];
      }
      return defaultDayForSession(sessionIndex, sessionsPerWeek);
    };

    let createdId: string | undefined;
    try {
      const program = await createProgram.mutateAsync({
        name: trimmedName,
        description: description.trim() || null,
      });
      createdId = program.id;

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

      await savePlan.mutateAsync({
        programId: program.id,
        sessions,
        durationWeeks: parsed.weeks.length,
      });

      navigate({ to: '/programs/$id', params: { id: program.id } });
    } catch (e) {
      // Roll back the empty program if plan-save failed mid-flow so the
      // user isn't left with an orphan draft.
      if (createdId && savePlan.isError) {
        try {
          await deleteProgram.mutateAsync(createdId);
        } catch {
          // best-effort; surface the original error below.
        }
      }
      setError(e instanceof Error ? e.message : 'Failed to create program');
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
        <Text variant="display">New program</Text>
      </View>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Russian squat program"
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Notes about the program…"
          multiline
          numberOfLines={3}
        />
      </Card>

      <Card variant="bordered" style={{ gap: 12 }}>
        <DayPicker
          label="Session days (optional)"
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

      {error ? <Text variant="caption">{error}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title="Create program"
          variant="primary"
          loading={isSaving}
          onPress={handleCreate}
          disabled={!name.trim() || !planText.trim()}
        />
      </View>
    </ScrollView>
  );
}
