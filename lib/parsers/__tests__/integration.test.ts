import { parseSetInput } from '../../parseSetInput';

describe('parseSetInput - Integration Tests', () => {
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

	describe('format disambiguation', () => {
		it('should correctly identify standard format vs circuit format', () => {
			// Standard format with @ symbol
			const standardResult = parseSetInput('4 x 3 @50kg');
			expect(standardResult.exerciseType).toBeUndefined();
			expect(standardResult.circuitExercises).toBeUndefined();
			expect(standardResult.weight).toBe(50);

			// Circuit format without @ symbol
			const circuitResult = parseSetInput('4 x 3 exercise name');
			expect(circuitResult.exerciseType).toBe('circuit');
			expect(circuitResult.circuitExercises).toBeDefined();
		});

		it('should correctly identify wave format vs other formats', () => {
			// Wave format
			const waveResult = parseSetInput('3-2-1 65kg');
			expect(waveResult.wavePhases).toBeDefined();
			expect(waveResult.sets).toBe(3);

			// Standard format with range
			const rangeResult = parseSetInput('3 x 5 @85-89kg');
			expect(rangeResult.wavePhases).toBeUndefined();
			expect(rangeResult.weightMin).toBe(85);
			expect(rangeResult.weightMax).toBe(89);
		});
	});

	describe('all format types together', () => {
		it('should handle all format types correctly', () => {
			// Standard
			expect(parseSetInput('4 x 3 @50kg').isValid).toBe(true);

			// Percentage
			expect(parseSetInput('4 x 6 @80%').isValid).toBe(true);

			// RIR
			expect(parseSetInput('4 x 6 @1RIR').isValid).toBe(true);

			// Compound
			expect(parseSetInput('4 x 2 + 2@50kg').isValid).toBe(true);

			// Wave
			expect(parseSetInput('3-2-1-1-1 65kg').isValid).toBe(true);

			// Circuit
			expect(parseSetInput('2 x 10 exercise name').isValid).toBe(true);

			// Multiple weights
			expect(parseSetInput('3 x 1 @50 60 70kg').isValid).toBe(true);

			// Weight range
			expect(parseSetInput('3 x 5 @85-89kg').isValid).toBe(true);

			// Percentage range
			expect(parseSetInput('3 x 5 @80-85%').isValid).toBe(true);
		});
	});
});
