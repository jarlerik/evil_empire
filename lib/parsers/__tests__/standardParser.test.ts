import { parseSetInput } from '../../parseSetInput';

describe('parseSetInput - Standard Format', () => {
	describe('basic format "sets x reps @weightkg"', () => {
		it('should parse basic format "sets x reps @weightkg"', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should parse format with "kg" suffix (required)', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should parse format with "KG" suffix', () => {
			const result = parseSetInput('4 x 3 @50KG');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should parse format with "Kg" suffix', () => {
			const result = parseSetInput('4 x 3 @50Kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should parse decimal weights', () => {
			const result = parseSetInput('3 x 5 @75.5kg');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 75.5,
				isValid: true,
			});
		});

		it('should handle extra spaces', () => {
			const result = parseSetInput('  4  x  3  @  50kg  ');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should handle single digit values', () => {
			const result = parseSetInput('1 x 1 @1kg');
			expect(result).toEqual({
				sets: 1,
				reps: 1,
				weight: 1,
				isValid: true,
			});
		});

		it('should handle large numbers', () => {
			const result = parseSetInput('10 x 20 @100kg');
			expect(result).toEqual({
				sets: 10,
				reps: 20,
				weight: 100,
				isValid: true,
			});
		});
	});

	describe('multiple weights format', () => {
		it('should parse multiple weights format with kg', () => {
			const result = parseSetInput('3 x 1 @55 60 65kg');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 55, // First weight for backward compatibility
				weights: [55, 60, 65],
				isValid: true,
			});
		});

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

		it('should parse multiple weights with kg suffix', () => {
			const result = parseSetInput('4 x 5 @100 110 120 130kg');
			expect(result).toEqual({
				sets: 4,
				reps: 5,
				weight: 100, // First weight for backward compatibility
				weights: [100, 110, 120, 130],
				isValid: true,
			});
		});

		it('should parse multiple weights with decimal values', () => {
			const result = parseSetInput('3 x 3 @50.5 60.25 70.75kg');
			expect(result).toEqual({
				sets: 3,
				reps: 3,
				weight: 50.5, // First weight for backward compatibility
				weights: [50.5, 60.25, 70.75],
				isValid: true,
			});
		});

		it('should parse multiple weights with extra spaces', () => {
			const result = parseSetInput('  3  x  1  @  50  60  70  kg  ');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true,
			});
		});

		it('should parse single weight as simple format with kg', () => {
			const result = parseSetInput('1 x 5 @50kg');
			expect(result).toEqual({
				sets: 1,
				reps: 5,
				weight: 50,
				isValid: true,
			});
		});

		it('should parse large numbers with multiple weights', () => {
			const result = parseSetInput('10 x 20 @100 110 120 130 140 150 160 170 180 190kg');
			expect(result).toEqual({
				sets: 10,
				reps: 20,
				weight: 100, // First weight for backward compatibility
				weights: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190],
				isValid: true,
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
				errorMessage: 'Please enter a valid format (e.g., "3 x 5 @50kg")',
			});
		});

		it('should return invalid for whitespace only', () => {
			const result = parseSetInput('   ');
			expect(result).toEqual({
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Please enter a valid format (e.g., "3 x 5 @50kg")',
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

		it('should return invalid for missing unit', () => {
			const result = parseSetInput('4 x 3 @50');
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
				isValid: true,
			});
		});

		it('should return invalid for weight range with min > max', () => {
			const result = parseSetInput('3 x 5@89-85kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Minimum weight must be less than or equal to maximum weight');
		});

		it('should return invalid for weight range with zero or negative values', () => {
			const result = parseSetInput('3 x 5@0-5kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Weight must be positive');
		});

		it('should return invalid for multiple weights with wrong count', () => {
			const result = parseSetInput('3 x 1 @50 60 70kg');
			// This should be valid (3 weights for 3 sets)
			expect(result.isValid).toBe(true);

			// Test with wrong count
			const result2 = parseSetInput('3 x 1 @50 60kg');
			expect(result2.isValid).toBe(false);
		});

		it('should return invalid for multiple weights without unit', () => {
			const result = parseSetInput('3 x 1 @50 60 70');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with too many weights', () => {
			const result = parseSetInput('2 x 1 @50 60 70kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with non-numeric values', () => {
			const result = parseSetInput('3 x 1 @50 abc 70kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Invalid weight values. Please use numbers only.');
		});

		it('should return invalid for multiple weights with negative values', () => {
			const result = parseSetInput('3 x 1 @50 -60 70kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with zero values', () => {
			const result = parseSetInput('3 x 1 @50 0 70kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with empty values', () => {
			const result = parseSetInput('3 x 1 @50  70kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for multiple weights with decimal values that are not numbers', () => {
			const result = parseSetInput('3 x 1 @50.5 60.abc 70.75kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for format missing @ that looks like standard format', () => {
			const result = parseSetInput('4 x 3 50kg');
			expect(result.isValid).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle very large numbers', () => {
			const result = parseSetInput('999 x 999 @999.99kg');
			expect(result).toEqual({
				sets: 999,
				reps: 999,
				weight: 999.99,
				isValid: true,
			});
		});

		it('should handle decimal weights with many decimal places', () => {
			const result = parseSetInput('3 x 5 @75.123kg');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 75.123,
				isValid: true,
			});
		});

		it('should handle mixed case input', () => {
			const result = parseSetInput('4 X 3 @50KG');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should handle input with tabs and newlines', () => {
			const result = parseSetInput('\t4\tx\t3\t@\t50kg\t');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
		});

		it('should handle multiple weights with tabs and newlines', () => {
			const result = parseSetInput('\t3\tx\t1\t@\t50\t60\t70\tkg\t');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true,
			});
		});

		it('should handle multiple weights with very large decimal values', () => {
			const result = parseSetInput('3 x 5 @999.999 888.888 777.777kg');
			expect(result).toEqual({
				sets: 3,
				reps: 5,
				weight: 999.999, // First weight for backward compatibility
				weights: [999.999, 888.888, 777.777],
				isValid: true,
			});
		});

		it('should handle multiple weights with mixed case kg suffix', () => {
			const result = parseSetInput('3 x 1 @50 60 70Kg');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true,
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
			const result = parseSetInput('3 x 1 @55 60 65kg');
			expect(Array.isArray(result.weights)).toBe(true);
			expect(result.weights).toEqual([55, 60, 65]);
		});

		it('should not return weights array for single weight format', () => {
			const result = parseSetInput('3 x 1 @50kg');
			expect(result.weights).toBeUndefined();
		});

		it('should maintain compatibility with existing formats (with required units)', () => {
			const simpleResult = parseSetInput('4 x 3 @50kg');

			expect(simpleResult.weights).toBeUndefined();
			expect(simpleResult.isValid).toBe(true);
		});
	});
});
