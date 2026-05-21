import {
	getISOWeek,
	getISOWeekYear,
	setISOWeek,
	setISOWeekYear,
	startOfISOWeek,
	differenceInCalendarDays,
	addDays,
} from 'date-fns';

/**
 * Build a stable anchor for a given ISO year + week. Using noon as the seed
 * avoids DST-transition windows where the intra-day hour shifts the ISO
 * week of the resulting date. startOfISOWeek normalizes the output to
 * local-midnight-Monday regardless.
 */
function anchorForIsoWeek(isoYear: number, isoWeek: number): Date {
	const seed = new Date();
	seed.setHours(12, 0, 0, 0);
	const yearAnchored = setISOWeekYear(seed, isoYear);
	const weekAnchored = setISOWeek(yearAnchored, isoWeek);
	return startOfISOWeek(weekAnchored);
}

interface ProgramWindow {
	start_iso_year: number | null;
	start_iso_week: number | null;
	duration_weeks: number;
}

/**
 * The calendar date on which a given (week_offset, day_of_week) of a program
 * falls, given its start ISO year/week. Slip-blind: callers that need to
 * honor `programs.slip_slots` should use `resolveSessionDateWithSlip`.
 *
 * `weekOffset` is 0-indexed. `dayOfWeek` is 1..7 (ISO Mon..Sun).
 */
export function resolveSessionDate(
	startIsoYear: number,
	startIsoWeek: number,
	weekOffset: number,
	dayOfWeek: number,
): Date {
	const anchor = anchorForIsoWeek(startIsoYear, startIsoWeek);
	return addDays(anchor, weekOffset * 7 + (dayOfWeek - 1));
}

/**
 * Given a program window, which (week_offset, day_of_week) — if any — does
 * `date` fall on? Returns null if out of window or program is unassigned.
 * Slip-blind by design — this maps a calendar date to its position in the
 * program's *original* layout, without applying slip. Used by callers that
 * need pre-slip identity (e.g., "is this date inside the original program
 * window?").
 */
export function resolveSessionForDate(
	program: ProgramWindow,
	date: Date,
): { week_offset: number; day_of_week: number } | null {
	if (program.start_iso_year == null || program.start_iso_week == null) {
		return null;
	}
	const anchor = anchorForIsoWeek(program.start_iso_year, program.start_iso_week);
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
 * All program slots in [startDate, endDate] (inclusive). Slip-blind; returns
 * every day the program intersects, with its original (week_offset, day_of_week)
 * coordinates. Used as a coarse intersection helper. For session-driven, slip-
 * aware rendering see `resolveSessionDates`.
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

// ============================================================================
// Cadence + slip
// ============================================================================
//
// A program's "cadence" is the sorted distinct day_of_week values used by its
// sessions. For a Mon+Thu program: [1, 4]. A "slot" is one cadence position
// across the program — slot 0 is the first Mon, slot 1 is the first Thu,
// slot 2 is the second Mon, etc. `programs.slip_slots` shifts every session's
// rendered slot forward by that many positions; materialized workouts are
// unaffected because their workout_date is concrete.

/**
 * Sorted distinct day_of_week values across a program's sessions. Returns []
 * if no sessions. Caller is responsible for not asking for slot math when
 * cadence is empty.
 */
export function deriveCadence(
	sessions: Array<{ day_of_week: number }>,
): number[] {
	const set = new Set<number>();
	for (const s of sessions) {
		set.add(s.day_of_week);
	}
	return Array.from(set).sort((a, b) => a - b);
}

/**
 * Slot index for a (weekOffset, dayOfWeek) within a cadence. Throws if
 * dayOfWeek is not in cadence (programmer error — every session's
 * day_of_week is in the program's own cadence by construction of
 * `deriveCadence`).
 */
export function slotIndexFor(
	weekOffset: number,
	dayOfWeek: number,
	cadence: number[],
): number {
	const dayPos = cadence.indexOf(dayOfWeek);
	if (dayPos < 0) {
		throw new Error(
			`day_of_week ${dayOfWeek} not in cadence [${cadence.join(',')}]`,
		);
	}
	return weekOffset * cadence.length + dayPos;
}

/**
 * Inverse of `slotIndexFor`. Extrapolates beyond the program's stored
 * sessions when a slipped slot lands in a week that doesn't have a stored
 * session row — this is intentional: slip pushes the program past its
 * original calendar window.
 */
export function slotToWeekDay(
	slot: number,
	cadence: number[],
): { week_offset: number; day_of_week: number } {
	if (cadence.length === 0) {
		throw new Error('slotToWeekDay called with empty cadence');
	}
	const w = Math.floor(slot / cadence.length);
	const d = cadence[slot % cadence.length];
	return { week_offset: w, day_of_week: d };
}

/**
 * The calendar date a session lays on, given the program's slip. When
 * `slipSlots === 0` (and cadence has more than one day) this is equivalent
 * to `resolveSessionDate(year, week, sessionWeekOffset, sessionDayOfWeek)`.
 */
export function resolveSessionDateWithSlip(
	startIsoYear: number,
	startIsoWeek: number,
	sessionWeekOffset: number,
	sessionDayOfWeek: number,
	slipSlots: number,
	cadence: number[],
): Date {
	const baseSlot = slotIndexFor(sessionWeekOffset, sessionDayOfWeek, cadence);
	const { week_offset, day_of_week } = slotToWeekDay(
		baseSlot + slipSlots,
		cadence,
	);
	return resolveSessionDate(startIsoYear, startIsoWeek, week_offset, day_of_week);
}

interface ProgramWithSlip extends ProgramWindow {
	slip_slots: number;
}

/**
 * For each session, compute its slipped calendar date. Returns only sessions
 * whose slipped date falls within [startDate, endDate] (inclusive). The
 * program's cadence is derived from the full sessions list passed in
 * (`sessions` should be every session in the program, not just one week's,
 * so that cadence detection is correct).
 *
 * If the program has null start_iso_year/start_iso_week (draft), returns [].
 */
export function resolveSessionDates(
	program: ProgramWithSlip,
	sessions: Array<{ id: string; week_offset: number; day_of_week: number }>,
	startDate: Date,
	endDate: Date,
): Array<{
	session_id: string;
	date: Date;
	week_offset: number;
	day_of_week: number;
}> {
	if (program.start_iso_year == null || program.start_iso_week == null) {
		return [];
	}
	if (sessions.length === 0) {
		return [];
	}
	const cadence = deriveCadence(sessions);
	const out: Array<{
		session_id: string;
		date: Date;
		week_offset: number;
		day_of_week: number;
	}> = [];
	for (const s of sessions) {
		const date = resolveSessionDateWithSlip(
			program.start_iso_year,
			program.start_iso_week,
			s.week_offset,
			s.day_of_week,
			program.slip_slots,
			cadence,
		);
		if (date >= startDate && date <= endDate) {
			out.push({
				session_id: s.id,
				date,
				week_offset: s.week_offset,
				day_of_week: s.day_of_week,
			});
		}
	}
	return out;
}
