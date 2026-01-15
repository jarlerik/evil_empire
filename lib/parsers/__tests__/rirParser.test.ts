import { parseSetInput } from '../../parseSetInput';

describe('parseSetInput - RIR Format', () => {
	describe('RIR as unit format', () => {
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
	});

	describe('RIR with comma format (backward compatibility)', () => {
		it('should parse RIR format with comma', () => {
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

		it('should parse RIR format with comma and range', () => {
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

		it('should parse RIR format with comma and weight', () => {
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
	});

	describe('RIR without comma format', () => {
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
	});

	describe('RIR with rest time', () => {
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
	});

	describe('compound exercise with RIR', () => {
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
	});
});
