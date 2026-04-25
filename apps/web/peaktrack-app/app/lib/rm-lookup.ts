import { lookupExactRm, fetchAllRmsByReps } from '@evil-empire/peaktrack-services';
import type { ParsedSetData } from '@evil-empire/parsers';

export interface RmMatch {
  exerciseName: string;
  weight: number;
}

export interface ResolvedWeights {
  weight: number;
  weightMin?: number;
  weightMax?: number;
  weights?: number[];
  rmWeight?: number;
  rmSourceName?: string;
}

export type ResolveResult =
  | { kind: 'ok'; weights: ResolvedWeights; finalParsed: ParsedSetData }
  | { kind: 'needs-rm'; partialMatches: RmMatch[]; error: string };

function calcFromPercentage(rmWeight: number, percentage: number) {
  return Math.round((rmWeight * percentage) / 100);
}

function applyRm(
  rmWeight: number,
  parsed: ParsedSetData,
  rmSourceName?: string,
): ResolvedWeights {
  let weight = parsed.weight;
  let weightMin: number | undefined;
  let weightMax: number | undefined;
  let weights: number[] | undefined;

  if (parsed.weights && parsed.weights.length > 1) {
    weights = parsed.weights.map((p) => calcFromPercentage(rmWeight, p));
    weight = weights[0];
    if (parsed.weightMinPercentage !== undefined && parsed.weightMaxPercentage !== undefined) {
      weightMin = calcFromPercentage(rmWeight, parsed.weightMinPercentage);
      weightMax = calcFromPercentage(rmWeight, parsed.weightMaxPercentage);
    }
  } else if (parsed.weightMinPercentage !== undefined && parsed.weightMaxPercentage !== undefined) {
    weightMin = calcFromPercentage(rmWeight, parsed.weightMinPercentage);
    weightMax = calcFromPercentage(rmWeight, parsed.weightMaxPercentage);
    weight = weightMin;
  } else if (parsed.weightPercentage !== undefined) {
    weight = calcFromPercentage(rmWeight, parsed.weightPercentage);
  }

  if (parsed.weightMin !== undefined && parsed.weightMax !== undefined) {
    weightMin = parsed.weightMin;
    weightMax = parsed.weightMax;
    weight = weightMin;
  }

  return {
    weight,
    weightMin,
    weightMax,
    ...(weights && { weights }),
    rmWeight,
    ...(rmSourceName && { rmSourceName }),
  };
}

function buildRmSourceNote(
  parsed: ParsedSetData,
  rmWeight: number,
  rmName: string,
  weightUnit: string,
): string {
  const pct = parsed.weightPercentage;
  const pctMin = parsed.weightMinPercentage;
  const pctMax = parsed.weightMaxPercentage;
  let pctLabel = '';

  if (parsed.weights && parsed.weights.length > 1 && pctMin !== undefined && pctMax !== undefined) {
    pctLabel = parsed.weights
      .map((w, i) => (i === parsed.weights!.length - 1 ? `${pctMin}-${pctMax}%` : `${w}%`))
      .join(', ');
  } else if (pctMin !== undefined && pctMax !== undefined) {
    pctLabel = `${pctMin}-${pctMax}%`;
  } else if (parsed.weights && parsed.weights.length > 1) {
    pctLabel = parsed.weights.map((w) => `${w}%`).join(', ');
  } else if (pct !== undefined) {
    pctLabel = `${pct}%`;
  }

  return pctLabel
    ? `${pctLabel} of ${rmName} 1RM (${rmWeight}${weightUnit})`
    : `${rmName} 1RM (${rmWeight}${weightUnit})`;
}

export async function findPartialRmMatches(
  userId: string,
  exerciseName: string,
): Promise<RmMatch[]> {
  const { data: allRms } = await fetchAllRmsByReps(userId, 1);
  if (!allRms || allRms.length === 0) return [];

  const exerciseParts = exerciseName.includes('+')
    ? exerciseName.split('+').map((p) => p.trim().toLowerCase())
    : [exerciseName.trim().toLowerCase()];
  const seen = new Set<string>();
  const matches: RmMatch[] = [];

  for (const rm of allRms) {
    const lower = rm.exercise_name.toLowerCase();
    if (seen.has(lower)) continue;
    for (const part of exerciseParts) {
      if (lower.includes(part) || part.includes(lower)) {
        seen.add(lower);
        matches.push({ exerciseName: rm.exercise_name, weight: rm.weight });
        break;
      }
    }
  }
  return matches;
}

export async function resolveWeights(params: {
  userId: string;
  exerciseName: string;
  parsed: ParsedSetData;
  weightUnit: string;
  rmOverride?: { weight: number; sourceName?: string };
}): Promise<ResolveResult> {
  const { userId, exerciseName, parsed, weightUnit, rmOverride } = params;

  if (!parsed.needsRmLookup) {
    let weight = parsed.weight;
    let weightMin: number | undefined;
    let weightMax: number | undefined;
    if (parsed.weightMin !== undefined && parsed.weightMax !== undefined) {
      weightMin = parsed.weightMin;
      weightMax = parsed.weightMax;
      weight = weightMin;
    }
    return {
      kind: 'ok',
      weights: { weight, weightMin, weightMax },
      finalParsed: parsed,
    };
  }

  let rmWeight: number | undefined;
  let rmSource: string | undefined;

  if (rmOverride) {
    rmWeight = rmOverride.weight;
    rmSource = rmOverride.sourceName ?? exerciseName;
  } else {
    const { data } = await lookupExactRm(userId, exerciseName, 1);
    if (data?.weight) {
      rmWeight = data.weight;
      rmSource = exerciseName;
    }
  }

  if (rmWeight === undefined) {
    const partials = await findPartialRmMatches(userId, exerciseName);
    return {
      kind: 'needs-rm',
      partialMatches: partials,
      error: `No 1RM found for "${exerciseName}".`,
    };
  }

  const weights = applyRm(rmWeight, parsed, rmSource);

  let finalParsed = weights.weights ? { ...parsed, weights: weights.weights } : parsed;

  // Append RM source note
  const note = buildRmSourceNote(parsed, rmWeight, rmSource ?? exerciseName, weightUnit);
  finalParsed = { ...finalParsed, notes: note };

  // Wave: resolve percentages to absolute weights
  if (finalParsed.exerciseType === 'wave' && finalParsed.weights) {
    finalParsed = {
      ...finalParsed,
      weights: finalParsed.weights.map((pct) => Math.round((rmWeight! * pct) / 100)),
    };
  }

  return { kind: 'ok', weights, finalParsed };
}
