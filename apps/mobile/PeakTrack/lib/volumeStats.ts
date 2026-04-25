export interface VolumePoint {
	/** Local-time YYYY-MM-DD. */
	date: string;
	/** Volume in the user's preferred unit (kg or lbs). */
	volume: number;
}

export interface WindowStat {
	volume: number;
	previousVolume: number;
	/** null when previousVolume === 0 (no baseline to compare against). */
	deltaPct: number | null;
}

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface TrendLabel {
	label: string;
	direction: TrendDirection;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Convert a Date to a local-time YYYY-MM-DD string. We use `en-CA` because it
 * always formats as ISO date regardless of the host locale.
 */
export function toLocalDateString(d: Date): string {
	return d.toLocaleDateString('en-CA');
}

function startOfLocalDay(d: Date): Date {
	const copy = new Date(d);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function parseLocalDate(yyyymmdd: string): Date {
	const [y, m, day] = yyyymmdd.split('-').map(Number);
	return new Date(y, (m ?? 1) - 1, day ?? 1);
}

/**
 * Sum volume across rolling windows anchored at `now`:
 *   current  = [now - days, now]            (last `days` days)
 *   previous = [now - 2*days, now - days]   (the `days` days before that)
 *
 * Window boundaries are inclusive on the lower edge and exclusive on the upper
 * edge (a point at exactly `now - days` falls in the *previous* window).
 *
 * `deltaPct` is rounded to the nearest integer percent. It is null when the
 * previous window has zero volume — there is no baseline to compare to.
 */
export function rollingWindowStat(
	points: VolumePoint[],
	days: number,
	now: Date = new Date(),
): WindowStat {
	const today = startOfLocalDay(now);
	const currentStart = new Date(today.getTime() - days * MS_PER_DAY);
	const previousStart = new Date(today.getTime() - 2 * days * MS_PER_DAY);

	let current = 0;
	let previous = 0;
	for (const p of points) {
		const d = parseLocalDate(p.date);
		const t = d.getTime();
		if (t >= currentStart.getTime() && t <= today.getTime()) {
			current += p.volume;
		} else if (t >= previousStart.getTime() && t < currentStart.getTime()) {
			previous += p.volume;
		}
	}

	const deltaPct =
		previous === 0
			? null
			: Math.round(((current - previous) / previous) * 100);

	return { volume: current, previousVolume: previous, deltaPct };
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 0,
});

export function formatVolume(value: number, unit: 'kg' | 'lbs'): string {
	return `${NUMBER_FORMATTER.format(Math.round(value))} ${unit}`;
}

export function formatTrend(deltaPct: number | null): TrendLabel {
	if (deltaPct === null) {
		return { label: '—', direction: 'neutral' };
	}
	if (deltaPct === 0) {
		return { label: '0%', direction: 'neutral' };
	}
	if (deltaPct > 0) {
		return { label: `+${deltaPct}%`, direction: 'up' };
	}
	return { label: `${deltaPct}%`, direction: 'down' };
}

/**
 * Bucket a list of points by date, summing volumes that share the same day.
 * Used when callers have one row per execution-log but want a per-day series.
 */
export function bucketByDate(points: VolumePoint[]): VolumePoint[] {
	const byDate = new Map<string, number>();
	for (const p of points) {
		byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.volume);
	}
	return Array.from(byDate.entries()).map(([date, volume]) => ({ date, volume }));
}
