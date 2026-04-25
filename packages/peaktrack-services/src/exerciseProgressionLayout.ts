import type { ExerciseProgressionRow } from './exerciseProgressionService';
import {
	buildColumnTiles,
	formatWeight,
	normalizePerformed,
	uniqueWeights,
	volumeOf,
	type ColumnLayout,
	type NormalizedSpec,
} from './progressionLayoutCore';

export interface ExerciseSessionLayout {
	logId: string;
	workoutId: string;
	workoutDate: string;
	executedAt: string;
	exerciseName: string;
	isCompound: boolean;
	segmentIndex: number;
	columns: ColumnLayout[];
	/** Volume attributed to the analysed exercise (see `computeAttributedVolume`). */
	volume: number;
	headerWeightLabel?: string;
}

/**
 * Volume attributed to the analysed exercise for a single completed log.
 *
 * For non-compound matches this is the sum of `repsPerSet[i] × weightPerSet[i]`
 * across all set columns — the ordinary training volume.
 *
 * For compound matches this plan locked in **whole-set attribution**: every
 * segment of a compound is credited with `setCount × compound_reps[0] × weight`.
 * Worked example from the plan: `"Power clean + Power jerk"`,
 * `compound_reps = [3, 1]`, `sets = 3`, `weight = 50` — volume for either
 * analysed segment is `3 × 3 × 50 = 450`.
 */
export function computeAttributedVolume(spec: NormalizedSpec): number {
	const compound = spec.compoundSegments;
	if (!compound || compound.length <= 1) {
		return volumeOf(spec);
	}
	const primaryReps = compound[0] ?? 0;
	let v = 0;
	for (let i = 0; i < spec.setCount; i += 1) {
		v += primaryReps * (spec.weightPerSet[i] ?? 0);
	}
	return v;
}

/**
 * Build the per-column tile layout for a single completed log. Mirrors
 * `buildSessionLayout` shape-wise but has no prescribed comparison — every
 * tile renders in the bright base colour, with compound-segment fading driven
 * by the analysed segment index.
 */
export function buildExerciseSessionLayout(input: {
	row: ExerciseProgressionRow;
	weightUnit: string;
}): ExerciseSessionLayout | null {
	const { row, weightUnit } = input;
	const spec = normalizePerformed(row.log);
	if (!spec) {
		return null;
	}

	const columns: ColumnLayout[] = [];
	for (let i = 0; i < spec.setCount; i += 1) {
		const reps = spec.repsPerSet[i] ?? 0;
		const tiles = buildColumnTiles(
			reps,
			'bright',
			spec.compoundSegments,
			row.segmentIndex,
		);
		columns.push({ tiles });
	}

	const uniqueWts = uniqueWeights(spec)
		.slice()
		.sort((a, b) => a - b);
	let headerWeightLabel: string | undefined;
	if (uniqueWts.length === 1 && uniqueWts[0] !== undefined) {
		headerWeightLabel = formatWeight(uniqueWts[0], weightUnit);
	} else if (uniqueWts.length >= 2) {
		const min = uniqueWts[0];
		const max = uniqueWts[uniqueWts.length - 1];
		if (min !== undefined && max !== undefined) {
			headerWeightLabel = `${min}-${formatWeight(max, weightUnit)}`;
		}
	}

	return {
		logId: row.logId,
		workoutId: row.workoutId,
		workoutDate: row.workoutDate,
		executedAt: row.executedAt,
		exerciseName: row.exerciseName,
		isCompound: row.isCompound,
		segmentIndex: row.segmentIndex,
		columns,
		volume: computeAttributedVolume(spec),
		...(headerWeightLabel ? { headerWeightLabel } : {}),
	};
}
