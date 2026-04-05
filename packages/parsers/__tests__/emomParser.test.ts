import { parseEmom } from '../src/emomParser';
import { parseSetInput } from '../src/index';
import { formatExercisePhase, ExercisePhase } from '../src/formatExercisePhase';
import { reverseParsePhase } from '../src/reverseParser';

describe('parseEmom', () => {
	describe('EMOM prefix extraction', () => {
		it('should parse "EMOM 5min:" prefix', () => {
			const result = parseEmom('EMOM 5min: 3 x 20 cal erg');
			expect(result.emomIntervalSeconds).toBe(300);
			expect(result.remainingInput).toBe('3 x 20 cal erg');
		});

		it('should parse "EMOM 90s:" prefix', () => {
			const result = parseEmom('EMOM 90s: 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(90);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should parse "E5min:" shorthand', () => {
			const result = parseEmom('E5min: 3 x 10');
			expect(result.emomIntervalSeconds).toBe(300);
			expect(result.remainingInput).toBe('3 x 10');
		});

		it('should parse "E90s:" shorthand', () => {
			const result = parseEmom('E90s: 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(90);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should parse without colon', () => {
			const result = parseEmom('EMOM 5min 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(300);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should parse with semicolon', () => {
			const result = parseEmom('EMOM 5min; 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(300);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should parse "EMOM 2m:" with m unit', () => {
			const result = parseEmom('EMOM 2m: 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(120);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should parse "EMOM 60s:" with seconds', () => {
			const result = parseEmom('EMOM 60s: 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(60);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should parse "EMOM 3minutes:" with full unit', () => {
			const result = parseEmom('EMOM 3minutes: 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(180);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should be case insensitive', () => {
			const result = parseEmom('emom 5min: 3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBe(300);
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});

		it('should return no EMOM for non-EMOM input', () => {
			const result = parseEmom('3 x 5 @50kg');
			expect(result.emomIntervalSeconds).toBeUndefined();
			expect(result.remainingInput).toBe('3 x 5 @50kg');
		});
	});
});

describe('parseSetInput with EMOM', () => {
	it('should parse EMOM with standard format', () => {
		const result = parseSetInput('EMOM 5min: 3 x 5 @50kg');
		expect(result.isValid).toBe(true);
		expect(result.emomIntervalSeconds).toBe(300);
		expect(result.sets).toBe(3);
		expect(result.reps).toBe(5);
		expect(result.weight).toBe(50);
	});

	it('should parse EMOM with circuit format', () => {
		const result = parseSetInput('EMOM 5min: 3 x 20 cal erg, 20 T2B, 20 KB swings');
		expect(result.isValid).toBe(true);
		expect(result.emomIntervalSeconds).toBe(300);
		expect(result.sets).toBe(3);
		expect(result.exerciseType).toBe('circuit');
		expect(result.circuitExercises).toHaveLength(3);
	});

	it('should ignore rest time when EMOM is set', () => {
		const result = parseSetInput('EMOM 5min: 3 x 5 @50kg');
		expect(result.isValid).toBe(true);
		expect(result.emomIntervalSeconds).toBe(300);
		expect(result.restTimeSeconds).toBeUndefined();
	});

	it('should not have emomIntervalSeconds when no EMOM prefix', () => {
		const result = parseSetInput('3 x 5 @50kg');
		expect(result.isValid).toBe(true);
		expect(result.emomIntervalSeconds).toBeUndefined();
	});

	it('should parse EMOM with notes', () => {
		const result = parseSetInput('EMOM 5min: 3 x 5 @50kg\nKeep it light');
		expect(result.isValid).toBe(true);
		expect(result.emomIntervalSeconds).toBe(300);
		expect(result.notes).toBe('Keep it light');
	});
});

describe('formatExercisePhase with EMOM', () => {
	it('should prepend EMOM prefix in minutes', () => {
		const phase: ExercisePhase = {
			id: '1',
			exercise_id: 'e1',
			sets: 3,
			repetitions: 5,
			weight: 50,
			emom_interval_seconds: 300,
			created_at: '',
		};
		expect(formatExercisePhase(phase)).toBe('EMOM 5min: 3 x 5 @50kg');
	});

	it('should prepend EMOM prefix in seconds', () => {
		const phase: ExercisePhase = {
			id: '1',
			exercise_id: 'e1',
			sets: 3,
			repetitions: 5,
			weight: 50,
			emom_interval_seconds: 90,
			created_at: '',
		};
		expect(formatExercisePhase(phase)).toBe('EMOM 90s: 3 x 5 @50kg');
	});

	it('should not prepend EMOM for phases without emom_interval_seconds', () => {
		const phase: ExercisePhase = {
			id: '1',
			exercise_id: 'e1',
			sets: 3,
			repetitions: 5,
			weight: 50,
			created_at: '',
		};
		expect(formatExercisePhase(phase)).toBe('3 x 5 @50kg');
	});
});

describe('reverseParsePhase with EMOM', () => {
	it('should prepend EMOM prefix in minutes', () => {
		const result = reverseParsePhase({
			sets: 3,
			repetitions: 5,
			weight: 50,
			emom_interval_seconds: 300,
		});
		expect(result).toBe('EMOM 5min: 3 x 5 @50kg');
	});

	it('should prepend EMOM prefix in seconds', () => {
		const result = reverseParsePhase({
			sets: 3,
			repetitions: 5,
			weight: 50,
			emom_interval_seconds: 90,
		});
		expect(result).toBe('EMOM 90s: 3 x 5 @50kg');
	});

	it('should handle EMOM with rest time (both present)', () => {
		const result = reverseParsePhase({
			sets: 3,
			repetitions: 5,
			weight: 50,
			emom_interval_seconds: 300,
			rest_time_seconds: 60,
		});
		expect(result).toBe('EMOM 5min: 3 x 5 @50kg 60s');
	});

	it('should handle EMOM with notes', () => {
		const result = reverseParsePhase({
			sets: 3,
			repetitions: 5,
			weight: 50,
			emom_interval_seconds: 300,
			notes: 'Keep it light',
		});
		expect(result).toBe('EMOM 5min: 3 x 5 @50kg\nKeep it light');
	});

	it('should not prepend EMOM without emom_interval_seconds', () => {
		const result = reverseParsePhase({
			sets: 3,
			repetitions: 5,
			weight: 50,
		});
		expect(result).toBe('3 x 5 @50kg');
	});
});
