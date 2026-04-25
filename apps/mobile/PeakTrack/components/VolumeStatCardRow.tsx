import { View, StyleSheet } from 'react-native';
import { StatCard } from '@evil-empire/ui';
import {
	formatTrend,
	formatVolume,
	rollingWindowStat,
	type VolumePoint,
} from '../lib/volumeStats';

interface VolumeStatCardRowProps {
	points: VolumePoint[];
	unit: 'kg' | 'lbs';
	now?: Date;
}

export function VolumeStatCardRow({ points, unit, now }: VolumeStatCardRowProps) {
	const week = rollingWindowStat(points, 7, now);
	const month = rollingWindowStat(points, 30, now);
	const weekTrend = formatTrend(week.deltaPct);
	const monthTrend = formatTrend(month.deltaPct);

	return (
		<View style={styles.row}>
			<View style={styles.cell}>
				<StatCard
					value={formatVolume(week.volume, unit)}
					label="Volume · 7d"
					trend={weekTrend.label}
					trendDirection={weekTrend.direction}
					valueStyle={styles.value}
					labelStyle={styles.label}
				/>
			</View>
			<View style={styles.cell}>
				<StatCard
					value={formatVolume(month.volume, unit)}
					label="Volume · 30d"
					trend={monthTrend.label}
					trendDirection={monthTrend.direction}
					valueStyle={styles.value}
					labelStyle={styles.label}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 8,
	},
	cell: {
		flex: 1,
	},
	value: {
		fontSize: 18,
		lineHeight: 22,
	},
	label: {
		fontSize: 16,
		lineHeight: 20,
	},
});
