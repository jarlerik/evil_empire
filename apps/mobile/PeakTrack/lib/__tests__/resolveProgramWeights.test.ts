import { parseSetInput } from '@evil-empire/parsers';
import type { ProgramRepetitionMaximum } from '@evil-empire/types';
import {
	exerciseNeedsRmSnapshot,
	resolveWeightsFromSnapshot,
	findProgramRm,
} from '../resolveProgramWeights';

function makeRm(name: string, weight: number): ProgramRepetitionMaximum {
	return {
		id: `rm-${name}`,
		program_id: 'p1',
		user_id: 'u1',
		exercise_name: name,
		weight,
		tested_at: null,
		source: 'manual',
	};
}

describe('exerciseNeedsRmSnapshot', () => {
	const cases: Array<{ input: string; expected: boolean; label: string }> = [
		// Positive (needs snapshot)
		{ input: '4 x 6 @80%', expected: true, label: 'simple %' },
		{ input: '4 x 3 @80-85%', expected: true, label: '% range' },
		{ input: '3 x 2 + 2 @80%', expected: true, label: 'compound with %' },
		{ input: '3-2-1 @80%', expected: true, label: 'wave with %' },

		// Negative (no snapshot needed)
		{ input: 'Build to 8RM', expected: false, label: 'RM build (test to find max — no snapshot needed)' },
		{ input: '4 x 3 @50kg', expected: false, label: 'absolute kg' },
		{ input: '4 x 3 @85-89kg', expected: false, label: 'absolute kg range' },
		{ input: '', expected: false, label: 'empty' },
		{ input: 'not a valid input', expected: false, label: 'invalid' },
	];

	for (const c of cases) {
		it(`${c.label}: "${c.input}" → ${c.expected}`, () => {
			const parsed = parseSetInput(c.input);
			expect(exerciseNeedsRmSnapshot(parsed)).toBe(c.expected);
		});
	}
});

describe('findProgramRm', () => {
	const rms = [makeRm('Back Squat', 180), makeRm('Bench Press', 100)];

	it('finds an exact match', () => {
		expect(findProgramRm('Back Squat', rms)?.weight).toBe(180);
	});

	it('matches case-insensitively', () => {
		expect(findProgramRm('back squat', rms)?.weight).toBe(180);
	});

	it('trims whitespace', () => {
		expect(findProgramRm('  BACK SQUAT  ', rms)?.weight).toBe(180);
	});

	it('returns null for no match', () => {
		expect(findProgramRm('Deadlift', rms)).toBeNull();
	});
});

describe('resolveWeightsFromSnapshot', () => {
	const rms = [makeRm('Back Squat', 180), makeRm('Front Squat', 140)];

	it('resolves simple percentage', () => {
		const parsed = parseSetInput('6 x 2 @80%');
		const r = resolveWeightsFromSnapshot('Back Squat', parsed, rms);
		expect(r.weight).toBe(144); // round(180 * 0.8)
		expect(r.rmWeight).toBe(180);
		expect(r.rmSourceName).toBe('Back Squat');
	});

	it('resolves percentage range', () => {
		const parsed = parseSetInput('4 x 3 @80-85%');
		const r = resolveWeightsFromSnapshot('Back Squat', parsed, rms);
		expect(r.weightMin).toBe(144);
		expect(r.weightMax).toBe(153);
		expect(r.weight).toBe(144);
	});

	it('passes absolute weights through without needing a snapshot', () => {
		const parsed = parseSetInput('4 x 3 @50kg');
		// Note: no RM in snapshot for this name — still works because !needsRmLookup
		const r = resolveWeightsFromSnapshot('Unknown Exercise', parsed, []);
		expect(r.weight).toBe(50);
		expect(r.rmWeight).toBe(0);
	});

	it('throws when a snapshot is needed but missing', () => {
		const parsed = parseSetInput('4 x 3 @80%');
		expect(() => resolveWeightsFromSnapshot('Deadlift', parsed, rms)).toThrow(
			/No program 1RM snapshot/,
		);
	});

	it('matches the snapshot case-insensitively', () => {
		const parsed = parseSetInput('4 x 3 @80%');
		const r = resolveWeightsFromSnapshot('back squat', parsed, rms);
		expect(r.weight).toBe(144);
	});

	it('rounds results to the nearest integer', () => {
		const parsed = parseSetInput('3 x 5 @73%');
		const r = resolveWeightsFromSnapshot('Back Squat', parsed, rms);
		// 180 * 0.73 = 131.4 → rounds to 131
		expect(r.weight).toBe(131);
	});
});
