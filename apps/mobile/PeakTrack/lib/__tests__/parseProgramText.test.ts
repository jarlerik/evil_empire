import {
	parseProgramText,
	defaultDayForSession,
	serializeProgramText,
} from '../parseProgramText';

describe('parseProgramText', () => {
	it('parses the 2x/week example from the Russian squat program', () => {
		const input = `## 2 x week
6 x 2@80%
6 x 3@80%

6 x 2@80%
6 x 4@80%

6 x 2@80%
5 x 5@85%`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.sessionsPerWeek).toBe(2);
		expect(r.weeks).toHaveLength(3);
		expect(r.weeks[0].sessions.map(s => s.rawInput)).toEqual(['6 x 2@80%', '6 x 3@80%']);
		expect(r.weeks[1].sessions.map(s => s.rawInput)).toEqual(['6 x 2@80%', '6 x 4@80%']);
		expect(r.weeks[2].sessions.map(s => s.rawInput)).toEqual(['6 x 2@80%', '5 x 5@85%']);
	});

	it('parses the 3x/week format', () => {
		const input = `## 3 x week
6 x 2@80%
6 x 3@80%
6 x 2@80%

6 x 4@80%
6 x 2@80%
6 x 5@80%`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.sessionsPerWeek).toBe(3);
		expect(r.weeks).toHaveLength(2);
		expect(r.weeks[0].sessions).toHaveLength(3);
		expect(r.weeks[1].sessions).toHaveLength(3);
	});

	it('warns when a block line count does not match the header', () => {
		const input = `## 2 x week
6 x 2@80%
6 x 3@80%

6 x 4@80%`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.weeks).toHaveLength(2);
		expect(r.warnings.length).toBeGreaterThan(0);
		expect(r.warnings.some(w => w.includes('Week 2'))).toBe(true);
	});

	it('reports errors for unparseable set specs', () => {
		const input = `## 2 x week
6 x 2@80%
not a real spec`;
		const r = parseProgramText(input);
		expect(r.errors.length).toBeGreaterThan(0);
		expect(r.errors[0]).toMatch(/Week 1 line 2/);
	});

	it('accepts "1 x 105%" shorthand as "1 x 1 @105%"', () => {
		const input = `## 2 x week
6 x 2@80%
1 x 105%`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.weeks[0].sessions[1].rawInput).toBe('1 x 1 @105%');
	});

	it('accepts "3 x 5 80%" shorthand as "3 x 5 @80%"', () => {
		const input = `## 1 x week
3 x 5 80%`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.weeks[0].sessions[0].rawInput).toBe('3 x 5 @80%');
	});

	it('accepts kg and lbs shorthand', () => {
		const input = `## 1 x week
1 x 100kg

1 x 220lbs`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.weeks[0].sessions[0].rawInput).toBe('1 x 1 @100kg');
		expect(r.weeks[1].sessions[0].rawInput).toBe('1 x 1 @220lbs');
	});

	it('infers sessions_per_week from the most common block length when no header', () => {
		const input = `6 x 2@80%
6 x 3@80%

6 x 2@80%
6 x 4@80%`;
		const r = parseProgramText(input);
		expect(r.sessionsPerWeek).toBe(2);
	});

	it('supports optional "Name: spec" prefix on individual lines', () => {
		const input = `## 2 x week
Back squat: 6 x 2@80%
Front squat: 6 x 3@80%`;
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.weeks[0].sessions[0].name).toBe('Back squat');
		expect(r.weeks[0].sessions[0].rawInput).toBe('6 x 2@80%');
		expect(r.weeks[0].sessions[1].name).toBe('Front squat');
	});

	it('handles Windows-style CRLF line endings', () => {
		const input = '## 2 x week\r\n6 x 2@80%\r\n6 x 3@80%\r\n\r\n6 x 4@80%\r\n6 x 5@80%';
		const r = parseProgramText(input);
		expect(r.errors).toEqual([]);
		expect(r.weeks).toHaveLength(2);
	});

	it('ignores the header if the declared value is out of range', () => {
		const input = `## 9 x week
6 x 2@80%`;
		const r = parseProgramText(input);
		// sessionsPerWeek stays null from the header (9 is out of range),
		// but parsing continues on subsequent lines.
		expect(r.sessionsPerWeek).toBe(1); // inferred from block length
	});
});

describe('defaultDayForSession', () => {
	it('maps 2x/week to Mon and Thu', () => {
		expect(defaultDayForSession(0, 2)).toBe(1);
		expect(defaultDayForSession(1, 2)).toBe(4);
	});

	it('maps 3x/week to Mon Wed Fri', () => {
		expect(defaultDayForSession(0, 3)).toBe(1);
		expect(defaultDayForSession(1, 3)).toBe(3);
		expect(defaultDayForSession(2, 3)).toBe(5);
	});

	it('maps 5x/week to Mon–Fri', () => {
		expect(defaultDayForSession(0, 5)).toBe(1);
		expect(defaultDayForSession(4, 5)).toBe(5);
	});

	it('falls back for unknown N', () => {
		expect(defaultDayForSession(0, 99)).toBe(1);
	});
});

describe('serializeProgramText', () => {
	it('round-trips a 2x/week program', () => {
		const sessions = [
			{
				week_offset: 0,
				day_of_week: 1,
				exercises: [{ name: 'Back squat', raw_input: '6 x 2@80%' }],
			},
			{
				week_offset: 0,
				day_of_week: 4,
				exercises: [{ name: 'Back squat', raw_input: '6 x 3@80%' }],
			},
			{
				week_offset: 1,
				day_of_week: 1,
				exercises: [{ name: 'Back squat', raw_input: '6 x 2@80%' }],
			},
			{
				week_offset: 1,
				day_of_week: 4,
				exercises: [{ name: 'Back squat', raw_input: '6 x 4@80%' }],
			},
		];
		const text = serializeProgramText(sessions, 'Back squat');
		expect(text).toContain('## 2 x week');
		const reparsed = parseProgramText(text);
		expect(reparsed.errors).toEqual([]);
		expect(reparsed.weeks).toHaveLength(2);
		expect(reparsed.weeks[0].sessions).toHaveLength(2);
	});

	it('keeps name prefix when any exercise differs from the default', () => {
		const sessions = [
			{
				week_offset: 0,
				day_of_week: 1,
				exercises: [{ name: 'Back squat', raw_input: '6 x 2@80%' }],
			},
			{
				week_offset: 0,
				day_of_week: 4,
				exercises: [{ name: 'Front squat', raw_input: '6 x 3@80%' }],
			},
		];
		const text = serializeProgramText(sessions, 'Back squat');
		expect(text).toMatch(/Back squat: 6 x 2@80%/);
		expect(text).toMatch(/Front squat: 6 x 3@80%/);
	});

	it('returns empty string for an empty program', () => {
		expect(serializeProgramText([], 'Anything')).toBe('');
	});

	it('returns empty string when every session has no exercises (orphans)', () => {
		const sessions = [
			{ week_offset: 0, day_of_week: 1, exercises: [] },
			{ week_offset: 0, day_of_week: 4, exercises: [] },
		];
		expect(serializeProgramText(sessions, 'Back squat')).toBe('');
	});
});
