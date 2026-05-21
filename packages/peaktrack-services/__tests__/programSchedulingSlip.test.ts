import { format } from 'date-fns';
import {
	deriveCadence,
	slotIndexFor,
	slotToWeekDay,
	resolveSessionDateWithSlip,
	resolveSessionDates,
} from '../src/programScheduling';

describe('programScheduling — cadence + slip', () => {
	describe('deriveCadence', () => {
		it('returns sorted distinct day_of_week values', () => {
			expect(
				deriveCadence([
					{ day_of_week: 4 },
					{ day_of_week: 1 },
					{ day_of_week: 4 },
					{ day_of_week: 1 },
				]),
			).toEqual([1, 4]);
		});

		it('returns [] for no sessions', () => {
			expect(deriveCadence([])).toEqual([]);
		});

		it('handles a single-day cadence', () => {
			expect(deriveCadence([{ day_of_week: 3 }, { day_of_week: 3 }])).toEqual([3]);
		});

		it('handles a three-day cadence', () => {
			expect(
				deriveCadence([
					{ day_of_week: 5 },
					{ day_of_week: 1 },
					{ day_of_week: 3 },
				]),
			).toEqual([1, 3, 5]);
		});
	});

	describe('slotIndexFor / slotToWeekDay', () => {
		const cadence = [1, 4]; // Mon + Thu

		it('maps (0, 1) → slot 0', () => {
			expect(slotIndexFor(0, 1, cadence)).toBe(0);
		});

		it('maps (0, 4) → slot 1', () => {
			expect(slotIndexFor(0, 4, cadence)).toBe(1);
		});

		it('maps (1, 1) → slot 2', () => {
			expect(slotIndexFor(1, 1, cadence)).toBe(2);
		});

		it('maps (4, 4) → slot 9 (week 5 Thu)', () => {
			expect(slotIndexFor(4, 4, cadence)).toBe(9);
		});

		it('is the inverse of slotToWeekDay for in-range slots', () => {
			for (let slot = 0; slot < 20; slot++) {
				const { week_offset, day_of_week } = slotToWeekDay(slot, cadence);
				expect(slotIndexFor(week_offset, day_of_week, cadence)).toBe(slot);
			}
		});

		it('extrapolates beyond stored sessions', () => {
			// 2x/week, slot 16 = (8, 1) — past an 8-week program
			expect(slotToWeekDay(16, cadence)).toEqual({ week_offset: 8, day_of_week: 1 });
		});

		it('throws when day_of_week is not in cadence', () => {
			expect(() => slotIndexFor(0, 3, cadence)).toThrow(/day_of_week/);
		});

		it('throws when cadence is empty', () => {
			expect(() => slotToWeekDay(0, [])).toThrow(/empty cadence/);
		});
	});

	describe('resolveSessionDateWithSlip', () => {
		// Russian back squat program: starts ISO week 16 of 2026 (Mon April 13).
		// Cadence Mon + Thu. duration_weeks not relevant to date math.
		const cadence = [1, 4];
		const startYear = 2026;
		const startWeek = 16;

		it('with slip=0 matches the un-slipped date', () => {
			// W5 Thu = week_offset 4, day_of_week 4
			// anchor is Mon Apr 13 2026; +4 weeks + 3 days = Thu May 14 2026
			const d = resolveSessionDateWithSlip(startYear, startWeek, 4, 4, 0, cadence);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-05-14');
		});

		it('with slip=1, W5 Thu lands on W6 Mon', () => {
			// W5 Thu (slot 9) + 1 = slot 10 = W5 Mon's "next slot" = (5, 1) = Mon May 18 2026
			const d = resolveSessionDateWithSlip(startYear, startWeek, 4, 4, 1, cadence);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-05-18');
		});

		it('with slip=1, W6 Mon lands on W6 Thu', () => {
			// W6 Mon (slot 10) + 1 = slot 11 = (5, 4) = Thu May 21 2026
			const d = resolveSessionDateWithSlip(startYear, startWeek, 5, 1, 1, cadence);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-05-21');
		});

		it('with slip=2, W5 Thu lands on W6 Thu', () => {
			// slot 9 + 2 = slot 11 = (5, 4) = Thu May 21 2026
			const d = resolveSessionDateWithSlip(startYear, startWeek, 4, 4, 2, cadence);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-05-21');
		});

		it('extrapolates past the program duration window when slip pushes us there', () => {
			// W8 Thu (slot 15, the last session of an 8-week program) + 1 = slot 16 = (8, 1)
			// anchor Mon Apr 13 + 8 weeks = Mon June 8 2026
			const d = resolveSessionDateWithSlip(startYear, startWeek, 7, 4, 1, cadence);
			expect(format(d, 'yyyy-MM-dd')).toBe('2026-06-08');
		});
	});

	describe('resolveSessionDates', () => {
		// Russian back squat program: 8 weeks, Mon + Thu, starts ISO week 16 of 2026
		const program = {
			start_iso_year: 2026,
			start_iso_week: 16,
			duration_weeks: 8,
			slip_slots: 0,
		};
		const sessions = (() => {
			const out: Array<{ id: string; week_offset: number; day_of_week: number }> = [];
			for (let w = 0; w < 8; w++) {
				out.push({ id: `w${w}-mon`, week_offset: w, day_of_week: 1 });
				out.push({ id: `w${w}-thu`, week_offset: w, day_of_week: 4 });
			}
			return out;
		})();

		// Use local-time constructors for range bounds so tests don't depend on
		// the host's timezone offset (resolveSessionDate returns local-midnight
		// dates via startOfISOWeek). Months are 0-indexed in the Date ctor.
		const localDay = (y: number, m1: number, d: number, h = 0): Date =>
			new Date(y, m1 - 1, d, h, 0, 0, 0);

		it('returns empty when start is unassigned', () => {
			const result = resolveSessionDates(
				{ ...program, start_iso_year: null, start_iso_week: null },
				sessions,
				localDay(2026, 4, 13),
				localDay(2026, 5, 31, 23),
			);
			expect(result).toEqual([]);
		});

		it('returns empty when no sessions', () => {
			const result = resolveSessionDates(
				program,
				[],
				localDay(2026, 4, 13),
				localDay(2026, 5, 31, 23),
			);
			expect(result).toEqual([]);
		});

		it('with slip=0, sessions land on their nominal dates', () => {
			// W5 Thu = Thu May 14 2026
			const result = resolveSessionDates(
				program,
				sessions,
				localDay(2026, 5, 14),
				localDay(2026, 5, 14, 23),
			);
			expect(result).toHaveLength(1);
			expect(result[0].session_id).toBe('w4-thu');
		});

		it('with slip=1, W5 Thu slides to W6 Mon', () => {
			const slipped = { ...program, slip_slots: 1 };
			// Look at the W6 Mon date — May 18 2026. Should now contain the W5 Thu prescription.
			const result = resolveSessionDates(
				slipped,
				sessions,
				localDay(2026, 5, 18),
				localDay(2026, 5, 18, 23),
			);
			expect(result).toHaveLength(1);
			expect(result[0].session_id).toBe('w4-thu');
			// The session's *identity* is preserved — week_offset/day_of_week reflect the original prescription
			expect(result[0]).toMatchObject({
				week_offset: 4,
				day_of_week: 4,
			});
		});

		it('with slip=1, everything from the slipped point onward shifts by one slot', () => {
			const slipped = { ...program, slip_slots: 1 };
			const result = resolveSessionDates(
				slipped,
				sessions,
				localDay(2026, 5, 18), // W6 Mon
				localDay(2026, 5, 21, 23), // W6 Thu end-of-day
			);
			const byDate = result
				.map(r => ({ date: format(r.date, 'yyyy-MM-dd'), id: r.session_id }))
				.sort((a, b) => a.date.localeCompare(b.date));
			// Mon May 18 → was W6 Mon's date, now hosts W5 Thu (w4-thu)
			// Thu May 21 → was W6 Thu's date, now hosts W6 Mon (w5-mon)
			expect(byDate).toEqual([
				{ date: '2026-05-18', id: 'w4-thu' },
				{ date: '2026-05-21', id: 'w5-mon' },
			]);
		});

		it('with slip=1, last session extends past original program end', () => {
			const slipped = { ...program, slip_slots: 1 };
			// Original program ends W8 Thu = Thu June 4 2026.
			// With slip=1, W8 Thu shifts to slot 16 = (8, 1) = Mon June 8 2026 —
			// one slot past the original 8-week window.
			const result = resolveSessionDates(
				slipped,
				sessions,
				localDay(2026, 6, 8),
				localDay(2026, 6, 8, 23),
			);
			expect(result).toHaveLength(1);
			expect(result[0].session_id).toBe('w7-thu');
		});
	});
});
