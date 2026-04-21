import type { ExercisePhase } from '@evil-empire/parsers';
import type {
	ProgramExercise,
	ProgramRepetitionMaximum,
} from '@evil-empire/types';
import { buildSessionLayout } from '../progressionLayout';

function makeRm(name: string, weight: number): ProgramRepetitionMaximum {
	return {
		id: `rm-${name}`,
		program_id: 'p1',
		user_id: 'u1',
		exercise_name: name,
		weight,
		tested_at: null,
		source: 'manual',
	};
}

function makePrescribed(rawInput: string, name = 'Back Squat'): ProgramExercise {
	return {
		id: 'pe-1',
		program_session_id: 's1',
		user_id: 'u1',
		order_index: 0,
		name,
		raw_input: rawInput,
		notes: null,
	};
}

function makePhase(input: Partial<ExercisePhase>): ExercisePhase {
	return {
		id: 'ph-1',
		exercise_id: 'ex-1',
		sets: input.sets ?? 1,
		repetitions: input.repetitions ?? 1,
		weight: input.weight ?? 0,
		created_at: '2026-01-01',
		...input,
	};
}

describe('buildSessionLayout', () => {
	const baseInput = {
		sessionId: 's1',
		weekOffset: 0,
		dayOfWeek: 1,
	};

	describe('linear sets', () => {
		it('renders performed-matches-prescribed as all bright', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('6 x 2 @104kg'),
				performed: makePhase({ sets: 6, repetitions: 2, weight: 104 }),
				programRms: [],
			});
			expect(layout.columns).toHaveLength(6);
			expect(layout.columns.every(c => c.tiles.every(t => t === 'bright'))).toBe(true);
			expect(layout.performedVolume).toBe(6 * 2 * 104);
			expect(layout.prescribedVolume).toBe(6 * 2 * 104);
			expect(layout.headerWeightLabel).toBe('104kg');
		});

		it('marks below-prescription columns as dark', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('6 x 2 @104kg'),
				performed: makePhase({ sets: 6, repetitions: 1, weight: 104 }),
				programRms: [],
			});
			expect(layout.columns.every(c => c.tiles.every(t => t === 'dark'))).toBe(true);
		});

		it('resolves percentage prescription via program RM', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('6 x 2 @80%'),
				performed: makePhase({ sets: 6, repetitions: 2, weight: 104 }),
				programRms: [makeRm('Back Squat', 130)],
			});
			// 80% of 130 = 104
			expect(layout.prescribedVolume).toBe(6 * 2 * 104);
			expect(layout.columns.every(c => c.tiles.every(t => t === 'bright'))).toBe(true);
		});
	});

	describe('missed sessions / partial', () => {
		it('shows dim tiles when prescribed but not performed', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('6 x 2 @104kg'),
				performed: null,
				programRms: [],
			});
			expect(layout.hasPerformed).toBe(false);
			expect(layout.performedVolume).toBeNull();
			expect(layout.columns.every(c => c.tiles.every(t => t === 'dim'))).toBe(true);
		});

		it('dims only the columns that are missing from performance', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('6 x 2 @104kg'),
				performed: makePhase({ sets: 4, repetitions: 2, weight: 104 }),
				programRms: [],
			});
			expect(layout.columns).toHaveLength(6);
			for (let i = 0; i < 4; i += 1) {
				expect(layout.columns[i]?.tiles.every(t => t === 'bright')).toBe(true);
			}
			for (let i = 4; i < 6; i += 1) {
				expect(layout.columns[i]?.tiles.every(t => t === 'dim')).toBe(true);
			}
		});
	});

	describe('compound (same-exercise)', () => {
		it('applies full/faded shading inside each column', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('3 x 2 + 2 @50kg'),
				performed: makePhase({
					sets: 3,
					repetitions: 4,
					weight: 50,
					compound_reps: [2, 2],
				}),
				programRms: [],
			});
			expect(layout.columns).toHaveLength(3);
			const col = layout.columns[0];
			expect(col?.tiles).toHaveLength(4);
			expect(col?.tiles[0]).toBe('bright');
			expect(col?.tiles[1]).toBe('bright');
			expect(col?.tiles[2]).toBe('faded-bright');
			expect(col?.tiles[3]).toBe('faded-bright');
			expect(layout.performedVolume).toBe(3 * 4 * 50);
		});
	});

	describe('per-set weights without compound reps', () => {
		it('uses each weight as its own set and sums real per-set volume', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('6 x 2 @100 100 102 102 105 105kg'),
				performed: makePhase({
					sets: 6,
					repetitions: 2,
					weight: 100,
					weights: [100, 100, 102, 102, 105, 105],
				}),
				programRms: [],
			});
			expect(layout.columns).toHaveLength(6);
			expect(layout.columns.map(c => c.tiles.length)).toEqual([2, 2, 2, 2, 2, 2]);
			// Reps are uniform → per-column weight labels suppressed in favour of
			// a min-max range in the header.
			expect(layout.columns.every(c => c.weightLabel === undefined)).toBe(true);
			expect(layout.performedVolume).toBe(
				2 * 100 + 2 * 100 + 2 * 102 + 2 * 102 + 2 * 105 + 2 * 105,
			);
			expect(layout.prescribedVolume).toBe(
				2 * 100 + 2 * 100 + 2 * 102 + 2 * 102 + 2 * 105 + 2 * 105,
			);
			expect(layout.headerWeightLabel).toBe('100-105kg');
		});
	});

	describe('wave', () => {
		it('renders variable-height columns and per-column weight labels', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('3-2-1-3-2-1 @60kg 65kg 70kg 65kg 75kg 80kg'),
				performed: makePhase({
					sets: 6,
					repetitions: 3,
					weight: 60,
					compound_reps: [3, 2, 1, 3, 2, 1],
					weights: [60, 65, 70, 65, 75, 80],
				}),
				programRms: [],
			});
			expect(layout.columns).toHaveLength(6);
			expect(layout.columns.map(c => c.tiles.length)).toEqual([3, 2, 1, 3, 2, 1]);
			expect(layout.columns.map(c => c.weightLabel)).toEqual([
				'60kg',
				'65kg',
				'70kg',
				'65kg',
				'75kg',
				'80kg',
			]);
			expect(layout.performedVolume).toBe(
				3 * 60 + 2 * 65 + 1 * 70 + 3 * 65 + 2 * 75 + 1 * 80,
			);
			expect(layout.headerWeightLabel).toBe('60-80kg');
		});
	});

	describe('unparseable prescription', () => {
		it('treats performed as bright without shading comparison', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: makePrescribed('eh heavy stuff idk'),
				performed: makePhase({ sets: 3, repetitions: 5, weight: 100 }),
				programRms: [],
			});
			expect(layout.unparseablePrescription).toBe(true);
			expect(layout.prescribedVolume).toBeNull();
			expect(layout.performedVolume).toBe(3 * 5 * 100);
			expect(layout.columns.every(c => c.tiles.every(t => t === 'bright'))).toBe(true);
		});
	});

	describe('performed only (no prescription)', () => {
		it('renders bright tiles from performed data', () => {
			const layout = buildSessionLayout({
				...baseInput,
				prescribed: null,
				performed: makePhase({ sets: 5, repetitions: 5, weight: 80 }),
				programRms: [],
			});
			expect(layout.columns).toHaveLength(5);
			expect(layout.columns.every(c => c.tiles.length === 5)).toBe(true);
			expect(layout.columns.every(c => c.tiles.every(t => t === 'bright'))).toBe(true);
			expect(layout.prescribedVolume).toBeNull();
		});
	});
});
