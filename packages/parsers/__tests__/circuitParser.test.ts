import { parseSetInput } from '../src';

describe('parseSetInput - Circuit Format', () => {
	describe('circuit with single exercise', () => {
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
	});

	describe('circuit with multiple exercises', () => {
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

	describe('circuit with rest time', () => {
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

	describe('circuit vs standard format', () => {
		it('should not parse standard format with @ as circuit', () => {
			const result = parseSetInput('4 x 3 @50kg');
			expect(result.isValid).toBe(true);
			expect(result.exerciseType).toBeUndefined();
			expect(result.circuitExercises).toBeUndefined();
			expect(result.weight).toBe(50);
		});
	});

	describe('edge cases', () => {
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
			expect(circuitResult.exerciseType).not.toBe('wave');
			expect(circuitResult.isValid).toBe(true);
			expect(circuitResult.sets).toBe(2);
			expect(circuitResult.reps).toBe(0); // Circuits don't have a single rep count
			expect(circuitResult.weight).toBe(0); // Circuits typically don't have weights
			expect(circuitResult.exerciseType).toBe('circuit');
		});
	});

	describe('should not match weighted exercises with commas', () => {
		it('should not parse compound with per-set percentages as circuit', () => {
			const result = parseSetInput('3 x 1 + 1 @80, 85, 85-90%');
			expect(result.exerciseType).not.toBe('circuit');
			expect(result.isValid).toBe(true);
		});

		it('should not parse standard with per-set percentages as circuit', () => {
			const result = parseSetInput('3 x 1 @80, 85, 85-90%');
			expect(result.exerciseType).not.toBe('circuit');
			expect(result.isValid).toBe(true);
		});

		it('should not parse compound multi-percent as circuit', () => {
			const result = parseSetInput('3 x 1 + 1@75, 78, 78%');
			expect(result.exerciseType).not.toBe('circuit');
			expect(result.isValid).toBe(true);
		});
	});
});
