import { parseSetInput } from '../src';
import { formatExercisePhase } from '../src/formatExercisePhase';
import { reverseParsePhase } from '../src/reverseParser';

describe('parseSetInput - Wave Format', () => {
	describe('wave exercise with kg', () => {
		it('should parse wave exercise format with kg', () => {
			const result = parseSetInput('3-2-1-1-1 65kg');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with KG suffix', () => {
			const result = parseSetInput('3-2-1-1-1 65KG');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with decimal weight', () => {
			const result = parseSetInput('5-4-3-2-1 75.5kg');
			expect(result).toEqual({
				sets: 5,
				reps: 5,
				weight: 75.5,
				compoundReps: [5, 4, 3, 2, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with extra spaces', () => {
			const result = parseSetInput('  3  -  2  -  1  -  1  -  1  65kg  ');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with single digit reps', () => {
			const result = parseSetInput('1-1-1-1-1 50kg');
			expect(result).toEqual({
				sets: 5,
				reps: 1,
				weight: 50,
				compoundReps: [1, 1, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with large numbers', () => {
			const result = parseSetInput('10-8-6-4-2 100kg');
			expect(result).toEqual({
				sets: 5,
				reps: 10,
				weight: 100,
				compoundReps: [10, 8, 6, 4, 2],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with many sets', () => {
			const result = parseSetInput('5-4-3-2-1-1-1-1-1 80kg');
			expect(result).toEqual({
				sets: 9,
				reps: 5,
				weight: 80,
				compoundReps: [5, 4, 3, 2, 1, 1, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave exercise with mixed case kg suffix', () => {
			const result = parseSetInput('3-2-1-1-1 65Kg');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});
	});

	describe('wave exercise with percentage', () => {
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

	describe('wave exercise with rest time', () => {
		it('should parse rest time with wave exercises', () => {
			const result = parseSetInput('3-2-1-1-1 65kg 90s');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				restTimeSeconds: 90,
				isValid: true,
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
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should handle wave exercise with very large numbers', () => {
			const result = parseSetInput('999-888-777-666-555 999.99kg');
			expect(result).toEqual({
				sets: 5,
				reps: 999,
				weight: 999.99,
				compoundReps: [999, 888, 777, 666, 555],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should handle wave exercise with decimal weight with many decimal places', () => {
			const result = parseSetInput('5-4-3-2-1 75.123kg');
			expect(result).toEqual({
				sets: 5,
				reps: 5,
				weight: 75.123,
				compoundReps: [5, 4, 3, 2, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should handle wave exercise with mixed case input', () => {
			const result = parseSetInput('3-2-1-1-1 65KG');
			expect(result).toEqual({
				sets: 5,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});
	});

	describe('wave with space+@ separator (from formatExercisePhase)', () => {
		it('should parse wave with space+@ and single weight', () => {
			const result = parseSetInput('3-2-1 @65kg');
			expect(result).toEqual({
				sets: 3,
				reps: 3,
				weight: 65,
				compoundReps: [3, 2, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave with space+@ and multiple weights', () => {
			const result = parseSetInput('3-2-1-3-2-1 @64, 67kg');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 64,
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [64, 67],
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
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [70, 75],
				isValid: true,
			});
		});

		it('should parse wave with three weights', () => {
			const result = parseSetInput('3-2-1-3-2-1-3-2-1 60, 65, 70kg');
			expect(result).toEqual({
				sets: 9,
				reps: 3,
				weight: 60,
				compoundReps: [3, 2, 1, 3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [60, 65, 70],
				isValid: true,
			});
		});

		it('should parse wave with @ separator', () => {
			const result = parseSetInput('3-2-1-3-2-1@70, 75kg');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 70,
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [70, 75],
				isValid: true,
			});
		});

		it('should parse wave with space-separated weights', () => {
			const result = parseSetInput('3-2-1-3-2-1@70 75kg');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 70,
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [70, 75],
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
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [70, 75],
				weightPercentage: 70,
				needsRmLookup: true,
				isValid: true,
			});
		});

		it('should parse wave with space separator and percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1 70, 75%');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 0,
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [70, 75],
				weightPercentage: 70,
				needsRmLookup: true,
				isValid: true,
			});
		});

		it('should parse wave with three percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1-3-2-1@65, 70, 75%');
			expect(result).toEqual({
				sets: 9,
				reps: 3,
				weight: 0,
				compoundReps: [3, 2, 1, 3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [65, 70, 75],
				weightPercentage: 65,
				needsRmLookup: true,
				isValid: true,
			});
		});

		it('should parse wave with space-separated percentages', () => {
			const result = parseSetInput('3-2-1-3-2-1@70 75%');
			expect(result).toEqual({
				sets: 6,
				reps: 3,
				weight: 0,
				compoundReps: [3, 2, 1, 3, 2, 1],
				exerciseType: 'wave',
				weights: [70, 75],
				weightPercentage: 70,
				needsRmLookup: true,
				isValid: true,
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
				compoundReps: [3, 2, 1],
				exerciseType: 'wave',
				isValid: true,
			});
		});

		it('should parse wave with @ separator and percentage', () => {
			const result = parseSetInput('3-2-1@80%');
			expect(result).toEqual({
				sets: 3,
				reps: 3,
				weight: 0,
				compoundReps: [3, 2, 1],
				exerciseType: 'wave',
				weights: [80],
				weightPercentage: 80,
				needsRmLookup: true,
				isValid: true,
			});
		});
	});

	describe('return type validation', () => {
		it('should return compoundReps and exerciseType for wave exercise format', () => {
			const result = parseSetInput('3-2-1-1-1 65kg');
			expect(result.exerciseType).toBe('wave');
			expect(result.compoundReps).toEqual([3, 2, 1, 1, 1]);
			expect(result.sets).toBe(5);
			expect(result.reps).toBe(3);
			expect(result.weight).toBe(65);
		});

		it('should not return wave type for non-wave formats', () => {
			const simpleResult = parseSetInput('3 x 1 @50kg');
			const compoundResult = parseSetInput('3 x 2 + 2@50kg');
			const multipleWeightsResult = parseSetInput('3 x 1 @50 60 70kg');

			expect(simpleResult.exerciseType).not.toBe('wave');
			expect(compoundResult.exerciseType).not.toBe('wave');
			expect(multipleWeightsResult.exerciseType).not.toBe('wave');
		});
	});

	describe('format and reverse-parse', () => {
		it('should format single-weight wave correctly', () => {
			const formatted = formatExercisePhase({
				id: '1', exercise_id: '1', created_at: '',
				sets: 3, repetitions: 3, weight: 65,
				compound_reps: [3, 2, 1], exercise_type: 'wave',
			});
			expect(formatted).toBe('3-2-1 @65kg');
		});

		it('should format multi-weight wave correctly', () => {
			const formatted = formatExercisePhase({
				id: '1', exercise_id: '1', created_at: '',
				sets: 6, repetitions: 3, weight: 70,
				compound_reps: [3, 2, 1, 3, 2, 1], exercise_type: 'wave',
				weights: [70, 75],
			});
			expect(formatted).toBe('3-2-1-3-2-1 @70, 75kg');
		});

		it('should format wave with rest time correctly', () => {
			const formatted = formatExercisePhase({
				id: '1', exercise_id: '1', created_at: '',
				sets: 3, repetitions: 3, weight: 65,
				compound_reps: [3, 2, 1], exercise_type: 'wave',
				rest_time_seconds: 120,
			});
			expect(formatted).toBe('3-2-1 @65kg 120s');
		});

		it('should reverse-parse single-weight wave correctly', () => {
			const reversed = reverseParsePhase({
				sets: 3, repetitions: 3, weight: 65,
				compound_reps: [3, 2, 1], exercise_type: 'wave',
			});
			expect(reversed).toBe('3-2-1@65kg');
		});

		it('should reverse-parse multi-weight wave correctly', () => {
			const reversed = reverseParsePhase({
				sets: 6, repetitions: 3, weight: 70,
				compound_reps: [3, 2, 1, 3, 2, 1], exercise_type: 'wave',
				weights: [70, 75],
			});
			expect(reversed).toBe('3-2-1-3-2-1@70, 75kg');
		});

		it('should round-trip single-weight wave', () => {
			const reversed = reverseParsePhase({
				sets: 5, repetitions: 3, weight: 65,
				compound_reps: [3, 2, 1, 1, 1], exercise_type: 'wave',
			});
			const parsed = parseSetInput(reversed);
			expect(parsed.isValid).toBe(true);
			expect(parsed.exerciseType).toBe('wave');
			expect(parsed.compoundReps).toEqual([3, 2, 1, 1, 1]);
			expect(parsed.weight).toBe(65);
		});

		it('should round-trip multi-weight wave', () => {
			const reversed = reverseParsePhase({
				sets: 6, repetitions: 3, weight: 70,
				compound_reps: [3, 2, 1, 3, 2, 1], exercise_type: 'wave',
				weights: [70, 75],
			});
			const parsed = parseSetInput(reversed);
			expect(parsed.isValid).toBe(true);
			expect(parsed.exerciseType).toBe('wave');
			expect(parsed.compoundReps).toEqual([3, 2, 1, 3, 2, 1]);
			expect(parsed.weights).toEqual([70, 75]);
		});
	});
});
