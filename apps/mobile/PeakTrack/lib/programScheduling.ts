import {
	getISOWeek,
	getISOWeekYear,
	setISOWeek,
	setISOWeekYear,
	startOfISOWeek,
	differenceInCalendarDays,
	addDays,
} from 'date-fns';

interface ProgramWindow {
	start_iso_year: number | null;
	start_iso_week: number | null;
	duration_weeks: number;
}

/**
 * The calendar date on which a given (week_offset, day_of_week) of a program
 * falls, given its start ISO year/week.
 *
 * `weekOffset` is 0-indexed. `dayOfWeek` is 1..7 (ISO Mon..Sun).
 */
export function resolveSessionDate(
	startIsoYear: number,
	startIsoWeek: number,
	weekOffset: number,
	dayOfWeek: number,
): Date {
	// Anchor at Monday of the start week. We set year then week to avoid
	// the year→week order dependency issue in some date-fns builds.
	const yearAnchored = setISOWeekYear(new Date(), startIsoYear);
	const weekAnchored = setISOWeek(yearAnchored, startIsoWeek);
	const anchor = startOfISOWeek(weekAnchored);
	return addDays(anchor, weekOffset * 7 + (dayOfWeek - 1));
}

/**
 * Given a program window, which (week_offset, day_of_week) — if any — does
 * `date` fall on? Returns null if out of window or program is unassigned.
 */
export function resolveSessionForDate(
	program: ProgramWindow,
	date: Date,
): { week_offset: number; day_of_week: number } | null {
	if (program.start_iso_year == null || program.start_iso_week == null) {
		return null;
	}
	const yearAnchored = setISOWeekYear(new Date(), program.start_iso_year);
	const weekAnchored = setISOWeek(yearAnchored, program.start_iso_week);
	const anchor = startOfISOWeek(weekAnchored);
	const days = differenceInCalendarDays(startOfISOWeek(date), anchor);
	if (days < 0) {
		return null;
	}
	const weekOffset = Math.floor(days / 7);
	if (weekOffset >= program.duration_weeks) {
		return null;
	}
	// Recompute day-of-week from the original date (not normalized to week start),
	// so DST shifts inside a week can't mis-count.
	const dayDelta = differenceInCalendarDays(date, addDays(anchor, weekOffset * 7));
	if (dayDelta < 0 || dayDelta > 6) {
		return null;
	}
	return { week_offset: weekOffset, day_of_week: dayDelta + 1 };
}

/**
 * All program sessions that fall inside [startDate, endDate] (inclusive).
 */
export function resolveSessionsInRange(
	program: ProgramWindow,
	startDate: Date,
	endDate: Date,
): Array<{ date: Date; week_offset: number; day_of_week: number }> {
	const out: Array<{ date: Date; week_offset: number; day_of_week: number }> = [];
	let d = startDate;
	while (d <= endDate) {
		const r = resolveSessionForDate(program, d);
		if (r) {
			out.push({ date: d, week_offset: r.week_offset, day_of_week: r.day_of_week });
		}
		d = addDays(d, 1);
	}
	return out;
}

/** Get the ISO year/week for a calendar date (convenience wrapper). */
export function isoWeekOf(date: Date): { iso_year: number; iso_week: number } {
	return {
		iso_year: getISOWeekYear(date),
		iso_week: getISOWeek(date),
	};
}
