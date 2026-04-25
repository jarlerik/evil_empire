import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Input, Text } from '@evil-empire/ui';
import {
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from 'date-fns';
import { parseSetInput } from '@evil-empire/parsers';
import {
  exerciseNeedsRmSnapshot,
  fetchAllRmsByReps,
  findProgramRm,
  lookupExactRm,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import {
  useAssignProgramStart,
  useProgramDetail,
  useUpsertProgramRm,
} from '../hooks/use-programs';
import { useCreateRm } from '../hooks/use-rms';

interface SearchParams {
  reassign?: number;
}

export const Route = createFileRoute('/_app/programs/$id/assign')({
  component: ProgramAssignPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    reassign: search.reassign === 1 || search.reassign === '1' ? 1 : undefined,
  }),
});

interface NameEntry {
  name: string;
  weight: string;
  source: 'lookup' | 'partial_match' | 'manual' | null;
  testedAt: string | null;
  suggestions: { exerciseName: string; weight: number }[];
  resolved: boolean;
}

function ProgramAssignPage() {
  const { id } = Route.useParams();
  const { reassign } = Route.useSearch();
  const isReassign = reassign === 1;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const weightUnit = settings?.weight_unit ?? 'kg';

  const { data, isLoading, error } = useProgramDetail(id);
  const assignStart = useAssignProgramStart();
  const upsertProgramRm = useUpsertProgramRm();
  const createRm = useCreateRm(user?.id);

  const [step, setStep] = useState<1 | 2>(1);
  const [startYear, setStartYear] = useState<number>(() => getISOWeekYear(new Date()));
  const [startWeek, setStartWeek] = useState<number>(() => getISOWeek(new Date()));
  const [names, setNames] = useState<NameEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Hydrate names from the program — only the first time data lands. We do
  // background lookups against the user's RMs to pre-fill exact matches and
  // surface partial-match suggestions.
  useEffect(() => {
    if (hydrated || !data || !user) return;
    const program = data.program;
    if (program.start_iso_year != null) setStartYear(program.start_iso_year);
    if (program.start_iso_week != null) setStartWeek(program.start_iso_week);

    const seen = new Map<string, string>();
    for (const ex of data.exercises) {
      const parsed = parseSetInput(ex.raw_input);
      if (!exerciseNeedsRmSnapshot(parsed)) continue;
      const key = ex.name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, ex.name.trim());
    }

    const entries: NameEntry[] = Array.from(seen.values()).map((original) => {
      const existing = findProgramRm(original, data.rms);
      if (existing) {
        return {
          name: original,
          weight: String(existing.weight),
          source: existing.source,
          testedAt: existing.tested_at,
          suggestions: [],
          resolved: true,
        };
      }
      return {
        name: original,
        weight: '',
        source: null,
        testedAt: null,
        suggestions: [],
        resolved: false,
      };
    });
    setNames(entries);
    setHydrated(true);

    // Background-resolve unresolved entries against the user's global RMs.
    void (async () => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].resolved) continue;
        const name = entries[i].name;
        const { data: exact } = await lookupExactRm(user.id, name, 1);
        if (exact?.weight) {
          setNames((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], weight: String(exact.weight), source: 'lookup' };
            return next;
          });
          continue;
        }
        const { data: partials } = await fetchAllRmsByReps(user.id, 1);
        if (partials && partials.length > 0) {
          const lower = name.toLowerCase();
          const matches = partials
            .filter(
              (p) =>
                p.exercise_name.toLowerCase().includes(lower) ||
                lower.includes(p.exercise_name.toLowerCase()),
            )
            .map((p) => ({ exerciseName: p.exercise_name, weight: p.weight }));
          if (matches.length > 0) {
            setNames((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], suggestions: matches };
              return next;
            });
          }
        }
      }
    })();
  }, [hydrated, data, user]);

  const startWeekDateRange = useMemo(() => {
    const anchor = startOfISOWeek(
      setISOWeek(setISOWeekYear(new Date(), startYear), startWeek),
    );
    const end = addDays(anchor, 6);
    return `${format(anchor, 'MMM d')} – ${format(end, 'MMM d')}`;
  }, [startYear, startWeek]);

  const endWeekLabel = useMemo(() => {
    if (!data) return '';
    const anchor = startOfISOWeek(
      setISOWeek(setISOWeekYear(new Date(), startYear), startWeek),
    );
    const endDate = addDays(anchor, data.program.duration_weeks * 7 - 1);
    return `Week ${getISOWeek(endDate)}, ${getISOWeekYear(endDate)} (${format(endDate, 'MMM d')})`;
  }, [data, startYear, startWeek]);

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

  const moveWeek = (delta: number) => {
    const anchor = startOfISOWeek(
      setISOWeek(setISOWeekYear(new Date(), startYear), startWeek),
    );
    const next = addDays(anchor, delta * 7);
    setStartYear(getISOWeekYear(next));
    setStartWeek(getISOWeek(next));
  };

  const updateName = (idx: number, patch: Partial<NameEntry>) => {
    setNames((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  };

  const allResolved = names.every((n) => {
    const w = parseFloat(n.weight);
    return Number.isFinite(w) && w > 0;
  });

  const hasUnresolvedNewNames = names.some((n) => {
    const w = parseFloat(n.weight);
    return !Number.isFinite(w) || w <= 0;
  });

  const handleConfirmWeek = async () => {
    setSaveError('');
    if (isReassign) {
      if (hasUnresolvedNewNames) {
        // Re-assigning into a plan that grew new percentage-based exercises
        // since the original assignment — collect those before shifting.
        setStep(2);
        return;
      }
      if (
        !window.confirm(
          'Future virtual sessions will shift to the new start week. Workouts you have already started stay on the dates you did them. Your 1RM snapshot is preserved.',
        )
      )
        return;
      try {
        await assignStart.mutateAsync({ id: program.id, isoYear: startYear, isoWeek: startWeek });
        navigate({ to: '/programs/$id', params: { id: program.id } });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to re-assign');
      }
      return;
    }
    setStep(2);
  };

  const handleStart = async () => {
    if (!user) return;
    if (!allResolved) {
      setSaveError('Resolve every 1RM before starting.');
      return;
    }
    setSaveError('');

    try {
      for (const entry of names) {
        const w = parseFloat(entry.weight);
        const source = entry.source ?? 'manual';
        await upsertProgramRm.mutateAsync({
          programId: program.id,
          exerciseName: entry.name,
          weight: w,
          source,
          testedAt: entry.testedAt,
        });
        // Manual entries also write to the user's global RMs so future
        // programs benefit. Failures here are non-fatal — the snapshot is
        // what materialization reads from.
        if (source === 'manual') {
          try {
            await createRm.mutateAsync({
              exerciseName: entry.name,
              reps: 1,
              weight: w,
              date: format(new Date(), 'yyyy-MM-dd'),
            });
          } catch {
            // ignore
          }
        }
      }
      await assignStart.mutateAsync({ id: program.id, isoYear: startYear, isoWeek: startWeek });
      navigate({ to: '/programs/$id', params: { id: program.id } });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to start program');
    }
  };

  const isSavingStart = upsertProgramRm.isPending || assignStart.isPending;
  const isSavingReassign = assignStart.isPending;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button
          title="‹ Back"
          variant="ghost"
          size="sm"
          onPress={() =>
            step === 2
              ? setStep(1)
              : navigate({ to: '/programs/$id', params: { id: program.id } })
          }
        />
        <Text variant="display">
          {isReassign ? 'Re-assign' : 'Assign'} {program.name}
        </Text>
      </View>

      {step === 1 ? (
        <>
          <Card variant="bordered" style={{ gap: 12 }}>
            <Text variant="heading-sm">Pick a start week</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Button title="‹" variant="outline" size="sm" onPress={() => moveWeek(-1)} />
              <View style={{ alignItems: 'center' }}>
                <Text variant="heading-sm">
                  Week {startWeek}, {startYear}
                </Text>
                <Text variant="caption">{startWeekDateRange}</Text>
              </View>
              <Button title="›" variant="outline" size="sm" onPress={() => moveWeek(1)} />
            </View>
            <Text variant="caption">
              {program.duration_weeks} week{program.duration_weeks === 1 ? '' : 's'} · ends{' '}
              {endWeekLabel}
            </Text>
          </Card>

          {saveError ? <Text variant="caption">{saveError}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title={isReassign ? 'Re-assign' : 'Next: set 1RMs'}
              variant="primary"
              loading={isSavingReassign}
              onPress={handleConfirmWeek}
            />
          </View>
        </>
      ) : (
        <>
          <Text variant="heading-sm">Set your 1RMs</Text>
          {names.length === 0 ? (
            <Text variant="caption">No percentage-based exercises found.</Text>
          ) : (
            names.map((entry, idx) => {
              const w = parseFloat(entry.weight);
              const valid = Number.isFinite(w) && w > 0;
              return (
                <Card key={entry.name} variant="bordered" style={{ gap: 8 }}>
                  <Text variant="heading-sm">{entry.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        value={entry.weight}
                        onChangeText={(text) =>
                          updateName(idx, {
                            weight: text.replace(/[^0-9.]/g, ''),
                            source: entry.source ?? 'manual',
                          })
                        }
                        placeholder={weightUnit}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                      />
                    </View>
                    <Text variant="caption">{weightUnit}</Text>
                    {valid ? <Text variant="caption">✓</Text> : null}
                  </View>
                  {entry.source === 'lookup' ? (
                    <Text variant="caption">Found in your RMs</Text>
                  ) : null}
                  {entry.suggestions.length > 0 && !valid ? (
                    <View style={{ gap: 4 }}>
                      <Text variant="caption">Similar RMs:</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {entry.suggestions.map((s) => (
                          <Button
                            key={s.exerciseName}
                            title={`${s.exerciseName}: ${s.weight}${weightUnit}`}
                            variant="outline"
                            size="sm"
                            onPress={() =>
                              updateName(idx, {
                                weight: String(s.weight),
                                source: 'partial_match',
                                suggestions: [],
                              })
                            }
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}

          {saveError ? <Text variant="caption">{saveError}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title={isReassign ? 'Re-assign' : 'Start program'}
              variant="primary"
              loading={isSavingStart}
              disabled={!allResolved && names.length > 0}
              onPress={handleStart}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
