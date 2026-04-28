import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Input, Text, Pressable } from '@evil-empire/ui';
import { format, isValid, parseISO } from 'date-fns';
import {
  parseWorkoutText,
  type ParsedSetData,
  type ParsedWorkoutBlock,
} from '@evil-empire/parsers';
import {
  buildPhaseData,
  createExercise,
  createWorkout,
  fetchWorkoutsByUserIdAndDateRange,
  insertPhase,
  lookupExactRm,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import {
  findPartialRmMatches,
  resolveWeights,
  type RmMatch,
} from '../lib/rm-lookup';
import { useCreateRm } from '../hooks/use-rms';
import { RmFormModal, type RmFormData } from '../components/RmFormModal';
import { RmSelectModal } from '../components/RmSelectModal';

interface SearchParams {
  date?: string;
}

export const Route = createFileRoute('/_app/workouts/import')({
  component: ImportWorkout,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    date: typeof search.date === 'string' ? search.date : undefined,
  }),
});

interface BlockState {
  block: ParsedWorkoutBlock;
  name: string;
  notes: string;
  skipped: boolean;
  rmWeight?: number;
  rmSourceName?: string;
}

function summarize(parsed: ParsedSetData, rmWeight: number | undefined, unit: string): string {
  if (!parsed.isValid) return '';
  const repsStr = parsed.compoundReps ? parsed.compoundReps.join('+') : String(parsed.reps);
  const setsReps = `${parsed.sets} × ${repsStr}`;
  let w = '';
  if (parsed.needsRmLookup) {
    if (parsed.weightMinPercentage !== undefined && parsed.weightMaxPercentage !== undefined) {
      w = `@${parsed.weightMinPercentage}-${parsed.weightMaxPercentage}%`;
    } else if (parsed.weightPercentage !== undefined) {
      w = `@${parsed.weightPercentage}%`;
    }
    if (rmWeight !== undefined && parsed.weightPercentage !== undefined) {
      const resolved = Math.round((rmWeight * parsed.weightPercentage) / 100);
      w += ` (~${resolved}${unit})`;
    }
  } else if (parsed.weightMin !== undefined && parsed.weightMax !== undefined) {
    w = `@${parsed.weightMin}-${parsed.weightMax}${unit}`;
  } else if (parsed.weight) {
    w = `@${parsed.weight}${unit}`;
  }
  return `${setsReps} ${w}`.trim();
}

function isReady(b: BlockState): boolean {
  if (b.skipped) return true;
  if (!b.block.phases.every((p) => p.isValid)) return false;
  if (!b.name.trim()) return false;
  if (b.block.phases.some((p) => p.needsRmLookup) && b.rmWeight === undefined) return false;
  return true;
}

function ImportWorkout() {
  const navigate = useNavigate();
  const { date: dateParam } = Route.useSearch();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';
  const createRm = useCreateRm(user?.id);

  const targetDate = useMemo(() => {
    if (!dateParam) return new Date();
    const parsed = parseISO(dateParam);
    return isValid(parsed) ? parsed : new Date();
  }, [dateParam]);
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');

  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [rawText, setRawText] = useState('');
  const [blocks, setBlocks] = useState<BlockState[]>([]);
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeBlockIdx, setActiveBlockIdx] = useState<number | null>(null);
  const [rmSelectOpen, setRmSelectOpen] = useState(false);
  const [rmFormOpen, setRmFormOpen] = useState(false);
  const [partialMatches, setPartialMatches] = useState<RmMatch[]>([]);

  const handleParse = async () => {
    if (!user) {
      setError('You must be signed in.');
      return;
    }
    if (!rawText.trim()) {
      setError('Paste some text first.');
      return;
    }
    setError('');
    setIsParsing(true);
    try {
      const parsedBlocks = parseWorkoutText(rawText);
      const resolved: BlockState[] = await Promise.all(
        parsedBlocks.map(async (b): Promise<BlockState> => {
          const base: BlockState = {
            block: b,
            name: b.suggestedName,
            notes: b.notes ?? '',
            skipped: false,
          };
          if (b.phases.some((p) => p.needsRmLookup) && b.suggestedName) {
            const { data } = await lookupExactRm(user.id, b.suggestedName, 1);
            if (data?.weight) {
              return { ...base, rmWeight: data.weight, rmSourceName: b.suggestedName };
            }
          }
          return base;
        }),
      );
      setBlocks(resolved);
      setStep('review');
    } finally {
      setIsParsing(false);
    }
  };

  const updateBlock = (idx: number, patch: Partial<BlockState>) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const handleResolveRm = async (idx: number) => {
    if (!user) return;
    setActiveBlockIdx(idx);
    const target = blocks[idx];
    const name = target.name.trim() || target.block.suggestedName;
    const partials = await findPartialRmMatches(user.id, name);
    if (partials.length > 0) {
      setPartialMatches(partials);
      setRmSelectOpen(true);
    } else {
      setPartialMatches([]);
      setRmFormOpen(true);
    }
  };

  const handleSelectMatch = (match: RmMatch) => {
    if (activeBlockIdx === null) return;
    updateBlock(activeBlockIdx, {
      rmWeight: match.weight,
      rmSourceName: match.exerciseName,
    });
    setRmSelectOpen(false);
    setActiveBlockIdx(null);
  };

  const handleAddRm = async (data: RmFormData) => {
    if (activeBlockIdx === null) return;
    try {
      await createRm.mutateAsync(data);
      updateBlock(activeBlockIdx, { rmWeight: data.weight, rmSourceName: data.exerciseName });
      setRmFormOpen(false);
      setActiveBlockIdx(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save RM');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!blocks.every(isReady)) {
      setError('Resolve every block (skip, fix, or set 1RM) before saving.');
      return;
    }
    const importable = blocks.filter(
      (b) => !b.skipped && b.block.phases.every((p) => p.isValid) && b.name.trim(),
    );
    if (importable.length === 0) {
      setError('Nothing to import — all blocks were skipped or invalid.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const { data: existing } = await fetchWorkoutsByUserIdAndDateRange(
        user.id,
        targetDateStr,
        targetDateStr,
      );
      const workoutNumber = (existing ?? []).length + 1;
      const workoutName = `Workout #${workoutNumber} ${format(targetDate, 'MMM d')}`;
      const { data: workout, error: wErr } = await createWorkout(
        workoutName,
        user.id,
        targetDateStr,
      );
      if (wErr || !workout) {
        setError('Failed to create workout.');
        return;
      }

      for (const state of importable) {
        const trimmedName = state.name.trim();
        const { data: exercise, error: exErr } = await createExercise(
          trimmedName,
          workout.id,
        );
        if (exErr || !exercise) {
          setError(`Failed to create exercise "${trimmedName}".`);
          return;
        }

        const userNotes = state.notes.trim();

        for (let phaseIdx = 0; phaseIdx < state.block.phases.length; phaseIdx++) {
          const phase = state.block.phases[phaseIdx];

          // Per-phase weight resolution. `resolveWeights` short-circuits on
          // `rmOverride`, so phases 2+ don't trigger another DB lookup.
          const result = await resolveWeights({
            userId: user.id,
            exerciseName: trimmedName,
            parsed: phase,
            weightUnit,
            rmOverride:
              state.rmWeight !== undefined
                ? { weight: state.rmWeight, sourceName: state.rmSourceName }
                : undefined,
          });
          if (result.kind === 'needs-rm') {
            setError(`Couldn't resolve weights for "${trimmedName}".`);
            return;
          }

          let finalParsed = result.finalParsed;
          // User-edited block notes attach to the first phase only; per-phase
          // RM source note (already on `finalParsed.notes`) stays on every
          // phase that needs it.
          if (phaseIdx === 0 && userNotes) {
            const combined = [userNotes, finalParsed.notes].filter(Boolean).join('\n');
            finalParsed = { ...finalParsed, notes: combined };
          }

          const { weights } = result;
          const weightRange =
            weights.weightMin !== undefined && weights.weightMax !== undefined
              ? { min: weights.weightMin, max: weights.weightMax }
              : undefined;
          const phaseData = buildPhaseData(
            exercise.id,
            finalParsed,
            weights.weight,
            weightRange,
          );
          const { error: pErr } = await insertPhase(phaseData);
          if (pErr) {
            setError(`Failed to insert phase for "${trimmedName}": ${pErr}`);
            return;
          }
        }
      }

      navigate({ to: '/workouts/$date', params: { date: targetDateStr } });
    } finally {
      setIsSaving(false);
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
            navigate({ to: '/workouts/$date', params: { date: targetDateStr } })
          }
        />
        <Text variant="display">Import workout</Text>
      </View>
      <Text variant="caption">{format(targetDate, 'EEEE, LLLL d')}</Text>

      {step === 'paste' ? (
        <Card variant="bordered" style={{ gap: 12 }}>
          <Text variant="caption">
            Paste a whole workout. Each exercise should be on its own block (separated by a blank line).
          </Text>
          <Input
            value={rawText}
            onChangeText={setRawText}
            placeholder={'Snatch grip DL with pause\n4 x 5 @95% of 1RM\npause at knee for 3 sec'}
            multiline
            numberOfLines={10}
            style={{ minHeight: 200 }}
          />
          {error ? <Text variant="caption">{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="Parse"
              variant="primary"
              loading={isParsing}
              onPress={handleParse}
              disabled={!rawText.trim()}
            />
          </View>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          <Text variant="caption">
            Review {blocks.length} block{blocks.length === 1 ? '' : 's'}. Resolve any "1RM needed" chips, then save.
          </Text>
          {blocks.map((state, idx) => {
            const unparseable = !state.block.phases.every((p) => p.isValid);
            const needsRm =
              state.block.phases.some((p) => p.needsRmLookup) && state.rmWeight === undefined;
            return (
              <Card
                key={idx}
                variant="bordered"
                style={{ gap: 8, opacity: state.skipped ? 0.5 : 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={state.name}
                      onChangeText={(v) => updateBlock(idx, { name: v })}
                      placeholder="Exercise name"
                      editable={!state.skipped}
                    />
                  </View>
                  <Button
                    title={state.skipped ? 'Unskip' : 'Skip'}
                    variant="ghost"
                    size="sm"
                    onPress={() => updateBlock(idx, { skipped: !state.skipped })}
                  />
                </View>
                {unparseable ? (
                  <Text variant="caption">
                    Couldn't parse this block. Skip it, or go back and fix the pasted text.
                  </Text>
                ) : (
                  state.block.phases.map((phase, phaseIdx) => (
                    <Text key={phaseIdx} variant="body-sm">
                      {summarize(phase, state.rmWeight, weightUnit)}
                    </Text>
                  ))
                )}
                {!unparseable ? (
                  <Input
                    value={state.notes}
                    onChangeText={(v) => updateBlock(idx, { notes: v })}
                    placeholder="Notes (optional)"
                    multiline
                    numberOfLines={2}
                    editable={!state.skipped}
                  />
                ) : null}
                {!state.skipped && needsRm ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Set 1RM for this exercise"
                    onPress={() => handleResolveRm(idx)}
                  >
                    <Card variant="bordered" style={{ padding: 8 }}>
                      <Text variant="caption">⚠ 1RM needed — click to set</Text>
                    </Card>
                  </Pressable>
                ) : null}
                {!state.skipped && !needsRm && state.rmSourceName ? (
                  <Text variant="caption">
                    ✓ {state.rmSourceName} 1RM: {state.rmWeight}
                    {weightUnit}
                  </Text>
                ) : null}
              </Card>
            );
          })}
          {error ? <Text variant="caption">{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="Add to workout"
              variant="primary"
              loading={isSaving}
              onPress={handleSave}
              disabled={!blocks.every(isReady)}
            />
            <Button
              title="← Edit pasted text"
              variant="ghost"
              onPress={() => setStep('paste')}
              disabled={isSaving}
            />
          </View>
        </View>
      )}

      <RmFormModal
        open={rmFormOpen}
        onClose={() => {
          setRmFormOpen(false);
          setActiveBlockIdx(null);
        }}
        onSave={handleAddRm}
        defaultExerciseName={
          activeBlockIdx !== null ? blocks[activeBlockIdx]?.name ?? '' : ''
        }
        unit={weightUnit}
        isLoading={createRm.isPending}
      />
      <RmSelectModal
        open={rmSelectOpen}
        onClose={() => {
          setRmSelectOpen(false);
          setActiveBlockIdx(null);
        }}
        onSelect={handleSelectMatch}
        onAddNew={() => {
          setRmSelectOpen(false);
          setRmFormOpen(true);
        }}
        matches={partialMatches}
        exerciseName={
          activeBlockIdx !== null ? blocks[activeBlockIdx]?.name ?? '' : ''
        }
        unit={weightUnit}
      />
    </ScrollView>
  );
}
