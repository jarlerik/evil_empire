import type { ParsedSetData } from '@evil-empire/parsers';
import type { ProgramRepetitionMaximum } from '@evil-empire/types';

export interface ResolvedWeights {
	weight: number;
	weightMin?: number;
	weightMax?: number;
	weights?: number[];
	rmWeight: number;
	rmSourceName: string;
}

/**
 * The single source of truth for "does this exercise need a program 1RM snapshot?".
 *
 * Used at assignment precollect, cell-save new-name detection, virtual-card
 * render, and Start. Any parser branch that emits a percentage or
 * `Build to XRM`-style spec sets `needsRmLookup: true` — this predicate
 * simply forwards that flag so the invariant "every name needing a snapshot
 * has one by `status='active'`" holds by construction.
 */
export function exerciseNeedsRmSnapshot(parsed: ParsedSetData): boolean {
	return parsed.isValid && parsed.needsRmLookup === true;
}

function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * Find the snapshot row for `exerciseName` in the given program RMs.
 * Case-insensitive + trimmed match — matches the functional unique index
 * `(program_id, LOWER(exercise_name))` in the DB.
 */
export function findProgramRm(
	exerciseName: string,
	programRms: ProgramRepetitionMaximum[],
): ProgramRepetitionMaximum | null {
	const needle = normalizeName(exerciseName);
	return programRms.find(r => normalizeName(r.exercise_name) === needle) ?? null;
}

function roundPct(rm: number, pct: number): number {
	return Math.round((rm * pct) / 100);
}

/**
 * Resolve weights for a parsed set using a passed-in program RM snapshot.
 * Mirrors the behavior of `useRmLookup.calculateWeightsFromParsedData` but
 * reads from a pinned snapshot instead of the user's live repetition_maximums.
 *
 * Throws when a snapshot is required but missing — this is a programming
 * invariant violation (assignment should have pre-collected every name
 * needing a snapshot) and callers should surface an inline "Resolve now"
 * recovery UI rather than silently falling back to global RMs.
 */
export function resolveWeightsFromSnapshot(
	exerciseName: string,
	parsed: ParsedSetData,
	programRms: ProgramRepetitionMaximum[],
): ResolvedWeights {
	// Not an RM-dependent spec — just pass absolute weights through.
	if (!exerciseNeedsRmSnapshot(parsed)) {
		return {
			weight: parsed.weight,
			...(parsed.weightMin !== undefined && { weightMin: parsed.weightMin }),
			...(parsed.weightMax !== undefined && { weightMax: parsed.weightMax }),
			...(parsed.weights && { weights: parsed.weights }),
			rmWeight: 0,
			rmSourceName: '',
		};
	}

	const snapshot = findProgramRm(exerciseName, programRms);
	if (!snapshot) {
		throw new Error(
			`No program 1RM snapshot for "${exerciseName}". Assignment should have collected this.`,
		);
	}

	const rm = Number(snapshot.weight);
	let weight = parsed.weight;
	let weightMin: number | undefined;
	let weightMax: number | undefined;
	let weights: number[] | undefined;

	// Per-set percentages (compound with multiple percentages, etc.)
	if (parsed.weights && parsed.weights.length > 1) {
		weights = parsed.weights.map(p => roundPct(rm, p));
		weight = weights[0] ?? 0;

		if (parsed.weightMinPercentage !== undefined && parsed.weightMaxPercentage !== undefined) {
			weightMin = roundPct(rm, parsed.weightMinPercentage);
			weightMax = roundPct(rm, parsed.weightMaxPercentage);
		}
	}
	// Percentage range (e.g. 80-85%)
	else if (parsed.weightMinPercentage !== undefined && parsed.weightMaxPercentage !== undefined) {
		weightMin = roundPct(rm, parsed.weightMinPercentage);
		weightMax = roundPct(rm, parsed.weightMaxPercentage);
		weight = weightMin;
	}
	// Simple percentage
	else if (parsed.weightPercentage !== undefined) {
		weight = roundPct(rm, parsed.weightPercentage);
	}

	// Absolute weight range — unusual when needsRmLookup is true, but keep in
	// lockstep with useRmLookup's treatment.
	if (parsed.weightMin !== undefined && parsed.weightMax !== undefined) {
		weightMin = parsed.weightMin;
		weightMax = parsed.weightMax;
		weight = weightMin;
	}

	return {
		weight,
		...(weightMin !== undefined && { weightMin }),
		...(weightMax !== undefined && { weightMax }),
		...(weights && { weights }),
		rmWeight: rm,
		rmSourceName: snapshot.exercise_name,
	};
}
