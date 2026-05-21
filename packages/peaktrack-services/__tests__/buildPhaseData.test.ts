import type { ParsedSetData } from '@evil-empire/parsers';
import { buildPhaseData } from '../src/buildPhaseData';

function parsed(overrides: Partial<ParsedSetData> = {}): ParsedSetData {
	return {
		sets: 3,
		reps: 5,
		exerciseType: 'standard',
		...overrides,
	} as ParsedSetData;
}

describe('buildPhaseData rest_time_seconds fallback', () => {
	it('uses explicit rest from parsed input', () => {
		const data = buildPhaseData('ex1', parsed({ restTimeSeconds: 90 }), 50, undefined, false, 120);
		expect(data.rest_time_seconds).toBe(90);
	});

	it('falls back to default on insert when parser yields no rest', () => {
		const data = buildPhaseData('ex1', parsed(), 50, undefined, false, 120);
		expect(data.rest_time_seconds).toBe(120);
	});

	it('falls back to default on update when parser yields no rest', () => {
		const data = buildPhaseData('ex1', parsed(), 50, undefined, true, 120);
		expect(data.rest_time_seconds).toBe(120);
	});

	it('omits rest on insert when no explicit and no default', () => {
		const data = buildPhaseData('ex1', parsed(), 50, undefined, false);
		expect('rest_time_seconds' in data).toBe(false);
	});

	it('clears rest on update when no explicit and no default', () => {
		const data = buildPhaseData('ex1', parsed(), 50, undefined, true);
		expect(data.rest_time_seconds).toBeNull();
	});

	it('treats null default the same as missing default', () => {
		const insert = buildPhaseData('ex1', parsed(), 50, undefined, false, null);
		expect('rest_time_seconds' in insert).toBe(false);
		const update = buildPhaseData('ex1', parsed(), 50, undefined, true, null);
		expect(update.rest_time_seconds).toBeNull();
	});

	it('treats default of 0 as a real value (no rest, baked in)', () => {
		const data = buildPhaseData('ex1', parsed(), 50, undefined, false, 0);
		expect(data.rest_time_seconds).toBe(0);
	});
});
