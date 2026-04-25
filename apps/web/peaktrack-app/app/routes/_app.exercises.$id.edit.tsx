import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Input, Text } from '@evil-empire/ui';
import {
  parseSetInput,
  reverseParsePhase,
  type ExercisePhase,
} from '@evil-empire/parsers';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { usePhasesByExerciseId, useSavePhase, useDeletePhase } from '../hooks/use-phases';
import { useDeleteExercise, useUpdateExerciseName } from '../hooks/use-exercises';
import { useCreateRm } from '../hooks/use-rms';
import { resolveWeights, type RmMatch } from '../lib/rm-lookup';
import { getSupabaseClient } from '@evil-empire/peaktrack-services';
import { PhaseRow } from '../components/PhaseRow';
import { RmFormModal, type RmFormData } from '../components/RmFormModal';
import { RmSelectModal } from '../components/RmSelectModal';

interface ExerciseQueryShape {
  id: string;
  name: string;
  workout_id: string;
}

export const Route = createFileRoute('/_app/exercises/$id/edit')({
  component: EditExercise,
  loader: async ({ params }): Promise<ExerciseQueryShape | null> => {
    let client;
    try {
      client = getSupabaseClient();
    } catch {
      return null;
    }
    const { data } = await client
      .from('exercises')
      .select('id, name, workout_id')
      .eq('id', params.id)
      .maybeSingle();
    return (data as ExerciseQueryShape | null) ?? null;
  },
});

function EditExercise() {
  const { id: exerciseId } = Route.useParams();
  const initialExercise = Route.useLoaderData();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';

  const [exerciseName, setExerciseName] = useState(initialExercise?.name ?? '');
  const [setInput, setSetInput] = useState('');
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [rmFormOpen, setRmFormOpen] = useState(false);
  const [rmSelectOpen, setRmSelectOpen] = useState(false);
  const [partialMatches, setPartialMatches] = useState<RmMatch[]>([]);

  const { data: phases = [] } = usePhasesByExerciseId(exerciseId);
  const savePhase = useSavePhase();
  const deletePhase = useDeletePhase();
  const updateName = useUpdateExerciseName();
  const deleteExercise = useDeleteExercise();
  const createRm = useCreateRm(user?.id);

  const workoutId = initialExercise?.workout_id;

  const submitPhase = async (rmOverride?: { weight: number; sourceName?: string }) => {
    if (!user) return;
    const parsed = parseSetInput(setInput);
    if (!parsed.isValid) {
      setError(parsed.errorMessage ?? 'Invalid input format');
      return;
    }
    const result = await resolveWeights({
      userId: user.id,
      exerciseName,
      parsed,
      weightUnit,
      rmOverride,
    });
    if (result.kind === 'needs-rm') {
      if (result.partialMatches.length > 0) {
        setPartialMatches(result.partialMatches);
        setRmSelectOpen(true);
      } else {
        setRmFormOpen(true);
      }
      return;
    }
    const { weights, finalParsed } = result;
    const weightRange =
      weights.weightMin !== undefined && weights.weightMax !== undefined
        ? { min: weights.weightMin, max: weights.weightMax }
        : undefined;
    try {
      await savePhase.mutateAsync({
        exerciseId,
        phaseId: editingPhaseId,
        parsedData: finalParsed,
        calculatedWeight: weights.weight,
        weightRange,
      });
      setSetInput('');
      setEditingPhaseId(null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save set');
    }
  };

  const handleEditPhase = (phase: ExercisePhase) => {
    setEditingPhaseId(phase.id);
    setSetInput(reverseParsePhase(phase, weightUnit));
  };

  const handleSelectMatch = (match: RmMatch) => {
    setRmSelectOpen(false);
    submitPhase({ weight: match.weight, sourceName: match.exerciseName });
  };

  const handleAddRm = async (data: RmFormData) => {
    try {
      await createRm.mutateAsync(data);
      setRmFormOpen(false);
      submitPhase({ weight: data.weight, sourceName: data.exerciseName });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save RM');
    }
  };

  const handleSaveName = async () => {
    if (!exerciseName.trim()) return;
    try {
      await updateName.mutateAsync({ exerciseId, name: exerciseName.trim() });
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save exercise');
    }
  };

  const handleDeleteExercise = async () => {
    if (!window.confirm('Delete this exercise?')) return;
    try {
      await deleteExercise.mutateAsync(exerciseId);
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete exercise');
    }
  };

  const goBack = () => {
    if (workoutId) {
      // Best-effort: navigate to the workout's date page when known
      navigate({ to: '/' });
    } else {
      navigate({ to: '/' });
    }
  };

  const isMutating = savePhase.isPending || deletePhase.isPending || updateName.isPending;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button title="‹ Back" variant="ghost" size="sm" onPress={goBack} />
        <Text variant="display">{initialExercise?.name ?? 'Exercise'}</Text>
      </View>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Text variant="heading-sm">Exercise name</Text>
        <Input value={exerciseName} onChangeText={setExerciseName} placeholder="Exercise" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Save name" variant="outline" onPress={handleSaveName} />
          <Button
            title="Delete exercise"
            variant="destructive"
            onPress={handleDeleteExercise}
          />
        </View>
      </Card>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Text variant="heading-sm">{editingPhaseId ? 'Edit set' : 'Add set'}</Text>
        <Input
          value={setInput}
          onChangeText={setSetInput}
          placeholder={`4 x 3 @100${weightUnit} 120s`}
          multiline
          numberOfLines={3}
          error={error || undefined}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={editingPhaseId ? 'Update' : 'Add'}
            variant="primary"
            loading={isMutating}
            onPress={() => submitPhase()}
          />
          {editingPhaseId ? (
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setEditingPhaseId(null);
                setSetInput('');
                setError('');
              }}
            />
          ) : null}
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        {phases.map((phase) => (
          <PhaseRow
            key={phase.id}
            phase={phase}
            unit={weightUnit}
            isEditing={editingPhaseId === phase.id}
            onEdit={() => handleEditPhase(phase)}
            onDelete={() => deletePhase.mutate(phase.id)}
          />
        ))}
        {phases.length === 0 ? <Text variant="caption">No sets yet.</Text> : null}
      </View>

      <RmFormModal
        open={rmFormOpen}
        onClose={() => setRmFormOpen(false)}
        onSave={handleAddRm}
        defaultExerciseName={exerciseName}
        isLoading={createRm.isPending}
        unit={weightUnit}
        infoText="No 1RM found for this exercise. Add your 1RM to calculate percentage-based weights."
      />
      <RmSelectModal
        open={rmSelectOpen}
        onClose={() => setRmSelectOpen(false)}
        onSelect={handleSelectMatch}
        onAddNew={() => {
          setRmSelectOpen(false);
          setRmFormOpen(true);
        }}
        matches={partialMatches}
        exerciseName={exerciseName}
        unit={weightUnit}
      />
    </ScrollView>
  );
}
