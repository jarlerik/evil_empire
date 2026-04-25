/**
 * Shared primitives for progression-style chart layouts.
 *
 * Both `progressionLayout.ts` (per-program exercise) and
 * `exerciseProgressionLayout.ts` (per-user exercise) build stacked-tile
 * visualisations over the same data shape — sets × reps × weight, with optional
 * per-set weight waves and compound rep segments. This module owns that
 * shape-and-tile primitive layer; the per-screen modules add the
 * screen-specific aggregation on top.
 */

export type TileColor =
	| 'bright'
	| 'faded-bright'
	| 'dark'
	| 'faded-dark'
	| 'dim'
	| 'neutral';

export interface ColumnLayout {
	/** Tiles bottom-to-top. */
	tiles: TileColor[];
	/** Weight label shown under the column (waves only). */
	weightLabel?: string;
}

/**
 * Minimal shape shared by `ExercisePhase` and `ExecutionLogDetail`. Any
 * caller that can produce sets/reps/weight (with optional waves/compound
 * metadata) can plug into this layout layer.
 */
export interface PerformedShape {
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[] | null;
	compound_reps?: number[] | null;
}

export interface NormalizedSpec {
	/** Number of set columns. */
	setCount: number;
	/** Reps per set column (length == setCount). */
	repsPerSet: number[];
	/** Weight per set column (length == setCount). */
	weightPerSet: number[];
	/** True when the spec is a wave (per-set weights differ). */
	isWave: boolean;
	/** Compound segment boundaries within a set, e.g. [2, 2] for `2 + 2`. */
	compoundSegments?: number[];
}

export function sum(xs: number[]): number {
	let total = 0;
	for (const x of xs) {
		total += x;
	}
	return total;
}

export function isWaveWeights(weights: number[] | undefined): weights is number[] {
	return Array.isArray(weights) && weights.length > 1;
}

/**
 * Turn a performed `PerformedShape` (execution log or phase) into a
 * `NormalizedSpec` the renderer can consume. Returns `null` only if the
 * shape is structurally invalid, which today it never is.
 */
export function normalizePerformed(performed: PerformedShape): NormalizedSpec | null {
	const compound = performed.compound_reps ?? undefined;
	const weights = performed.weights ?? undefined;

	if (isWaveWeights(weights) && compound && compound.length === weights.length) {
		return {
			setCount: compound.length,
			repsPerSet: compound,
			weightPerSet: weights,
			isWave: true,
		};
	}

	if (isWaveWeights(weights) && !compound) {
		const reps = performed.repetitions > 0 ? performed.repetitions : 0;
		return {
			setCount: weights.length,
			repsPerSet: new Array(weights.length).fill(reps),
			weightPerSet: weights,
			isWave: true,
		};
	}

	if (compound && compound.length > 0 && !isWaveWeights(weights)) {
		const repsTotal = sum(compound);
		const sets = performed.sets > 0 ? performed.sets : 1;
		return {
			setCount: sets,
			repsPerSet: new Array(sets).fill(repsTotal),
			weightPerSet: new Array(sets).fill(performed.weight),
			isWave: false,
			compoundSegments: compound,
		};
	}

	const sets = performed.sets > 0 ? performed.sets : 1;
	const reps = performed.repetitions > 0 ? performed.repetitions : 0;
	return {
		setCount: sets,
		repsPerSet: new Array(sets).fill(reps),
		weightPerSet: new Array(sets).fill(performed.weight),
		isWave: false,
	};
}

export function volumeOf(spec: NormalizedSpec): number {
	let v = 0;
	for (let i = 0; i < spec.setCount; i += 1) {
		v += (spec.repsPerSet[i] ?? 0) * (spec.weightPerSet[i] ?? 0);
	}
	return v;
}

export function uniqueWeights(spec: NormalizedSpec): number[] {
	return Array.from(new Set(spec.weightPerSet));
}

/**
 * Bottom-to-top tile colours for a single column of a compound or
 * non-compound stack.
 *
 * `highlightSegmentIndex` selects which compound segment gets the full-colour
 * tiles (others render faded). Defaults to `0`, matching the program-progression
 * convention where segment 0 is the "primary" segment (e.g. the clean in a
 * clean + jerk). Exercise-progression passes the segment index of the analysed
 * exercise so the right sub-movement is highlighted.
 */
export function buildColumnTiles(
	repsInColumn: number,
	baseColor: 'bright' | 'dark' | 'dim' | 'neutral',
	compoundSegments: number[] | undefined,
	highlightSegmentIndex: number = 0,
): TileColor[] {
	if (repsInColumn <= 0) {
		return [];
	}
	const fadedBase: TileColor =
		baseColor === 'bright'
			? 'faded-bright'
			: baseColor === 'dark'
				? 'faded-dark'
				: baseColor;
	const full: TileColor = baseColor;

	// Compound: highlighted segment full, others faded. `tiles` is ordered
	// bottom-to-top to match the visual stack.
	if (compoundSegments && compoundSegments.length > 1) {
		const tiles: TileColor[] = [];
		for (let i = 0; i < compoundSegments.length; i += 1) {
			const segmentReps = compoundSegments[i] ?? 0;
			const color = i === highlightSegmentIndex ? full : fadedBase;
			for (let r = 0; r < segmentReps; r += 1) {
				tiles.push(color);
			}
		}
		// Trim to match actual repsInColumn — performed can fall short.
		while (tiles.length > repsInColumn) {
			tiles.pop();
		}
		return tiles;
	}

	const tiles: TileColor[] = [];
	for (let r = 0; r < repsInColumn; r += 1) {
		tiles.push(full);
	}
	return tiles;
}

export function formatKg(kg: number): string {
	if (Number.isInteger(kg)) {
		return `${kg}kg`;
	}
	return `${kg.toFixed(1)}kg`;
}

/**
 * Format a raw stored weight value with the user's preferred unit appended.
 * No conversion — weights are stored and displayed as-is.
 */
export function formatWeight(value: number, unit: string): string {
	const rendered = Number.isInteger(value) ? `${value}` : value.toFixed(1);
	return `${rendered}${unit}`;
}
