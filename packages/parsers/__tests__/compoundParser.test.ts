import { parseSetInput } from '../src';

describe('parseSetInput - Compound Format', () => {
	describe('compound exercise with weight', () => {
		it('should parse compound exercise format', () => {
			const result = parseSetInput('4 x 2 + 2@50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 4, // Total reps (2 + 2)
				weight: 50,
				isValid: true,
				compoundReps: [2, 2],
			});
		});

		it('should parse compound exercise with different rep counts', () => {
			const result = parseSetInput('3 x 1 + 3@75kg');
			expect(result).toEqual({
				sets: 3,
				reps: 4, // Total reps (1 + 3)
				weight: 75,
				isValid: true,
				compoundReps: [1, 3],
			});
		});

		it('should parse compound exercise with multiple rep parts', () => {
			const result = parseSetInput('4 x 1 + 2 + 2 + 2@40kg');
			expect(result).toEqual({
				sets: 4,
				reps: 7, // Total reps (1 + 2 + 2 + 2)
				weight: 40,
				isValid: true,
				compoundReps: [1, 2, 2, 2],
			});
		});

		it('should parse compound exercise with kg unit', () => {
			const result = parseSetInput('5 x 2 + 1@60kg');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // Total reps (2 + 1)
				weight: 60,
				isValid: true,
				compoundReps: [2, 1],
			});
		});
	});

	describe('compound exercise with RIR', () => {
		it('should parse compound exercise with RIR unit', () => {
			const result = parseSetInput('4 x 2 + 2@1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 4, // Total reps (2 + 2)
				weight: 0,
				isValid: true,
				exerciseType: 'standard',
				compoundReps: [2, 2],
				rirMin: 1,
				rirMax: 1,
			});
		});
	});

	describe('compound exercise with percentage', () => {
		it('should parse compound exercise with percentage', () => {
			const result = parseSetInput('3 x 1 + 1 + 1@60%');
			expect(result).toEqual({
				sets: 3,
				reps: 3, // Total reps (1 + 1 + 1)
				weight: 0, // Will be calculated after RM lookup
				isValid: true,
				weightPercentage: 60,
				needsRmLookup: true,
				compoundReps: [1, 1, 1],
			});
		});

		it('should parse compound exercise with multiple parts and percentage', () => {
			const result = parseSetInput('4 x 1 + 2 + 2 + 2@60%');
			expect(result).toEqual({
				sets: 4,
				reps: 7, // Total reps (1 + 2 + 2 + 2)
				weight: 0, // Will be calculated after RM lookup
				isValid: true,
				weightPercentage: 60,
				needsRmLookup: true,
				compoundReps: [1, 2, 2, 2],
			});
		});
	});

	describe('compound exercise with rest time', () => {
		it('should parse rest time with compound exercises', () => {
			const result = parseSetInput('4 x 1 + 2 + 2 + 2@60% 120s');
			expect(result).toEqual({
				sets: 4,
				reps: 7, // Total reps (1 + 2 + 2 + 2)
				weight: 0, // Will be calculated after RM lookup
				isValid: true,
				weightPercentage: 60,
				needsRmLookup: true,
				compoundReps: [1, 2, 2, 2],
				restTimeSeconds: 120,
			});
		});
	});

	describe('invalid compound inputs', () => {
		it('should return invalid for compound exercise with zero reps', () => {
			const result = parseSetInput('4 x 0 + 2@50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for compound exercise with missing plus', () => {
			const result = parseSetInput('4 x 2 2@50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for compound exercise with wrong order', () => {
			const result = parseSetInput('4 x 2 + @50kg');
			expect(result.isValid).toBe(false);
		});
	});

	describe('return type validation', () => {
		it('should maintain compatibility with compound formats (with required units)', () => {
			const compoundResult = parseSetInput('4 x 2 + 2@50kg');

			expect(compoundResult.weights).toBeUndefined();
			expect(compoundResult.isValid).toBe(true);
			expect(compoundResult.compoundReps).toEqual([2, 2]);
		});
	});
});
