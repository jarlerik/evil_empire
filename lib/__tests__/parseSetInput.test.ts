import { parseSetInput, ParsedSetData } from '../parseSetInput';

describe('parseSetInput', () => {
	describe('valid inputs', () => {
		it('should parse basic format "sets x reps @weight"', () => {
			const result = parseSetInput('4 x 3 @50');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should parse format with "kg" suffix', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should parse format with "KG" suffix', () => {
			const result = parseSetInput('4 x 3 @50KG');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should parse format with "Kg" suffix', () => {
			const result = parseSetInput('4 x 3 @50Kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should parse decimal weights', () => {
			const result = parseSetInput('3 x 5 @75.5kg');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 75.5,
				isValid: true
			});
		});

		it('should handle extra spaces', () => {
			const result = parseSetInput('  4  x  3  @  50kg  ');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should handle single digit values', () => {
			const result = parseSetInput('1 x 1 @1kg');
			expect(result).toEqual({
				sets: 1,
				reps: 1,
				weight: 1,
				isValid: true
			});
		});

		it('should handle large numbers', () => {
			const result = parseSetInput('10 x 20 @100kg');
			expect(result).toEqual({
				sets: 10,
				reps: 20,
				weight: 100,
				isValid: true
			});
		});

		it('should parse compound exercise format', () => {
			const result = parseSetInput('4 x 2 + 2@50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 4, // Total reps (2 + 2)
				weight: 50,
				isValid: true,
				compoundReps: [2, 2]
			});
		});

		it('should parse compound exercise with different rep counts', () => {
			const result = parseSetInput('3 x 1 + 3@75kg');
			expect(result).toEqual({
				sets: 3,
				reps: 4, // Total reps (1 + 3)
				weight: 75,
				isValid: true,
				compoundReps: [1, 3]
			});
		});

		it('should parse compound exercise without kg suffix', () => {
			const result = parseSetInput('5 x 2 + 1@60');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // Total reps (2 + 1)
				weight: 60,
				isValid: true,
				compoundReps: [2, 1]
			});
		});

		it('should parse multiple weights format', () => {
			const result = parseSetInput('3 x 1 @50 60 70');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true
			});
		});

		it('should parse multiple weights with kg suffix', () => {
			const result = parseSetInput('4 x 5 @100 110 120 130kg');
			expect(result).toEqual({
				sets: 4,
				reps: 5,
				weight: 100, // First weight for backward compatibility
				weights: [100, 110, 120, 130],
				isValid: true
			});
		});

		it('should parse multiple weights with decimal values', () => {
			const result = parseSetInput('3 x 3 @50.5 60.25 70.75kg');
			expect(result).toEqual({
				sets: 3,
				reps: 3,
				weight: 50.5, // First weight for backward compatibility
				weights: [50.5, 60.25, 70.75],
				isValid: true
			});
		});

		it('should parse multiple weights with extra spaces', () => {
			const result = parseSetInput('  3  x  1  @  50  60  70  ');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true
			});
		});

		it('should parse single weight as simple format', () => {
			const result = parseSetInput('1 x 5 @50');
			expect(result).toEqual({
				sets: 1,
				reps: 5,
				weight: 50,
				isValid: true
			});
		});

		it('should parse large numbers with multiple weights', () => {
			const result = parseSetInput('10 x 20 @100 110 120 130 140 150 160 170 180 190kg');
			expect(result).toEqual({
				sets: 10,
				reps: 20,
				weight: 100, // First weight for backward compatibility
				weights: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190],
				isValid: true
			});
		});

		it('should parse wave exercise format', () => {
			const result = parseSetInput('3-2-1-1-1 65');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 65,
				wavePhases: [
					{sets: 1, reps: 3, weight: 65},
					{sets: 1, reps: 2, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65},
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 75.5}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
			});
		});

		it('should parse wave exercise with single digit reps', () => {
			const result = parseSetInput('1-1-1-1-1 50');
			expect(result).toEqual({
				sets: 5,
				reps: 1, // First rep count for backward compatibility
				weight: 50,
				wavePhases: [
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50},
					{sets: 1, reps: 1, weight: 50}
				],
				isValid: true
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
					{sets: 1, reps: 2, weight: 100}
				],
				isValid: true
			});
		});

		it('should parse wave exercise with many sets', () => {
			const result = parseSetInput('5-4-3-2-1-1-1-1-1 80');
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
					{sets: 1, reps: 1, weight: 80}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
			});
		});
	});

	describe('invalid inputs', () => {
		it('should return invalid for empty string', () => {
			const result = parseSetInput('');
			expect(result).toEqual({
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Please enter a valid format (e.g., "3 x 5 @50kg")'
			});
		});

		it('should return invalid for whitespace only', () => {
			const result = parseSetInput('   ');
			expect(result).toEqual({
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Please enter a valid format (e.g., "3 x 5 @50kg")'
			});
		});

		it('should return invalid for missing x separator', () => {
			const result = parseSetInput('4 3 @50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for missing @ symbol', () => {
			const result = parseSetInput('4 x 3 50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wrong order', () => {
			const result = parseSetInput('4 @ 3 x 50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for non-numeric values', () => {
			const result = parseSetInput('abc x def @ghi');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for partial numeric values', () => {
			const result = parseSetInput('4 x abc @50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for negative numbers', () => {
			const result = parseSetInput('-4 x 3 @50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for zero values', () => {
			const result = parseSetInput('0 x 3 @50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for incomplete format', () => {
			const result = parseSetInput('4 x 3');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for extra characters', () => {
			const result = parseSetInput('4 x 3 @50kg extra');
			expect(result.isValid).toBe(false);
		});

		it('should accept mixed case kg suffix', () => {
			const result = parseSetInput('4 x 3 @50Kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

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

		it('should return invalid for multiple weights with wrong count', () => {
			const result = parseSetInput('3 x 1 @50 60');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Expected 3 weights for 3 sets, but got 2');
		});

		it('should return invalid for multiple weights with too many weights', () => {
			const result = parseSetInput('2 x 1 @50 60 70');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with non-numeric values', () => {
			const result = parseSetInput('3 x 1 @50 abc 70');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid weight values. Please use numbers only.');
		});

		it('should return invalid for multiple weights with negative values', () => {
			const result = parseSetInput('3 x 1 @50 -60 70');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with zero values', () => {
			const result = parseSetInput('3 x 1 @50 0 70');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with empty values', () => {
			const result = parseSetInput('3 x 1 @50  70');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with decimal values that are not numbers', () => {
			const result = parseSetInput('3 x 1 @50.5 60.abc 70.75');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with zero reps', () => {
			const result = parseSetInput('3-0-1-1-1 65');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")');
		});

		it('should return invalid for wave exercise with negative reps', () => {
			const result = parseSetInput('3--2-1-1-1 65');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")');
		});

		it('should return invalid for wave exercise with non-numeric reps', () => {
			const result = parseSetInput('3-abc-1-1-1 65');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid format. Use "sets x reps @weight" (e.g., "3 x 5 @50kg"), "sets x reps @weight1 weight2..." for multiple weights, or "reps1-reps2-reps3... weight" for wave exercises');
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
			const result = parseSetInput('3-2-1-1-1 -65');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with zero weight', () => {
			const result = parseSetInput('3-2-1-1-1 0');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with wrong format', () => {
			const result = parseSetInput('3x2-1-1-1 65');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with extra characters', () => {
			const result = parseSetInput('3-2-1-1-1 65 extra');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for wave exercise with empty rep values', () => {
			const result = parseSetInput('3--1-1-1 65');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")');
		});

		it('should return invalid for wave exercise with decimal reps', () => {
			const result = parseSetInput('3.5-2-1-1-1 65');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid wave format. Use "reps1-reps2-reps3... weight" (e.g., "3-2-1-1-1 65")');
		});
	});

	describe('edge cases', () => {
		it('should handle very large numbers', () => {
			const result = parseSetInput('999 x 999 @999.99kg');
			expect(result).toEqual({
				sets: 999,
				reps: 999,
				weight: 999.99,
				isValid: true
			});
		});

		it('should handle decimal weights with many decimal places', () => {
			const result = parseSetInput('3 x 5 @75.123kg');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 75.123,
				isValid: true
			});
		});

		it('should handle mixed case input', () => {
			const result = parseSetInput('4 X 3 @50KG');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should handle input with tabs and newlines', () => {
			const result = parseSetInput('\t4\tx\t3\t@\t50kg\t');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true
			});
		});

		it('should handle multiple weights with tabs and newlines', () => {
			const result = parseSetInput('\t3\tx\t1\t@\t50\t60\t70\t');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true
			});
		});

		it('should handle multiple weights with very large decimal values', () => {
			const result = parseSetInput('3 x 5 @999.999 888.888 777.777kg');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 999.999, // First weight for backward compatibility
				weights: [999.999, 888.888, 777.777],
				isValid: true
			});
		});

		it('should handle multiple weights with mixed case kg suffix', () => {
			const result = parseSetInput('3 x 1 @50 60 70Kg');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true
			});
		});

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
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
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
					{sets: 1, reps: 555, weight: 999.99}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 75.123}
				],
				isValid: true
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
					{sets: 1, reps: 1, weight: 65}
				],
				isValid: true
			});
		});
	});

	describe('return type validation', () => {
		it('should always return ParsedSetData interface', () => {
			const validResult = parseSetInput('4 x 3 @50kg');
			const invalidResult = parseSetInput('invalid');

			expect(validResult).toHaveProperty('sets');
			expect(validResult).toHaveProperty('reps');
			expect(validResult).toHaveProperty('weight');
			expect(validResult).toHaveProperty('isValid');

			expect(invalidResult).toHaveProperty('sets');
			expect(invalidResult).toHaveProperty('reps');
			expect(invalidResult).toHaveProperty('weight');
			expect(invalidResult).toHaveProperty('isValid');
		});

		it('should return numbers for numeric properties', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(typeof result.sets).toBe('number');
			expect(typeof result.reps).toBe('number');
			expect(typeof result.weight).toBe('number');
			expect(typeof result.isValid).toBe('boolean');
		});

		it('should return weights array for multiple weights format', () => {
			const result = parseSetInput('3 x 1 @50 60 70');
			expect(Array.isArray(result.weights)).toBe(true);
			expect(result.weights).toEqual([50, 60, 70]);
		});

		it('should not return weights array for single weight format', () => {
			const result = parseSetInput('3 x 1 @50');
			expect(result.weights).toBeUndefined();
		});

		it('should maintain backward compatibility with existing formats', () => {
			const simpleResult = parseSetInput('4 x 3 @50kg');
			const compoundResult = parseSetInput('4 x 2 + 2@50kg');
			
			expect(simpleResult.weights).toBeUndefined();
			expect(compoundResult.weights).toBeUndefined();
			expect(simpleResult.isValid).toBe(true);
			expect(compoundResult.isValid).toBe(true);
		});

		it('should return wavePhases array for wave exercise format', () => {
			const result = parseSetInput('3-2-1-1-1 65');
			expect(Array.isArray(result.wavePhases)).toBe(true);
			expect(result.wavePhases).toEqual([
				{sets: 1, reps: 3, weight: 65},
				{sets: 1, reps: 2, weight: 65},
				{sets: 1, reps: 1, weight: 65},
				{sets: 1, reps: 1, weight: 65},
				{sets: 1, reps: 1, weight: 65}
			]);
		});

		it('should not return wavePhases array for non-wave formats', () => {
			const simpleResult = parseSetInput('3 x 1 @50');
			const compoundResult = parseSetInput('3 x 2 + 2@50');
			const multipleWeightsResult = parseSetInput('3 x 1 @50 60 70');
			
			expect(simpleResult.wavePhases).toBeUndefined();
			expect(compoundResult.wavePhases).toBeUndefined();
			expect(multipleWeightsResult.wavePhases).toBeUndefined();
		});

		it('should maintain backward compatibility with wave exercises', () => {
			const waveResult = parseSetInput('3-2-1-1-1 65');
			
			expect(waveResult.weights).toBeUndefined();
			expect(waveResult.compoundReps).toBeUndefined();
			expect(waveResult.isValid).toBe(true);
			expect(waveResult.sets).toBe(5);
			expect(waveResult.reps).toBe(3); // First rep count
			expect(waveResult.weight).toBe(65);
		});
	});
}); 