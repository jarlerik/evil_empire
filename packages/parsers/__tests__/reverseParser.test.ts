import { reverseParsePhase } from '../src';

describe('reverseParsePhase', () => {
	describe('basic formats', () => {
		it('should reverse standard format', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
			});
			expect(result).toBe('4 x 3 @50kg');
		});

		it('should reverse compound format', () => {
			const result = reverseParsePhase({
				sets: 3,
				repetitions: 6,
				weight: 45,
				compound_reps: [2, 2, 2],
			});
			expect(result).toBe('3 x 2 + 2 + 2 @45kg');
		});

		it('should reverse RIR format with weight', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 8,
				weight: 50,
				rir_min: 2,
				rir_max: 3,
			});
			expect(result).toBe('4 x 8 @50kg, 2-3RIR');
		});

		it('should reverse RIR format without weight', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 8,
				weight: 0,
				rir_min: 2,
				rir_max: 2,
			});
			expect(result).toBe('4 x 8, 2RIR');
		});

		it('should reverse RM build format', () => {
			const result = reverseParsePhase({
				sets: 0,
				repetitions: 0,
				weight: 0,
				exercise_type: 'rm_build',
				target_rm: 5,
			});
			expect(result).toBe('Build to 5RM');
		});

		it('should reverse weight range format', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 6,
				weight: 87,
				weight_min: 85,
				weight_max: 89,
			});
			expect(result).toBe('4 x 6 @85-89kg');
		});

		it('should reverse multiple weights format', () => {
			const result = reverseParsePhase({
				sets: 3,
				repetitions: 1,
				weight: 50,
				weights: [50, 60, 70],
			});
			expect(result).toBe('3 x 1 @50 60 70');
		});
	});

	describe('with rest time', () => {
		it('should include rest time in output', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
				rest_time_seconds: 120,
			});
			expect(result).toBe('4 x 3 @50kg 120s');
		});
	});

	describe('notes support', () => {
		it('should include notes as second line for standard format', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
				notes: 'Slow eccentric',
			});
			expect(result).toBe('4 x 3 @50kg\nSlow eccentric');
		});

		it('should include notes as second line for compound format', () => {
			const result = reverseParsePhase({
				sets: 3,
				repetitions: 6,
				weight: 45,
				compound_reps: [2, 2, 2],
				rest_time_seconds: 120,
				notes: '5sec pause in catch of split jerk',
			});
			expect(result).toBe('3 x 2 + 2 + 2 @45kg 120s\n5sec pause in catch of split jerk');
		});

		it('should include notes as second line for RIR format', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 8,
				weight: 50,
				rir_min: 2,
				rir_max: 3,
				notes: 'Focus on tempo',
			});
			expect(result).toBe('4 x 8 @50kg, 2-3RIR\nFocus on tempo');
		});

		it('should include notes as second line for RM build format', () => {
			const result = reverseParsePhase({
				sets: 0,
				repetitions: 0,
				weight: 0,
				exercise_type: 'rm_build',
				target_rm: 5,
				notes: 'No belt',
			});
			expect(result).toBe('Build to 5RM\nNo belt');
		});

		it('should include notes as second line for weight range format', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 6,
				weight: 87,
				weight_min: 85,
				weight_max: 89,
				notes: 'Use collars',
			});
			expect(result).toBe('4 x 6 @85-89kg\nUse collars');
		});

		it('should not include notes when undefined', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
			});
			expect(result).toBe('4 x 3 @50kg');
			expect(result).not.toContain('\n');
		});

		it('should not include notes when null', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
				notes: null as unknown as string,
			});
			expect(result).toBe('4 x 3 @50kg');
			expect(result).not.toContain('\n');
		});

		it('should not include notes when empty string', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
				notes: '',
			});
			expect(result).toBe('4 x 3 @50kg');
			expect(result).not.toContain('\n');
		});

		it('should preserve multi-line notes', () => {
			const result = reverseParsePhase({
				sets: 4,
				repetitions: 3,
				weight: 50,
				notes: 'Line 1\nLine 2\nLine 3',
			});
			expect(result).toBe('4 x 3 @50kg\nLine 1\nLine 2\nLine 3');
		});
	});

	describe('round-trip (parse → reverse → parse)', () => {
		it('should preserve notes through round-trip', async () => {
			const { parseSetInput } = await import('../src');

			const original = '4 x 3 @50kg\nSlow eccentric';
			const parsed = parseSetInput(original);

			expect(parsed.isValid).toBe(true);
			expect(parsed.notes).toBe('Slow eccentric');

			const reversed = reverseParsePhase({
				sets: parsed.sets,
				repetitions: parsed.reps,
				weight: parsed.weight,
				notes: parsed.notes,
			});

			expect(reversed).toBe(original);
		});

		it('should preserve compound with notes through round-trip', async () => {
			const { parseSetInput } = await import('../src');

			const original = '3 x 2 + 2 + 2 @45kg 120s\n5sec pause';
			const parsed = parseSetInput(original);

			expect(parsed.isValid).toBe(true);
			expect(parsed.notes).toBe('5sec pause');

			const reversed = reverseParsePhase({
				sets: parsed.sets,
				repetitions: parsed.reps,
				weight: parsed.weight,
				compound_reps: parsed.compoundReps,
				rest_time_seconds: parsed.restTimeSeconds,
				notes: parsed.notes,
			});

			expect(reversed).toBe(original);
		});
	});
});
