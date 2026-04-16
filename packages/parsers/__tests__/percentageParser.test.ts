import { parseSetInput } from '../src';

describe('parseSetInput - Percentage Format', () => {
	describe('simple percentage format', () => {
		it('should parse format with percentage', () => {
			const result = parseSetInput('4 x 6 @80%');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0,
				isValid: true,
				weightPercentage: 80,
				needsRmLookup: true,
			});
		});
	});

	describe('percentage range format', () => {
		it('should return invalid for percentage range with min > max', () => {
			const result = parseSetInput('3 x 5@85-80%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Minimum percentage must be less than or equal to maximum percentage');
		});

		it('should accept percentage range with values > 100', () => {
			const result = parseSetInput('3 x 5@101-105%');
			expect(result.isValid).toBe(true);
			expect(result.weightMinPercentage).toBe(101);
			expect(result.weightMaxPercentage).toBe(105);
		});

		it('should return invalid for percentage range with values > 200', () => {
			const result = parseSetInput('3 x 5@201-205%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Percentage must be between 0 and 200');
		});

		it('should return invalid for percentage range with values <= 0', () => {
			const result = parseSetInput('3 x 5@0-5%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Percentage must be between 0 and 200');
		});
	});

	describe('multiple weights with percentage', () => {
		it('should parse multiple weights format with percentage', () => {
			const result = parseSetInput('3 x 1 @60 70 75%');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 0, // Will be calculated after RM lookup
				weights: [60, 70, 75],
				isValid: true,
				weightPercentage: 60, // First for backward compatibility
				needsRmLookup: true,
			});
		});
	});

	describe('wave exercises with percentage', () => {
		it('should parse wave exercise format with percentage', () => {
			const result = parseSetInput('3-2-1-1-1 80%');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 0,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				weights: [80],
				weightPercentage: 80,
				needsRmLookup: true,
				isValid: true,
			});
		});
	});

	describe('compound exercises with percentage', () => {
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

	describe('percentage with rest time', () => {
		it('should parse rest time with percentage format', () => {
			const result = parseSetInput('3 x 5 @80% 90s');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 0, // Will be calculated after RM lookup
				isValid: true,
				weightPercentage: 80,
				needsRmLookup: true,
				restTimeSeconds: 90,
			});
		});
	});

	describe('"of 1RM" suffix (some sources append this redundantly)', () => {
		it('should accept simple percentage with " of 1RM" suffix', () => {
			const result = parseSetInput('4 x 5 @95% of 1RM');
			expect(result).toEqual({
				sets: 4,
				reps: 5,
				weight: 0,
				isValid: true,
				weightPercentage: 95,
				needsRmLookup: true,
			});
		});

		it('should accept percentage range with " of 1RM" suffix', () => {
			const result = parseSetInput('8 x 3 @70-75% of 1RM');
			expect(result.isValid).toBe(true);
			expect(result.weightMinPercentage).toBe(70);
			expect(result.weightMaxPercentage).toBe(75);
			expect(result.needsRmLookup).toBe(true);
		});

		it('should accept compound percentage with " of 1RM" suffix', () => {
			const result = parseSetInput('4 x 2 + 2 @80% of 1RM');
			expect(result.isValid).toBe(true);
			expect(result.weightPercentage).toBe(80);
			expect(result.compoundReps).toEqual([2, 2]);
			expect(result.needsRmLookup).toBe(true);
		});

		it('should be case-insensitive (handles "of 1rm")', () => {
			const result = parseSetInput('4 x 5 @95% of 1rm');
			expect(result.isValid).toBe(true);
			expect(result.weightPercentage).toBe(95);
		});

		it('should tolerate variable whitespace ("of  1 RM")', () => {
			const result = parseSetInput('4 x 5 @95% of  1 RM');
			expect(result.isValid).toBe(true);
			expect(result.weightPercentage).toBe(95);
		});
	});
});
