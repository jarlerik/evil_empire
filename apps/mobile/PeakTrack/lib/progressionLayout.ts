import { parseSetInput, ParsedSetData } from '@evil-empire/parsers';
import type {
	ProgramExercise,
	ProgramRepetitionMaximum,
} from '@evil-empire/types';

/**
 * Minimal shape shared by `ExercisePhase` and `ExecutionLogDetail`. The
 * progression view only needs the set/rep/weight dimensions to render tiles
 * and compute volume, so we type the performed input loosely to accept either.
 */
export interface PerformedShape {
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[] | null;
	compound_reps?: number[] | null;
}
import {
	exerciseNeedsRmSnapshot,
	resolveWeightsFromSnapshot,
} from './resolveProgramWeights';

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

export interface SessionLayout {
	sessionId: string;
	dayLabel: string;
	weekOffset: number;
	dayOfWeek: number;
	columns: ColumnLayout[];
	/** Total performed volume in kg (null when the session was not performed). */
	performedVolume: number | null;
	/** Prescribed volume in kg (null when prescription is missing or unparseable). */
	prescribedVolume: number | null;
	/** Single weight label shown above the stack for uniform-weight sessions. */
	headerWeightLabel?: string;
	/** Did the user materialize a workout for this session? */
	hasPerformed: boolean;
	/** Was the prescription unparseable? (render without deviation shading) */
	unparseablePrescription: boolean;
}

const DAY_LABELS: Record<number, string> = {
	1: 'Mon',
	2: 'Tue',
	3: 'Wed',
	4: 'Thu',
	5: 'Fri',
	6: 'Sat',
	7: 'Sun',
};

interface NormalizedSpec {
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

function sum(xs: number[]): number {
	let total = 0;
	for (const x of xs) {
		total += x;
	}
	return total;
}

function isWaveWeights(weights: number[] | undefined): weights is number[] {
	return Array.isArray(weights) && weights.length > 1;
}

/**
 * Turn a parsed prescribed exercise into a uniform shape the renderer can
 * consume: how many set columns, reps per column, weight per column.
 * Resolves percentages via `resolveWeightsFromSnapshot` using the program RM snapshot.
 */
export function normalizePrescribed(
	prescribed: ProgramExercise,
	programRms: ProgramRepetitionMaximum[],
): NormalizedSpec | null {
	const parsed = parseSetInput(prescribed.raw_input);
	if (!parsed.isValid) {
		return null;
	}

	let resolvedWeight = parsed.weight;
	let resolvedWeights: number[] | undefined = parsed.weights;
	if (exerciseNeedsRmSnapshot(parsed)) {
		try {
			const r = resolveWeightsFromSnapshot(prescribed.name, parsed, programRms);
			resolvedWeight = r.weight;
			resolvedWeights = r.weights ?? resolvedWeights;
		} catch {
			return null;
		}
	}

	return normalizeFromParsed(parsed, resolvedWeight, resolvedWeights);
}

function normalizeFromParsed(
	parsed: ParsedSetData,
	resolvedWeight: number,
	resolvedWeights: number[] | undefined,
): NormalizedSpec | null {
	const compound = parsed.compoundReps;

	if (isWaveWeights(resolvedWeights) && compound && compound.length === resolvedWeights.length) {
		return {
			setCount: compound.length,
			repsPerSet: compound,
			weightPerSet: resolvedWeights,
			isWave: true,
		};
	}

	if (isWaveWeights(resolvedWeights) && !compound) {
		const reps = parsed.reps > 0 ? parsed.reps : 0;
		return {
			setCount: resolvedWeights.length,
			repsPerSet: new Array(resolvedWeights.length).fill(reps),
			weightPerSet: resolvedWeights,
			isWave: true,
		};
	}

	if (compound && compound.length > 0 && !isWaveWeights(resolvedWeights)) {
		const repsTotal = sum(compound);
		const sets = parsed.sets > 0 ? parsed.sets : 1;
		return {
			setCount: sets,
			repsPerSet: new Array(sets).fill(repsTotal),
			weightPerSet: new Array(sets).fill(resolvedWeight),
			isWave: false,
			compoundSegments: compound,
		};
	}

	const sets = parsed.sets > 0 ? parsed.sets : 1;
	const reps = parsed.reps > 0 ? parsed.reps : 0;
	return {
		setCount: sets,
		repsPerSet: new Array(sets).fill(reps),
		weightPerSet: new Array(sets).fill(resolvedWeight),
		isWave: false,
	};
}

/**
 * Turn a performed `PerformedShape` (execution log or phase) into the same
 * shape as a prescribed spec. This lets the renderer compare like-with-like.
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

function volumeOf(spec: NormalizedSpec): number {
	let v = 0;
	for (let i = 0; i < spec.setCount; i += 1) {
		v += (spec.repsPerSet[i] ?? 0) * (spec.weightPerSet[i] ?? 0);
	}
	return v;
}

function formatKg(kg: number): string {
	if (Number.isInteger(kg)) {
		return `${kg}kg`;
	}
	return `${kg.toFixed(1)}kg`;
}

function uniqueWeights(spec: NormalizedSpec): number[] {
	return Array.from(new Set(spec.weightPerSet));
}

function buildColumnTiles(
	repsInColumn: number,
	baseColor: 'bright' | 'dark' | 'dim' | 'neutral',
	compoundSegments: number[] | undefined,
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

	// Compound: first segment full, subsequent segments faded. `tiles` is
	// ordered bottom-to-top to match the visual stack.
	if (compoundSegments && compoundSegments.length > 1) {
		const tiles: TileColor[] = [];
		for (let i = 0; i < compoundSegments.length; i += 1) {
			const segmentReps = compoundSegments[i] ?? 0;
			const color = i === 0 ? full : fadedBase;
			for (let r = 0; r < segmentReps; r += 1) {
				tiles.push(color);
			}
		}
		// Trim/pad to match actual repsInColumn — performed can fall short.
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

/**
 * Compute the layout for a single session column in the progression chart.
 * Handles all four cases (prescribed only, performed only, both, neither).
 */
export function buildSessionLayout(input: {
	sessionId: string;
	weekOffset: number;
	dayOfWeek: number;
	prescribed: ProgramExercise | null;
	performed: PerformedShape | null;
	programRms: ProgramRepetitionMaximum[];
}): SessionLayout {
	const { sessionId, weekOffset, dayOfWeek, prescribed, performed, programRms } = input;

	const prescribedSpec = prescribed
		? normalizePrescribed(prescribed, programRms)
		: null;
	const performedSpec = performed ? normalizePerformed(performed) : null;
	const unparseablePrescription = Boolean(prescribed) && prescribedSpec === null;

	const prescribedVolume = prescribedSpec ? volumeOf(prescribedSpec) : null;
	const performedVolume = performedSpec ? volumeOf(performedSpec) : null;

	const columnCount = Math.max(
		prescribedSpec?.setCount ?? 0,
		performedSpec?.setCount ?? 0,
	);

	// Per-column weight labels are only useful when reps also vary (true wave):
	// they pair each varying stack height with its weight. When reps are uniform
	// across columns, many identical-looking labels collide visually (the column
	// is only TILE_SIZE wide) and the same info is clearer in a range header.
	const refSpec = performedSpec ?? prescribedSpec;
	const repsUniform = refSpec
		? new Set(refSpec.repsPerSet.slice(0, refSpec.setCount)).size <= 1
		: true;
	const anyWave =
		(performedSpec?.isWave ?? false) || (prescribedSpec?.isWave ?? false);
	const showPerColumnWeight = anyWave && !repsUniform;

	const columns: ColumnLayout[] = [];
	for (let i = 0; i < columnCount; i += 1) {
		const prescribedReps = prescribedSpec?.repsPerSet[i];
		const prescribedWeight = prescribedSpec?.weightPerSet[i];
		const performedReps = performedSpec?.repsPerSet[i];
		const performedWeight = performedSpec?.weightPerSet[i];

		let baseColor: 'bright' | 'dark' | 'dim' | 'neutral' = 'neutral';
		let reps = 0;
		if (performedReps !== undefined && performedWeight !== undefined) {
			reps = performedReps;
			if (unparseablePrescription || prescribedReps === undefined) {
				// No valid prescription to compare against — neutral-but-performed.
				baseColor = 'bright';
			} else if (
				performedReps >= prescribedReps &&
				performedWeight >= (prescribedWeight ?? 0)
			) {
				baseColor = 'bright';
			} else {
				baseColor = 'dark';
			}
		} else if (prescribedReps !== undefined) {
			reps = prescribedReps;
			baseColor = 'dim';
		}

		const compoundSegments =
			performedSpec?.compoundSegments ?? prescribedSpec?.compoundSegments;

		const tiles = buildColumnTiles(reps, baseColor, compoundSegments);

		const weightForLabel = performedWeight ?? prescribedWeight;
		columns.push({
			tiles,
			...(showPerColumnWeight && weightForLabel !== undefined
				? { weightLabel: formatKg(weightForLabel) }
				: {}),
		});
	}

	const uniqueWts = refSpec
		? uniqueWeights(refSpec).slice().sort((a, b) => a - b)
		: [];
	let headerWeightLabel: string | undefined;
	if (uniqueWts.length === 1 && uniqueWts[0] !== undefined) {
		headerWeightLabel = formatKg(uniqueWts[0]);
	} else if (uniqueWts.length >= 2) {
		const min = uniqueWts[0];
		const max = uniqueWts[uniqueWts.length - 1];
		if (min !== undefined && max !== undefined) {
			headerWeightLabel = `${min}-${formatKg(max)}`;
		}
	}

	return {
		sessionId,
		weekOffset,
		dayOfWeek,
		dayLabel: DAY_LABELS[dayOfWeek] ?? '',
		columns,
		performedVolume,
		prescribedVolume,
		...(headerWeightLabel ? { headerWeightLabel } : {}),
		hasPerformed: performedSpec !== null,
		unparseablePrescription,
	};
}
