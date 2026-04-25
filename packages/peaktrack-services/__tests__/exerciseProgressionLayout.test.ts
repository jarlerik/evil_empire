import type { ExerciseProgressionRow } from '../src/exerciseProgressionService';
import {
	escapeIlike,
	splitCompoundName,
} from '../src/exerciseProgressionService';
import {
	buildExerciseSessionLayout,
	computeAttributedVolume,
} from '../src/exerciseProgressionLayout';
import { normalizePerformed } from '../src/progressionLayoutCore';

function makeRow(overrides: Partial<ExerciseProgressionRow> = {}): ExerciseProgressionRow {
	return {
		logId: 'log-1',
		workoutId: 'w-1',
		workoutDate: '2026-04-01',
		executedAt: '2026-04-01T10:00:00.000Z',
		exerciseName: 'Back squat',
		segmentIndex: 0,
		isCompound: false,
		log: {
			id: 'log-1',
			sets: 3,
			repetitions: 5,
			weight: 100,
			weights: null,
			compound_reps: null,
			executed_at: '2026-04-01T10:00:00.000Z',
		},
		...overrides,
	};
}

describe('computeAttributedVolume', () => {
	it('multiplies sets × reps × weight for a non-compound log', () => {
		const spec = normalizePerformed({
			sets: 3,
			repetitions: 5,
			weight: 100,
			weights: null,
			compound_reps: null,
		});
		expect(spec).not.toBeNull();
		expect(computeAttributedVolume(spec!)).toBe(3 * 5 * 100);
	});

	it('attributes compound volume using the first segment reps (worked example)', () => {
		// "Power clean + Power jerk", compound_reps=[3,1], sets=3, weight=50.
		// Plan §5 worked example: volume must be 3 × 3 × 50 = 450 for either
		// segment under whole-set attribution.
		const spec = normalizePerformed({
			sets: 3,
			repetitions: 4, // total reps per set, informational only
			weight: 50,
			weights: null,
			compound_reps: [3, 1],
		});
		expect(spec).not.toBeNull();
		expect(computeAttributedVolume(spec!)).toBe(3 * 3 * 50);
	});

	it('falls back to summed volume for wave sets (no compound segments)', () => {
		const spec = normalizePerformed({
			sets: 1,
			repetitions: 3,
			weight: 0,
			weights: [80, 90, 100],
			compound_reps: null,
		});
		expect(spec).not.toBeNull();
		expect(computeAttributedVolume(spec!)).toBe(3 * 80 + 3 * 90 + 3 * 100);
	});
});

describe('buildExerciseSessionLayout', () => {
	it('builds bright tiles for every rep of a non-compound log', () => {
		const row = makeRow();
		const layout = buildExerciseSessionLayout({ row, weightUnit: 'kg' });
		expect(layout).not.toBeNull();
		expect(layout!.columns).toHaveLength(3);
		for (const col of layout!.columns) {
			expect(col.tiles).toHaveLength(5);
			for (const tile of col.tiles) {
				expect(tile).toBe('bright');
			}
		}
		expect(layout!.volume).toBe(3 * 5 * 100);
		expect(layout!.headerWeightLabel).toBe('100kg');
	});

	it('highlights the analysed compound segment and fades the others', () => {
		const row = makeRow({
			exerciseName: 'Power clean + Power jerk',
			segmentIndex: 1,
			isCompound: true,
			log: {
				id: 'log-2',
				sets: 3,
				repetitions: 4,
				weight: 50,
				weights: null,
				compound_reps: [3, 1],
				executed_at: '2026-04-01T10:00:00.000Z',
			},
		});
		const layout = buildExerciseSessionLayout({ row, weightUnit: 'kg' });
		expect(layout).not.toBeNull();
		expect(layout!.columns).toHaveLength(3);
		// Each column: 4 reps total, first 3 are the clean (segment 0, faded),
		// last 1 is the jerk (segment 1, bright).
		for (const col of layout!.columns) {
			expect(col.tiles).toEqual(['faded-bright', 'faded-bright', 'faded-bright', 'bright']);
		}
		expect(layout!.volume).toBe(3 * 3 * 50);
	});

	it('respects the weight unit suffix without converting the stored value', () => {
		const row = makeRow({
			log: {
				id: 'log-3',
				sets: 1,
				repetitions: 5,
				weight: 225,
				weights: null,
				compound_reps: null,
				executed_at: '2026-04-01T10:00:00.000Z',
			},
		});
		const kg = buildExerciseSessionLayout({ row, weightUnit: 'kg' });
		const lbs = buildExerciseSessionLayout({ row, weightUnit: 'lbs' });
		expect(kg!.headerWeightLabel).toBe('225kg');
		expect(lbs!.headerWeightLabel).toBe('225lbs');
	});
});

describe('escapeIlike', () => {
	it('escapes %, _, and \\ so user input does not become a LIKE wildcard', () => {
		expect(escapeIlike('50%')).toBe('50\\%');
		expect(escapeIlike('back_squat')).toBe('back\\_squat');
		expect(escapeIlike('a\\b')).toBe('a\\\\b');
	});

	it('passes ordinary names through unchanged', () => {
		expect(escapeIlike('Power clean')).toBe('Power clean');
	});
});

describe('splitCompoundName', () => {
	it('splits on + with flexible whitespace', () => {
		expect(splitCompoundName('Power clean + Power jerk')).toEqual([
			'Power clean',
			'Power jerk',
		]);
		expect(splitCompoundName('Power clean+Power jerk')).toEqual([
			'Power clean',
			'Power jerk',
		]);
		expect(splitCompoundName('A  +  B +C')).toEqual(['A', 'B', 'C']);
	});

	it('returns a single segment for a non-compound name', () => {
		expect(splitCompoundName('Back squat')).toEqual(['Back squat']);
	});

	it('drops empty segments', () => {
		expect(splitCompoundName('Back squat + ')).toEqual(['Back squat']);
	});
});
