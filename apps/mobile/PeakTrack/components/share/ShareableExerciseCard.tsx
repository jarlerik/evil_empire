import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExerciseSessionLayout } from '@evil-empire/peaktrack-services';
import {
	VolumeTiles,
	type VolumeTilesDimensions,
	layoutGeometry,
} from '../VolumeTiles';
import {
	bucketByDate,
	formatTrend,
	formatVolume,
	rollingWindowStat,
	type VolumePoint,
} from '../../lib/volumeStats';
import { colors } from '../../styles/common';

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;
const TILE_AREA_MAX_WIDTH = 1000;
const MAX_SESSIONS = 8;

const SHARE_TILE_DIMS: Partial<VolumeTilesDimensions> = {
	tileSize: 20,
	tileGap: 3,
	setColumnGap: 3,
	columnGap: 12,
	minSessionWidth: 96,
	trendHeight: 280,
	trendTopPadding: 24,
	trendBottomPadding: 24,
	weightLabelFontSize: 20,
	dayLabelFontSize: 22,
	volumeTextFontSize: 22,
	trendStrokeWidth: 4,
	trendDotRadius: 6,
	labelRowMarginTop: 16,
	volumeRowMarginBottom: 12,
};

export interface ShareableExerciseCardProps {
	exerciseName: string;
	layouts: ExerciseSessionLayout[];
	weightUnit: 'kg' | 'lbs';
	oneRepMax: { weight: number } | null;
}

export function ShareableExerciseCard({
	exerciseName,
	layouts,
	weightUnit,
	oneRepMax,
}: ShareableExerciseCardProps) {
	const recentLayouts = layouts.slice(-MAX_SESSIONS);

	const volumePoints: VolumePoint[] = bucketByDate(
		layouts.map(l => ({ date: l.workoutDate, volume: l.volume })),
	);
	const week = rollingWindowStat(volumePoints, 7);
	const month = rollingWindowStat(volumePoints, 30);
	const weekTrend = formatTrend(week.deltaPct);
	const monthTrend = formatTrend(month.deltaPct);

	const fullDims: VolumeTilesDimensions = {
		tileSize: SHARE_TILE_DIMS.tileSize ?? 20,
		tileGap: SHARE_TILE_DIMS.tileGap ?? 3,
		columnGap: SHARE_TILE_DIMS.columnGap ?? 12,
		setColumnGap: SHARE_TILE_DIMS.setColumnGap ?? 3,
		minSessionWidth: SHARE_TILE_DIMS.minSessionWidth ?? 96,
		trendHeight: SHARE_TILE_DIMS.trendHeight ?? 280,
		trendTopPadding: SHARE_TILE_DIMS.trendTopPadding ?? 24,
		trendBottomPadding: SHARE_TILE_DIMS.trendBottomPadding ?? 24,
		weightLabelFontSize: SHARE_TILE_DIMS.weightLabelFontSize ?? 20,
		dayLabelFontSize: SHARE_TILE_DIMS.dayLabelFontSize ?? 22,
		volumeTextFontSize: SHARE_TILE_DIMS.volumeTextFontSize ?? 22,
		trendStrokeWidth: SHARE_TILE_DIMS.trendStrokeWidth ?? 4,
		trendDotRadius: SHARE_TILE_DIMS.trendDotRadius ?? 6,
		labelRowMarginTop: SHARE_TILE_DIMS.labelRowMarginTop ?? 16,
		volumeRowMarginBottom: SHARE_TILE_DIMS.volumeRowMarginBottom ?? 12,
	};
	const { totalWidth } = layoutGeometry(recentLayouts, fullDims);
	const fitScale = totalWidth > TILE_AREA_MAX_WIDTH ? TILE_AREA_MAX_WIDTH / totalWidth : 1;

	return (
		<View style={styles.card}>
			<View style={styles.brandRow}>
				<Ionicons name="barbell" size={48} color={colors.primary} />
				<Text style={styles.brand}>PeakTrack</Text>
			</View>

			<Text style={styles.exerciseName} numberOfLines={2}>
				{exerciseName}
			</Text>

			{oneRepMax ? (
				<View style={styles.heroBadge}>
					<Text style={styles.heroLabel}>1 REP MAX</Text>
					<Text style={styles.heroValue}>
						{Math.round(oneRepMax.weight)}
						<Text style={styles.heroUnit}> {weightUnit}</Text>
					</Text>
				</View>
			) : null}

			<View style={styles.statRow}>
				<StatBlock
					value={formatVolume(week.volume, weightUnit)}
					label="Volume · 7d"
					trend={weekTrend.label}
					trendDirection={weekTrend.direction}
				/>
				<StatBlock
					value={formatVolume(month.volume, weightUnit)}
					label="Volume · 30d"
					trend={monthTrend.label}
					trendDirection={monthTrend.direction}
				/>
			</View>

			<View style={styles.tilesArea}>
				<View
					style={{
						transform: [{ scale: fitScale }],
						width: totalWidth,
					}}
				>
					<VolumeTiles layouts={recentLayouts} dimensions={SHARE_TILE_DIMS} />
				</View>
			</View>

			<View style={styles.footer}>
				<Text style={styles.footerText}>peaktrack.app</Text>
			</View>
		</View>
	);
}

interface StatBlockProps {
	value: string;
	label: string;
	trend: string;
	trendDirection: 'up' | 'down' | 'neutral';
}

function StatBlock({ value, label, trend, trendDirection }: StatBlockProps) {
	const trendColor =
		trendDirection === 'up'
			? '#22c55e'
			: trendDirection === 'down'
				? '#ef4444'
				: '#888';
	return (
		<View style={styles.statBlock}>
			<View style={styles.statValueRow}>
				<Text style={styles.statValue} numberOfLines={1}>
					{value}
				</Text>
				<Text style={[styles.statTrend, { color: trendColor }]}>{trend}</Text>
			</View>
			<Text style={styles.statLabel}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		width: SHARE_CARD_WIDTH,
		height: SHARE_CARD_HEIGHT,
		backgroundColor: 'transparent',
		paddingTop: 100,
		paddingBottom: 80,
		paddingHorizontal: 60,
		alignItems: 'center',
	},
	brandRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		marginBottom: 60,
	},
	brand: {
		color: colors.primary,
		fontSize: 44,
		fontWeight: '800',
		letterSpacing: 1,
	},
	exerciseName: {
		color: colors.text,
		fontSize: 72,
		fontWeight: '800',
		textAlign: 'center',
		marginBottom: 40,
	},
	heroBadge: {
		alignItems: 'center',
		marginBottom: 60,
	},
	heroLabel: {
		color: colors.primary,
		fontSize: 28,
		fontWeight: '700',
		letterSpacing: 4,
		marginBottom: 12,
	},
	heroValue: {
		color: colors.text,
		fontSize: 180,
		fontWeight: '900',
		lineHeight: 200,
	},
	heroUnit: {
		color: colors.primary,
		fontSize: 80,
		fontWeight: '700',
	},
	statRow: {
		flexDirection: 'row',
		gap: 24,
		width: '100%',
		marginBottom: 80,
	},
	statBlock: {
		flex: 1,
		paddingVertical: 24,
		paddingHorizontal: 28,
		borderWidth: 2,
		borderColor: 'rgba(255,255,255,0.18)',
		borderRadius: 24,
		backgroundColor: 'rgba(0,0,0,0.0)',
	},
	statValueRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: 8,
		marginBottom: 8,
	},
	statValue: {
		color: colors.text,
		fontSize: 48,
		fontWeight: '800',
		flexShrink: 1,
	},
	statTrend: {
		fontSize: 24,
		fontWeight: '700',
		marginTop: 8,
	},
	statLabel: {
		color: '#9a9a9a',
		fontSize: 26,
		fontWeight: '500',
	},
	tilesArea: {
		flex: 1,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	footer: {
		marginTop: 32,
	},
	footerText: {
		color: 'rgba(255,255,255,0.55)',
		fontSize: 24,
		letterSpacing: 2,
		fontWeight: '600',
	},
});
