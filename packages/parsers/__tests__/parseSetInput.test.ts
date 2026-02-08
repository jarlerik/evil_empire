import { parseSetInput } from '../src';

describe('parseSetInput', () => {
	describe('valid inputs', () => {
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

		it('should parse format with RIR as unit', () => {
			const result = parseSetInput('4 x 6 @1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0,
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
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

		it('should parse wave exercise format with percentage', () => {
			const result = parseSetInput('3-2-1-1-1 80%');
			expect(result).toEqual({
				sets: 5,
				reps: 3, // First rep count for backward compatibility
				weight: 0, // Will be calculated after RM lookup
				wavePhases: [
					{sets: 1, reps: 3, weight: 0},
					{sets: 1, reps: 2, weight: 0},
					{sets: 1, reps: 1, weight: 0},
					{sets: 1, reps: 1, weight: 0},
					{sets: 1, reps: 1, weight: 0},
				],
				isValid: true,
				weightPercentage: 80,
				needsRmLookup: true,
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

		it('should parse circuit format with single exercise', () => {
			const result = parseSetInput('2 x 10 banded side step');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'banded side step'},
				],
			});
		});

		it('should parse circuit format with multiple exercises', () => {
			const result = parseSetInput('2 x 10 banded side step, 10 banded skated walk forward');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'banded side step'},
					{reps: '10', name: 'banded skated walk forward'},
				],
			});
		});

		it('should parse circuit format with "10/10" rep format', () => {
			const result = parseSetInput('3 x 10/10 banded side step, 5/5 banded skated walk forward');
			expect(result).toEqual({
				sets: 3,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10/10', name: 'banded side step'},
					{reps: '5/5', name: 'banded skated walk forward'},
				],
			});
		});

		it('should parse circuit format with mixed rep formats', () => {
			const result = parseSetInput('2 x 10/10 banded side step, 15 banded skated walk forward, 5/5 exercise name');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10/10', name: 'banded side step'},
					{reps: '15', name: 'banded skated walk forward'},
					{reps: '5/5', name: 'exercise name'},
				],
			});
		});

		it('should parse circuit format with exercises without reps', () => {
			const result = parseSetInput('2 x banded side step, 10 exercise with reps');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '', name: 'banded side step'},
					{reps: '10', name: 'exercise with reps'},
				],
			});
		});

		it('should parse circuit format with extra spaces', () => {
			const result = parseSetInput('  3  x  10  banded side step  ,  15  exercise name  ');
			expect(result).toEqual({
				sets: 3,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'banded side step'},
					{reps: '15', name: 'exercise name'},
				],
			});
		});

		it('should parse circuit format with many exercises', () => {
			const result = parseSetInput('2 x 10 exercise1, 15 exercise2, 20/20 exercise3, 5 exercise4, exercise5');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'exercise1'},
					{reps: '15', name: 'exercise2'},
					{reps: '20/20', name: 'exercise3'},
					{reps: '5', name: 'exercise4'},
					{reps: '', name: 'exercise5'},
				],
			});
		});

		it('should parse circuit format with mixed case', () => {
			const result = parseSetInput('2 X 10 Banded Side Step, 15 Exercise Name');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'Banded Side Step'},
					{reps: '15', name: 'Exercise Name'},
				],
			});
		});

		it('should parse circuit format with single exercise and no reps', () => {
			const result = parseSetInput('1 x exercise name only');
			expect(result).toEqual({
				sets: 1,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '', name: 'exercise name only'},
				],
			});
		});

		it('should parse circuit format with large rep numbers', () => {
			const result = parseSetInput('3 x 100 exercise1, 50/50 exercise2');
			expect(result).toEqual({
				sets: 3,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '100', name: 'exercise1'},
					{reps: '50/50', name: 'exercise2'},
				],
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

		it('should return invalid for compound exercise with zero reps', () => {
			const result = parseSetInput('4 x 0 + 2@50kg');
			expect(result.isValid).toBe(false);
		});

		it('should return invalid for weight range with min > max', () => {
			const result = parseSetInput('3 x 5@89-85kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Minimum weight must be less than or equal to maximum weight');
		});

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

		it('should return invalid for weight range with zero or negative values', () => {
			const result = parseSetInput('3 x 5@0-5kg');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toBe('Weight must be positive');
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

		it('should not parse standard format with @ as circuit', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result.isValid).toBe(true);
			expect(result.exerciseType).toBeUndefined();
			expect(result.circuitExercises).toBeUndefined();
			expect(result.weight).toBe(50);
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

		it('should handle circuit format with tabs and newlines', () => {
			const result = parseSetInput('\t2\tx\t10\tbanded side step\t,\t15\texercise name\t');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'banded side step'},
					{reps: '15', name: 'exercise name'},
				],
			});
		});

		it('should handle circuit format with very long exercise names', () => {
			const result = parseSetInput('2 x 10 very long exercise name with many words, 15 another long exercise name');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'very long exercise name with many words'},
					{reps: '15', name: 'another long exercise name'},
				],
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
			const compoundResult = parseSetInput('4 x 2 + 2@50kg');

			expect(simpleResult.weights).toBeUndefined();
			expect(compoundResult.weights).toBeUndefined();
			expect(simpleResult.isValid).toBe(true);
			expect(compoundResult.isValid).toBe(true);
		});

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

		it('should return circuitExercises array for circuit format', () => {
			const result = parseSetInput('2 x 10 banded side step, 15 exercise name');
			expect(Array.isArray(result.circuitExercises)).toBe(true);
			expect(result.circuitExercises).toEqual([
				{reps: '10', name: 'banded side step'},
				{reps: '15', name: 'exercise name'},
			]);
		});

		it('should not return circuitExercises array for non-circuit formats', () => {
			const simpleResult = parseSetInput('3 x 1 @50kg');
			const compoundResult = parseSetInput('3 x 2 + 2@50kg');
			const multipleWeightsResult = parseSetInput('3 x 1 @50 60 70kg');
			const waveResult = parseSetInput('3-2-1-1-1 65kg');

			expect(simpleResult.circuitExercises).toBeUndefined();
			expect(compoundResult.circuitExercises).toBeUndefined();
			expect(multipleWeightsResult.circuitExercises).toBeUndefined();
			expect(waveResult.circuitExercises).toBeUndefined();
		});

		it('should maintain compatibility with circuit exercises', () => {
			const circuitResult = parseSetInput('2 x 10 banded side step, 15 exercise name');

			expect(circuitResult.weights).toBeUndefined();
			expect(circuitResult.compoundReps).toBeUndefined();
			expect(circuitResult.wavePhases).toBeUndefined();
			expect(circuitResult.isValid).toBe(true);
			expect(circuitResult.sets).toBe(2);
			expect(circuitResult.reps).toBe(0); // Circuits don't have a single rep count
			expect(circuitResult.weight).toBe(0); // Circuits typically don't have weights
			expect(circuitResult.exerciseType).toBe('circuit');
		});
	});

	describe('rest time parsing', () => {
		it('should parse rest time in seconds with "s" suffix', () => {
			const result = parseSetInput('4 x 3 @50kg 120s');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
				restTimeSeconds: 120,
			});
		});

		it('should parse rest time in minutes with "m" suffix', () => {
			const result = parseSetInput('4 x 3 @50kg 2m');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
				restTimeSeconds: 120, // 2 minutes = 120 seconds
			});
		});

		it('should return invalid for rest time without unit (unit is mandatory)', () => {
			const result = parseSetInput('4 x 3 @50kg 120');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Rest time requires a unit');
		});

		it('should parse rest time with "min" unit', () => {
			const result = parseSetInput('4 x 3 @50kg 2min');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
				restTimeSeconds: 120, // 2 minutes = 120 seconds
			});
		});

		it('should parse RIR as unit format', () => {
			const result = parseSetInput('4 x 6@1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0,
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
			});
		});

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

		it('should parse rest time with multiple weights', () => {
			const result = parseSetInput('3 x 1 @50 60 70kg 2m');
			expect(result).toEqual({
				sets: 3,
				reps: 1,
				weight: 50, // First weight for backward compatibility
				weights: [50, 60, 70],
				isValid: true,
				restTimeSeconds: 120, // 2 minutes = 120 seconds
			});
		});

		it('should parse rest time with RIR format', () => {
			const result = parseSetInput('2x 10, 2-3RIR 180s');
			expect(result).toEqual({
				sets: 2,
				reps: 10,
				weight: 0, // RIR format doesn't specify weight
				isValid: true,
				exerciseType: 'standard',
				rirMin: 2,
				rirMax: 3,
				restTimeSeconds: 180,
			});
		});

		it('should parse RIR format with comma (backward compatibility)', () => {
			const result = parseSetInput('4 x 6, 1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0, // RIR format doesn't specify weight
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
			});
		});

		it('should parse RIR format with comma and range (backward compatibility)', () => {
			const result = parseSetInput('2x 10, 2-3RIR');
			expect(result).toEqual({
				sets: 2,
				reps: 10,
				weight: 0, // RIR format doesn't specify weight
				isValid: true,
				exerciseType: 'standard',
				rirMin: 2,
				rirMax: 3,
			});
		});

		it('should parse RIR format with comma and weight (backward compatibility)', () => {
			const result = parseSetInput('4 x 6 @50kg, 1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 50,
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
			});
		});

		it('should parse RIR format without comma (single RIR)', () => {
			const result = parseSetInput('4 x 6 1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0, // RIR format doesn't specify weight
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
			});
		});

		it('should parse RIR format without comma (RIR range)', () => {
			const result = parseSetInput('4 x 6 2-3RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0, // RIR format doesn't specify weight
				isValid: true,
				exerciseType: 'standard',
				rirMin: 2,
				rirMax: 3,
			});
		});

		it('should parse RIR format without comma with weight', () => {
			const result = parseSetInput('4 x 6 @50kg 1RIR');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 50,
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
			});
		});

		it('should parse RIR format without comma with rest time', () => {
			const result = parseSetInput('4 x 6 1RIR 3min');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0, // RIR format doesn't specify weight
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
				restTimeSeconds: 180, // 3 minutes = 180 seconds
			});
		});

		it('should parse RIR format without comma with weight and rest time', () => {
			const result = parseSetInput('4 x 6 @50kg 1RIR 3min');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 50,
				isValid: true,
				exerciseType: 'standard',
				rirMin: 1,
				rirMax: 1,
				restTimeSeconds: 180, // 3 minutes = 180 seconds
			});
		});

		it('should handle rest time with extra spaces', () => {
			const result = parseSetInput('4 x 3 @50kg   120   s');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
				restTimeSeconds: 120,
			});
		});

		it('should not include restTimeSeconds when not specified', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
			expect(result.restTimeSeconds).toBeUndefined();
		});

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

		it('should parse rest time with circuit format', () => {
			const result = parseSetInput('2 x 10 banded side step, 15 exercise name 120s');
			expect(result).toEqual({
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10', name: 'banded side step'},
					{reps: '15', name: 'exercise name'},
				],
				restTimeSeconds: 120,
			});
		});

		it('should parse rest time with circuit format in minutes', () => {
			const result = parseSetInput('3 x 10/10 exercise1, 5 exercise2 2m');
			expect(result).toEqual({
				sets: 3,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{reps: '10/10', name: 'exercise1'},
					{reps: '5', name: 'exercise2'},
				],
				restTimeSeconds: 120, // 2 minutes = 120 seconds
			});
		});
	});

	describe('notes support (multiline input)', () => {
		it('should parse standard format with notes on second line', () => {
			const result = parseSetInput('4 x 3 @50kg\nSlow eccentric');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
				notes: 'Slow eccentric',
			});
		});

		it('should parse compound format with notes', () => {
			const result = parseSetInput('3 x 2 + 2 + 2 @45kg 120s\n5sec pause in catch of split jerk');
			expect(result).toEqual({
				sets: 3,
				reps: 6,
				weight: 45,
				isValid: true,
				compoundReps: [2, 2, 2],
				restTimeSeconds: 120,
				notes: '5sec pause in catch of split jerk',
			});
		});

		it('should parse percentage format with notes', () => {
			const result = parseSetInput('4 x 6 @80%\nTouch and go');
			expect(result).toEqual({
				sets: 4,
				reps: 6,
				weight: 0,
				isValid: true,
				weightPercentage: 80,
				needsRmLookup: true,
				notes: 'Touch and go',
			});
		});

		it('should parse RIR format with notes', () => {
			const result = parseSetInput('3 x 8, 2-3RIR\nFocus on tempo');
			expect(result).toEqual({
				sets: 3,
				reps: 8,
				weight: 0,
				isValid: true,
				exerciseType: 'standard',
				rirMin: 2,
				rirMax: 3,
				notes: 'Focus on tempo',
			});
		});

		it('should parse RM build format with notes', () => {
			const result = parseSetInput('Build to 5RM\nNo belt');
			expect(result).toEqual({
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'rm_build',
				targetRm: 5,
				notes: 'No belt',
			});
		});

		it('should handle multi-line notes (3+ lines)', () => {
			const result = parseSetInput('4 x 3 @50kg\nLine 1\nLine 2\nLine 3');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
				notes: 'Line 1\nLine 2\nLine 3',
			});
		});

		it('should handle single line input without notes (existing behavior)', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
			expect(result.notes).toBeUndefined();
		});

		it('should handle empty second line (no notes)', () => {
			const result = parseSetInput('4 x 3 @50kg\n   ');
			expect(result).toEqual({
				sets: 4,
				reps: 3,
				weight: 50,
				isValid: true,
			});
			expect(result.notes).toBeUndefined();
		});

		it('should not add notes to invalid parse results', () => {
			const result = parseSetInput('invalid format\nsome notes');
			expect(result.isValid).toBe(false);
			expect(result.notes).toBeUndefined();
		});
	});
});
