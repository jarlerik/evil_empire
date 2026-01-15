import { parseSetInput } from '../../parseSetInput';

describe('parseSetInput - Rest Time Parsing', () => {
	describe('rest time in seconds', () => {
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
	});

	describe('rest time in minutes', () => {
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
	});

	describe('rest time without unit (invalid)', () => {
		it('should return invalid for rest time without unit (unit is mandatory)', () => {
			const result = parseSetInput('4 x 3 @50kg 120');
			expect(result.isValid).toBe(false);
			expect(result.errorMessage).toContain('Rest time requires a unit');
		});
	});

	describe('rest time with different formats', () => {
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

	describe('no rest time', () => {
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
	});
});
