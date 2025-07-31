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
	});

	describe('invalid inputs', () => {
		it('should return invalid for empty string', () => {
			const result = parseSetInput('');
			expect(result).toEqual({
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false
			});
		});

		it('should return invalid for whitespace only', () => {
			const result = parseSetInput('   ');
			expect(result).toEqual({
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false
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
	});
}); 