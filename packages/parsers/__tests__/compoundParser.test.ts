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

	describe('compound exercise with percentage range', () => {
		it('should parse compound exercise with percentage range', () => {
			const result = parseSetInput('3 x 3 + 1@70-85%');
			expect(result).toEqual({
				sets: 3,
				reps: 4,
				weight: 0,
				isValid: true,
				weightMinPercentage: 70,
				weightMaxPercentage: 85,
				needsRmLookup: true,
				compoundReps: [3, 1],
			});
		});

		it('should parse compound exercise with percentage range and spaces', () => {
			const result = parseSetInput('4 x 2 + 2 @80-90%');
			expect(result).toEqual({
				sets: 4,
				reps: 4,
				weight: 0,
				isValid: true,
				weightMinPercentage: 80,
				weightMaxPercentage: 90,
				needsRmLookup: true,
				compoundReps: [2, 2],
			});
		});

		it('should parse compound exercise with percentage range and three rep parts', () => {
			const result = parseSetInput('3 x 2 + 1 + 1@70-80%');
			expect(result).toEqual({
				sets: 3,
				reps: 4,
				weight: 0,
				isValid: true,
				weightMinPercentage: 70,
				weightMaxPercentage: 80,
				needsRmLookup: true,
				compoundReps: [2, 1, 1],
			});
		});

		it('should parse compound exercise with percentage range and rest time', () => {
			const result = parseSetInput('3 x 3 + 1@70-85% 120s');
			expect(result).toEqual({
				sets: 3,
				reps: 4,
				weight: 0,
				isValid: true,
				weightMinPercentage: 70,
				weightMaxPercentage: 85,
				needsRmLookup: true,
				compoundReps: [3, 1],
				restTimeSeconds: 120,
			});
		});

		it('should return invalid for reversed percentage range in compound', () => {
			const result = parseSetInput('3 x 3 + 1@85-70%');
			expect(result.isValid).toBe(false);
		});

		it('should accept percentage over 100 in compound range', () => {
			const result = parseSetInput('3 x 3 + 1@70-105%');
			expect(result.isValid).toBe(true);
		});

		it('should return invalid for percentage over 200 in compound range', () => {
			const result = parseSetInput('3 x 3 + 1@70-205%');
			expect(result.isValid).toBe(false);
		});
	});

	describe('compound exercise with multiple per-set percentages', () => {
		it('should parse comma-separated percentages', () => {
			const result = parseSetInput('3 x 1 + 1@75, 78, 78%');
			expect(result).toEqual({
				sets: 3,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [75, 78, 78],
				weightPercentage: 75,
				needsRmLookup: true,
				compoundReps: [1, 1],
			});
		});

		it('should parse space-separated percentages', () => {
			const result = parseSetInput('3 x 1 + 1@75 78 78%');
			expect(result).toEqual({
				sets: 3,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [75, 78, 78],
				weightPercentage: 75,
				needsRmLookup: true,
				compoundReps: [1, 1],
			});
		});

		it('should repeat last percentage for remaining sets', () => {
			const result = parseSetInput('4 x 1 + 1@60, 75%');
			expect(result).toEqual({
				sets: 4,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [60, 75, 75, 75],
				weightPercentage: 60,
				needsRmLookup: true,
				compoundReps: [1, 1],
			});
		});

		it('should return invalid when too many percentages for sets', () => {
			const result = parseSetInput('2 x 1 + 1@60, 70, 80%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Too many percentages');
		});

		it('should accept percentage over 100', () => {
			const result = parseSetInput('2 x 1 + 1@75, 105%');
			expect(result.isValid).toBe(true);
		});

		it('should parse with rest time', () => {
			const result = parseSetInput('3 x 1 + 1@75, 78, 78% 90s');
			expect(result).toEqual({
				sets: 3,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [75, 78, 78],
				weightPercentage: 75,
				needsRmLookup: true,
				compoundReps: [1, 1],
				restTimeSeconds: 90,
			});
		});
	});

	describe('compound exercise with multiple per-set percentages and trailing range', () => {
		it('should parse comma-separated percentages with trailing range', () => {
			const result = parseSetInput('3 x 1 + 1 @80, 85, 85-90%');
			expect(result).toEqual({
				sets: 3,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [80, 85, 85],
				weightPercentage: 80,
				weightMinPercentage: 85,
				weightMaxPercentage: 90,
				needsRmLookup: true,
				compoundReps: [1, 1],
			});
		});

		it('should parse with rest time', () => {
			const result = parseSetInput('3 x 1 + 1 @80, 85, 85-90% 120s');
			expect(result).toEqual({
				sets: 3,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [80, 85, 85],
				weightPercentage: 80,
				weightMinPercentage: 85,
				weightMaxPercentage: 90,
				needsRmLookup: true,
				compoundReps: [1, 1],
				restTimeSeconds: 120,
			});
		});

		it('should parse space-separated percentages with trailing range', () => {
			const result = parseSetInput('3 x 1 + 1 @80 85 85-90%');
			expect(result).toEqual({
				sets: 3,
				reps: 2,
				weight: 0,
				isValid: true,
				weights: [80, 85, 85],
				weightPercentage: 80,
				weightMinPercentage: 85,
				weightMaxPercentage: 90,
				needsRmLookup: true,
				compoundReps: [1, 1],
			});
		});

		it('should pad range for remaining sets when fewer values than sets', () => {
			const result = parseSetInput('4 x 2 + 1 @75, 80-85%');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 0,
				isValid: true,
				weights: [75, 80, 80, 80],
				weightPercentage: 75,
				weightMinPercentage: 80,
				weightMaxPercentage: 85,
				needsRmLookup: true,
				compoundReps: [2, 1],
			});
		});

		it('should return invalid when too many values for sets', () => {
			const result = parseSetInput('2 x 1 + 1 @70, 80, 85-90%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Too many percentages');
		});

		it('should return invalid when range min > max', () => {
			const result = parseSetInput('3 x 1 + 1 @80, 85, 90-85%');
			expect(result.isValid).toBe(false);
		});

		it('should accept percentage over 100', () => {
			const result = parseSetInput('3 x 1 + 1 @80, 85, 90-105%');
			expect(result.isValid).toBe(true);
		});
	});

	describe('compound with multiple weights and trailing range (kg)', () => {
		it('should parse compound with per-set weights and trailing range', () => {
			const result = parseSetInput('3 x 1 + 1 @52kg 55kg 57-59kg');
			expect(result.isValid).toBe(true);
			expect(result.sets).toBe(3);
			expect(result.reps).toBe(2);
			expect(result.weights).toEqual([52, 55, 57]);
			expect(result.weightMin).toBe(57);
			expect(result.weightMax).toBe(59);
			expect(result.compoundReps).toEqual([1, 1]);
		});

		it('should parse compound with per-set weights, trailing range, and rest time', () => {
			const result = parseSetInput('3 x 1 + 1 @53kg 55kg 57-59kg 120s');
			expect(result.isValid).toBe(true);
			expect(result.sets).toBe(3);
			expect(result.reps).toBe(2);
			expect(result.weights).toEqual([53, 55, 57]);
			expect(result.weightMin).toBe(57);
			expect(result.weightMax).toBe(59);
			expect(result.compoundReps).toEqual([1, 1]);
			expect(result.restTimeSeconds).toBe(120);
		});

		it('should parse compound with per-set weights, trailing range, rest time, and notes', () => {
			const result = parseSetInput('3 x 1 + 1 @53kg 55kg 57-59kg 120s\n80%, 85%, 88-90% of Power Snatch 1RM (65kg)');
			expect(result.isValid).toBe(true);
			expect(result.sets).toBe(3);
			expect(result.reps).toBe(2);
			expect(result.weights).toEqual([53, 55, 57]);
			expect(result.weightMin).toBe(57);
			expect(result.weightMax).toBe(59);
			expect(result.compoundReps).toEqual([1, 1]);
			expect(result.restTimeSeconds).toBe(120);
			expect(result.notes).toBe('80%, 85%, 88-90% of Power Snatch 1RM (65kg)');
		});

		it('should return invalid when too many weights for sets', () => {
			const result = parseSetInput('2 x 1 + 1 @50kg 60kg 70-80kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Too many weights');
		});
	});

	describe('compound with multiple weights (kg)', () => {
		it('should parse compound with multiple weights', () => {
			const result = parseSetInput('3 x 1 + 1 @50kg 60kg 70kg');
			expect(result.isValid).toBe(true);
			expect(result.sets).toBe(3);
			expect(result.reps).toBe(2);
			expect(result.weights).toEqual([50, 60, 70]);
			expect(result.compoundReps).toEqual([1, 1]);
		});

		it('should pad weights when fewer than sets', () => {
			const result = parseSetInput('4 x 2 + 1 @50kg 60kg');
			expect(result.isValid).toBe(true);
			expect(result.weights).toEqual([50, 60, 60, 60]);
			expect(result.compoundReps).toEqual([2, 1]);
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
