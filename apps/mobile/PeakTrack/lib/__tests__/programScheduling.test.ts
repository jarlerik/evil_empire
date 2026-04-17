import { getISOWeek, getISOWeekYear, format } from 'date-fns';
import {
	resolveSessionDate,
	resolveSessionForDate,
	resolveSessionsInRange,
	isoWeekOf,
} from '../programScheduling';

describe('programScheduling', () => {
	describe('resolveSessionDate', () => {
		it('returns Monday of the start week for (0, 1)', () => {
			// ISO week 16 of 2026 starts Mon April 13, 2026
			const d = resolveSessionDate(2026, 16, 0, 1);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-04-13');
		});

		it('returns the correct date for later weeks and days', () => {
			// Week 16 + 2 = week 18, day 4 (Thursday) → April 30, 2026
			const d = resolveSessionDate(2026, 16, 2, 4);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-04-30');
		});

		it('handles year boundaries — week 52 of one year → Monday of week 1 next year', () => {
			// ISO week 52 of 2024 is Dec 23–29, 2024; +1 week → Dec 30 2024 (ISO week 1 of 2025)
			const d = resolveSessionDate(2024, 52, 1, 1);
			expect(format(d, 'yyyy-MM-dd')).toBe('2024-12-30');
		});

		it('handles week 53 years (2020 had week 53)', () => {
			// Week 53 of 2020 starts Mon Dec 28, 2020
			const d = resolveSessionDate(2020, 53, 0, 1);
			expect(format(d, 'yyyy-MM-dd')).toBe('2020-12-28');
		});

		it('handles Sunday (ISO day 7)', () => {
			// Mon Apr 13 2026 + 6 days = Sun Apr 19 2026
			const d = resolveSessionDate(2026, 16, 0, 7);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-04-19');
		});

		it('survives DST spring-forward (US) — March transitions do not shift day count', () => {
			// DST in US springs forward Sun March 8, 2026. Check that week crossing DST lands right.
			// ISO week 10 of 2026 starts Mon March 2, 2026
			const d = resolveSessionDate(2026, 10, 1, 1); // Mon week 11 = Mon March 9, 2026
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-03-09');
		});
	});

	describe('resolveSessionForDate', () => {
		const program = { start_iso_year: 2026, start_iso_week: 16, duration_weeks: 9 };

		it('returns null for null iso_year or iso_week', () => {
			const unassigned = { start_iso_year: null, start_iso_week: null, duration_weeks: 9 };
			expect(resolveSessionForDate(unassigned, new Date('2026-04-13'))).toBeNull();
		});

		it('returns (0,1) for the first Monday of the program', () => {
			const r = resolveSessionForDate(program, new Date('2026-04-13T12:00:00Z'));
			expect(r).toEqual({ week_offset: 0, day_of_week: 1 });
		});

		it('returns (0,7) for the first Sunday', () => {
			const r = resolveSessionForDate(program, new Date('2026-04-19T12:00:00Z'));
			expect(r).toEqual({ week_offset: 0, day_of_week: 7 });
		});

		it('returns (8,4) for week 9 Thursday (last week)', () => {
			const r = resolveSessionForDate(program, new Date('2026-06-11T12:00:00Z'));
			expect(r).toEqual({ week_offset: 8, day_of_week: 4 });
		});

		it('returns null before the start week', () => {
			const r = resolveSessionForDate(program, new Date('2026-04-12T12:00:00Z'));
			expect(r).toBeNull();
		});

		it('returns null at the exclusive upper bound (week_offset === duration_weeks)', () => {
			// Program duration 9 → week_offset 9 is out. That's Mon June 15, 2026.
			const r = resolveSessionForDate(program, new Date('2026-06-15T12:00:00Z'));
			expect(r).toBeNull();
		});
	});

	describe('resolveSessionsInRange', () => {
		const program = { start_iso_year: 2026, start_iso_week: 16, duration_weeks: 2 };

		it('enumerates every day in a single week when program covers the whole week', () => {
			const start = new Date('2026-04-13T12:00:00Z'); // Mon
			const end = new Date('2026-04-19T12:00:00Z'); // Sun
			const out = resolveSessionsInRange(program, start, end);
			expect(out).toHaveLength(7);
			expect(out[0].day_of_week).toBe(1);
			expect(out[6].day_of_week).toBe(7);
			expect(out.every(s => s.week_offset === 0)).toBe(true);
		});

		it('returns [] for a range entirely before the program', () => {
			const start = new Date('2026-04-06T12:00:00Z');
			const end = new Date('2026-04-12T12:00:00Z');
			expect(resolveSessionsInRange(program, start, end)).toEqual([]);
		});

		it('returns [] for a range entirely after the program', () => {
			const start = new Date('2026-04-27T12:00:00Z'); // week 3 — out of 2-week program
			const end = new Date('2026-05-03T12:00:00Z');
			expect(resolveSessionsInRange(program, start, end)).toEqual([]);
		});
	});

	describe('isoWeekOf', () => {
		it('agrees with date-fns getISOWeek/getISOWeekYear', () => {
			const d = new Date('2026-04-13T12:00:00Z');
			const got = isoWeekOf(d);
			expect(got.iso_week).toBe(getISOWeek(d));
			expect(got.iso_year).toBe(getISOWeekYear(d));
		});
	});
});
