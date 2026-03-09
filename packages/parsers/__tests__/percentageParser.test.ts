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

		it('should return invalid for percentage range with values > 100', () => {
			const result = parseSetInput('3 x 5@101-105%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Percentage must be between 0 and 100');
		});

		it('should return invalid for percentage range with values <= 0', () => {
			const result = parseSetInput('3 x 5@0-5%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Percentage must be between 0 and 100');
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
				reps: 3, // First rep count for backward compatibility
				weight: 0, // Will be calculated after RM lookup
				wavePhases: [
					{sets: 1, reps: 3, weight: 0, weightPercentage: 80},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 80},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 80},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 80},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 80},
				],
				isValid: true,
				weightPercentage: 80,
				needsRmLookup: true,
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
});
