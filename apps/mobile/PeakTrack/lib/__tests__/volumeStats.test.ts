import {
	bucketByDate,
	formatTrend,
	formatVolume,
	rollingWindowStat,
	toLocalDateString,
	type VolumePoint,
} from '../volumeStats';

const NOW = new Date(2026, 3, 25); // 2026-04-25, local

describe('rollingWindowStat', () => {
	it('sums points inside the current window only', () => {
		const points: VolumePoint[] = [
			{ date: '2026-04-24', volume: 100 }, // current
			{ date: '2026-04-19', volume: 200 }, // current (today - 6d)
			{ date: '2026-04-10', volume: 999 }, // outside both windows
		];
		const stat = rollingWindowStat(points, 7, NOW);
		expect(stat.volume).toBe(300);
		expect(stat.previousVolume).toBe(0);
		expect(stat.deltaPct).toBeNull();
	});

	it('computes positive delta when current > previous', () => {
		const points: VolumePoint[] = [
			{ date: '2026-04-24', volume: 120 }, // current
			{ date: '2026-04-15', volume: 100 }, // previous (today - 10d, in [-14, -7))
		];
		const stat = rollingWindowStat(points, 7, NOW);
		expect(stat.volume).toBe(120);
		expect(stat.previousVolume).toBe(100);
		expect(stat.deltaPct).toBe(20);
	});

	it('computes negative delta when current < previous', () => {
		const points: VolumePoint[] = [
			{ date: '2026-04-24', volume: 80 }, // current
			{ date: '2026-04-15', volume: 100 }, // previous
		];
		const stat = rollingWindowStat(points, 7, NOW);
		expect(stat.deltaPct).toBe(-20);
	});

	it('returns null deltaPct when previous window is empty', () => {
		const points: VolumePoint[] = [{ date: '2026-04-24', volume: 100 }];
		expect(rollingWindowStat(points, 7, NOW).deltaPct).toBeNull();
	});

	it('places a point at exactly now-Nd into the previous window', () => {
		// 30d window — point at 2026-03-26 (now - 30d) is the lower edge of current
		// (inclusive), so it counts as current. A point at 2026-03-25 (now - 31d)
		// is in previous.
		const onEdge: VolumePoint = { date: '2026-03-26', volume: 50 };
		const justBefore: VolumePoint = { date: '2026-03-25', volume: 50 };
		const stat = rollingWindowStat([onEdge, justBefore], 30, NOW);
		expect(stat.volume).toBe(50);
		expect(stat.previousVolume).toBe(50);
	});

	it('handles 30-day window with mixed points', () => {
		const points: VolumePoint[] = [
			{ date: '2026-04-20', volume: 1000 }, // current
			{ date: '2026-04-01', volume: 500 }, // current
			{ date: '2026-03-15', volume: 800 }, // previous
			{ date: '2026-02-20', volume: 999 }, // outside
		];
		const stat = rollingWindowStat(points, 30, NOW);
		expect(stat.volume).toBe(1500);
		expect(stat.previousVolume).toBe(800);
		expect(stat.deltaPct).toBe(88); // (1500-800)/800 = 87.5 → 88
	});

	it('handles current=0 with non-zero previous as -100%', () => {
		const points: VolumePoint[] = [{ date: '2026-04-15', volume: 100 }];
		const stat = rollingWindowStat(points, 7, NOW);
		expect(stat.volume).toBe(0);
		expect(stat.previousVolume).toBe(100);
		expect(stat.deltaPct).toBe(-100);
	});

	it('returns zero stat for empty input', () => {
		expect(rollingWindowStat([], 7, NOW)).toEqual({
			volume: 0,
			previousVolume: 0,
			deltaPct: null,
		});
	});
});

describe('formatVolume', () => {
	it('formats with thousands separator and unit suffix', () => {
		expect(formatVolume(1240, 'kg')).toBe('1,240 kg');
		expect(formatVolume(1240, 'lbs')).toBe('1,240 lbs');
	});

	it('rounds to nearest integer', () => {
		expect(formatVolume(1240.4, 'kg')).toBe('1,240 kg');
		expect(formatVolume(1240.6, 'kg')).toBe('1,241 kg');
	});

	it('formats zero', () => {
		expect(formatVolume(0, 'kg')).toBe('0 kg');
	});
});

describe('formatTrend', () => {
	it('returns em dash for null', () => {
		expect(formatTrend(null)).toEqual({ label: '—', direction: 'neutral' });
	});

	it('returns 0% neutral for zero', () => {
		expect(formatTrend(0)).toEqual({ label: '0%', direction: 'neutral' });
	});

	it('prefixes positive with +', () => {
		expect(formatTrend(12)).toEqual({ label: '+12%', direction: 'up' });
	});

	it('preserves the minus sign on negative', () => {
		expect(formatTrend(-12)).toEqual({ label: '-12%', direction: 'down' });
	});
});

describe('bucketByDate', () => {
	it('sums volumes that share the same date', () => {
		const out = bucketByDate([
			{ date: '2026-04-24', volume: 100 },
			{ date: '2026-04-24', volume: 50 },
			{ date: '2026-04-23', volume: 200 },
		]);
		// Order is insertion order from Map.
		expect(out).toEqual([
			{ date: '2026-04-24', volume: 150 },
			{ date: '2026-04-23', volume: 200 },
		]);
	});

	it('returns [] for empty input', () => {
		expect(bucketByDate([])).toEqual([]);
	});
});

describe('toLocalDateString', () => {
	it('formats a Date as YYYY-MM-DD in local time', () => {
		const d = new Date(2026, 3, 25, 14, 30); // 2026-04-25 14:30 local
		expect(toLocalDateString(d)).toBe('2026-04-25');
	});
});
