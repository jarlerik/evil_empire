import { parseSetInput } from '../src';

describe('parseSetInput - Wave Format', () => {
	describe('wave exercise with kg', () => {
		it('should parse wave exercise format with kg', () => {
			const result = parseSetInput('3-2-1-1-1 65kg');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with kg suffix', () => {
			const result = parseSetInput('3-2-1-1-1 65kg');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with KG suffix', () => {
			const result = parseSetInput('3-2-1-1-1 65KG');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with decimal weight', () => {
			const result = parseSetInput('5-4-3-2-1 75.5kg');
			expect(result).toEqual({
				sets: 5,
				reps: 5, // First rep count for backward compatibility
				weight: 75.5,
				wavePhases: [
					{sets: 1, reps: 5, weight: 75.5},
					{sets: 1, reps: 4, weight: 75.5},
					{sets: 1, reps: 3, weight: 75.5},
					{sets: 1, reps: 2, weight: 75.5},
					{sets: 1, reps: 1, weight: 75.5},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with extra spaces', () => {
			const result = parseSetInput('  3  -  2  -  1  -  1  -  1  65kg  ');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with single digit reps', () => {
			const result = parseSetInput('1-1-1-1-1 50kg');
			expect(result).toEqual({
				sets: 5,
				reps: 1, // First rep count for backward compatibility
				weight: 50,
				wavePhases: [
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with large numbers', () => {
			const result = parseSetInput('10-8-6-4-2 100kg');
			expect(result).toEqual({
				sets: 5,
				reps: 10, // First rep count for backward compatibility
				weight: 100,
				wavePhases: [
					{sets: 1, reps: 10, weight: 100},
					{sets: 1, reps: 8, weight: 100},
					{sets: 1, reps: 6, weight: 100},
					{sets: 1, reps: 4, weight: 100},
					{sets: 1, reps: 2, weight: 100},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with many sets', () => {
			const result = parseSetInput('5-4-3-2-1-1-1-1-1 80kg');
			expect(result).toEqual({
				sets: 9,
				reps: 5, // First rep count for backward compatibility
				weight: 80,
				wavePhases: [
					{sets: 1, reps: 5, weight: 80},
					{sets: 1, reps: 4, weight: 80},
					{sets: 1, reps: 3, weight: 80},
					{sets: 1, reps: 2, weight: 80},
					{sets: 1, reps: 1, weight: 80},
					{sets: 1, reps: 1, weight: 80},
					{sets: 1, reps: 1, weight: 80},
					{sets: 1, reps: 1, weight: 80},
					{sets: 1, reps: 1, weight: 80},
				],
				isValid: true,
			});
		});

		it('should parse wave exercise with mixed case kg suffix', () => {
			const result = parseSetInput('3-2-1-1-1 65Kg');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});
	});

	describe('wave exercise with percentage', () => {
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

	describe('wave exercise with rest time', () => {
		it('should parse rest time with wave exercises', () => {
			const result = parseSetInput('3-2-1-1-1 65kg 90s');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
				restTimeSeconds: 90,
			});
		});
	});

	describe('invalid wave inputs', () => {
		it('should return invalid for wave exercise with zero reps', () => {
			const result = parseSetInput('3-0-1-1-1 65kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Invalid wave format');
		});

		it('should return invalid for wave exercise with negative reps', () => {
			const result = parseSetInput('3--2-1-1-1 65kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Invalid wave format');
		});

		it('should return invalid for wave exercise with non-numeric reps', () => {
			const result = parseSetInput('3-abc-1-1-1 65');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBeDefined();
		});

		it('should return invalid for wave exercise with missing weight', () => {
			const result = parseSetInput('3-2-1-1-1');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with non-numeric weight', () => {
			const result = parseSetInput('3-2-1-1-1 abc');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with negative weight', () => {
			const result = parseSetInput('3-2-1-1-1 -65kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with zero weight', () => {
			const result = parseSetInput('3-2-1-1-1 0kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise without unit', () => {
			const result = parseSetInput('3-2-1-1-1 65');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with wrong format', () => {
			const result = parseSetInput('3x2-1-1-1 65kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with extra characters', () => {
			const result = parseSetInput('3-2-1-1-1 65kg extra');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with empty rep values', () => {
			const result = parseSetInput('3--1-1-1 65kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Invalid wave format');
		});

		it('should return invalid for wave exercise with decimal reps', () => {
			const result = parseSetInput('3.5-2-1-1-1 65kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Invalid wave format');
		});
	});

	describe('edge cases', () => {
		it('should handle wave exercise with tabs and newlines', () => {
			const result = parseSetInput('\t3\t-\t2\t-\t1\t-\t1\t-\t1\t65kg\t');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});

		it('should handle wave exercise with very large numbers', () => {
			const result = parseSetInput('999-888-777-666-555 999.99kg');
			expect(result).toEqual({
				sets: 5,
				reps: 999, // First rep count for backward compatibility
				weight: 999.99,
				wavePhases: [
					{sets: 1, reps: 999, weight: 999.99},
					{sets: 1, reps: 888, weight: 999.99},
					{sets: 1, reps: 777, weight: 999.99},
					{sets: 1, reps: 666, weight: 999.99},
					{sets: 1, reps: 555, weight: 999.99},
				],
				isValid: true,
			});
		});

		it('should handle wave exercise with decimal weight with many decimal places', () => {
			const result = parseSetInput('5-4-3-2-1 75.123kg');
			expect(result).toEqual({
				sets: 5,
				reps: 5, // First rep count for backward compatibility
				weight: 75.123,
				wavePhases: [
					{sets: 1, reps: 5, weight: 75.123},
					{sets: 1, reps: 4, weight: 75.123},
					{sets: 1, reps: 3, weight: 75.123},
					{sets: 1, reps: 2, weight: 75.123},
					{sets: 1, reps: 1, weight: 75.123},
				],
				isValid: true,
			});
		});

		it('should handle wave exercise with mixed case input', () => {
			const result = parseSetInput('3-2-1-1-1 65KG');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});
	});

	describe('wave with multiple weights (kg)', () => {
		it('should parse wave with two weights', () => {
			const result = parseSetInput('3-2-1-3-2-1 70, 75kg');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 70,
				wavePhases: [
					{sets: 1, reps: 3, weight: 70},
					{sets: 1, reps: 2, weight: 70},
					{sets: 1, reps: 1, weight: 70},
					{sets: 1, reps: 3, weight: 75},
					{sets: 1, reps: 2, weight: 75},
					{sets: 1, reps: 1, weight: 75},
				],
				isValid: true,
			});
		});

		it('should parse wave with three weights', () => {
			const result = parseSetInput('3-2-1-3-2-1-3-2-1 60, 65, 70kg');
			expect(result).toEqual({
				sets: 9,
				reps: 3,
				weight: 60,
				wavePhases: [
					{sets: 1, reps: 3, weight: 60},
					{sets: 1, reps: 2, weight: 60},
					{sets: 1, reps: 1, weight: 60},
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 3, weight: 70},
					{sets: 1, reps: 2, weight: 70},
					{sets: 1, reps: 1, weight: 70},
				],
				isValid: true,
			});
		});

		it('should parse wave with @ separator', () => {
			const result = parseSetInput('3-2-1-3-2-1@70, 75kg');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 70,
				wavePhases: [
					{sets: 1, reps: 3, weight: 70},
					{sets: 1, reps: 2, weight: 70},
					{sets: 1, reps: 1, weight: 70},
					{sets: 1, reps: 3, weight: 75},
					{sets: 1, reps: 2, weight: 75},
					{sets: 1, reps: 1, weight: 75},
				],
				isValid: true,
			});
		});

		it('should parse wave with space-separated weights', () => {
			const result = parseSetInput('3-2-1-3-2-1@70 75kg');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 70,
				wavePhases: [
					{sets: 1, reps: 3, weight: 70},
					{sets: 1, reps: 2, weight: 70},
					{sets: 1, reps: 1, weight: 70},
					{sets: 1, reps: 3, weight: 75},
					{sets: 1, reps: 2, weight: 75},
					{sets: 1, reps: 1, weight: 75},
				],
				isValid: true,
			});
		});

		it('should return error when weights do not evenly divide sets', () => {
			const result = parseSetInput('3-2-1-3-2@70, 75kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('evenly divide');
		});
	});

	describe('wave with multiple percentages', () => {
		it('should parse wave with two percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1@70, 75%');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 0,
				wavePhases: [
					{sets: 1, reps: 3, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 3, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 75},
				],
				isValid: true,
				weightPercentage: 70,
				needsRmLookup: true,
			});
		});

		it('should parse wave with space separator and percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1 70, 75%');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 0,
				wavePhases: [
					{sets: 1, reps: 3, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 3, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 75},
				],
				isValid: true,
				weightPercentage: 70,
				needsRmLookup: true,
			});
		});

		it('should parse wave with three percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1-3-2-1@65, 70, 75%');
			expect(result).toEqual({
				sets: 9,
				reps: 3,
				weight: 0,
				wavePhases: [
					{sets: 1, reps: 3, weight: 0, weightPercentage: 65},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 65},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 65},
					{sets: 1, reps: 3, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 3, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 75},
				],
				isValid: true,
				weightPercentage: 65,
				needsRmLookup: true,
			});
		});

		it('should parse wave with space-separated percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1@70 75%');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 0,
				wavePhases: [
					{sets: 1, reps: 3, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 70},
					{sets: 1, reps: 3, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 75},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 75},
				],
				isValid: true,
				weightPercentage: 70,
				needsRmLookup: true,
			});
		});

		it('should return error when percentages do not evenly divide sets', () => {
			const result = parseSetInput('3-2-1-3-2@70, 75%');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('evenly divide');
		});
	});

	describe('wave with @ separator (single value)', () => {
		it('should parse wave with @ separator and kg', () => {
			const result = parseSetInput('3-2-1@65kg');
			expect(result).toEqual({
				sets: 3,
				reps: 3,
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
				],
				isValid: true,
			});
		});

		it('should parse wave with @ separator and percentage', () => {
			const result = parseSetInput('3-2-1@80%');
			expect(result).toEqual({
				sets: 3,
				reps: 3,
				weight: 0,
				wavePhases: [
					{sets: 1, reps: 3, weight: 0, weightPercentage: 80},
					{sets: 1, reps: 2, weight: 0, weightPercentage: 80},
					{sets: 1, reps: 1, weight: 0, weightPercentage: 80},
				],
				isValid: true,
				weightPercentage: 80,
				needsRmLookup: true,
			});
		});
	});

	describe('return type validation', () => {
		it('should return wavePhases array for wave exercise format', () => {
			const result = parseSetInput('3-2-1-1-1 65kg');
			expect(Array.isArray(result.wavePhases)).toBe(true);
			expect(result.wavePhases).toEqual([
				{sets: 1, reps: 3, weight: 65},
				{sets: 1, reps: 2, weight: 65},
				{sets: 1, reps: 1, weight: 65},
				{sets: 1, reps: 1, weight: 65},
				{sets: 1, reps: 1, weight: 65},
			]);
		});

		it('should not return wavePhases array for non-wave formats', () => {
			const simpleResult = parseSetInput('3 x 1 @50kg');
			const compoundResult = parseSetInput('3 x 2 + 2@50kg');
			const multipleWeightsResult = parseSetInput('3 x 1 @50 60 70kg');

			expect(simpleResult.wavePhases).toBeUndefined();
			expect(compoundResult.wavePhases).toBeUndefined();
			expect(multipleWeightsResult.wavePhases).toBeUndefined();
		});

		it('should maintain compatibility with wave exercises (with required units)', () => {
			const waveResult = parseSetInput('3-2-1-1-1 65kg');

			expect(waveResult.weights).toBeUndefined();
			expect(waveResult.compoundReps).toBeUndefined();
			expect(waveResult.isValid).toBe(true);
			expect(waveResult.sets).toBe(5);
			expect(waveResult.reps).toBe(3); // First rep count
			expect(waveResult.weight).toBe(65);
		});
	});
});
