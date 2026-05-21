import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { format } from 'date-fns';
import type { ExerciseSessionLayout, TileColor } from '@evil-empire/peaktrack-services';
import { colors } from '../styles/common';

export interface VolumeTilesDimensions {
	tileSize: number;
	tileGap: number;
	columnGap: number;
	setColumnGap: number;
	minSessionWidth: number;
	trendHeight: number;
	trendTopPadding: number;
	trendBottomPadding: number;
	weightLabelFontSize: number;
	dayLabelFontSize: number;
	volumeTextFontSize: number;
	trendStrokeWidth: number;
	trendDotRadius: number;
	labelRowMarginTop: number;
	volumeRowMarginBottom: number;
}

export const DEFAULT_VOLUME_TILES_DIMENSIONS: VolumeTilesDimensions = {
	tileSize: 12,
	tileGap: 2,
	columnGap: 8,
	setColumnGap: 2,
	minSessionWidth: 44,
	trendHeight: 140,
	trendTopPadding: 12,
	trendBottomPadding: 12,
	weightLabelFontSize: 10,
	dayLabelFontSize: 11,
	volumeTextFontSize: 11,
	trendStrokeWidth: 2,
	trendDotRadius: 3,
	labelRowMarginTop: 8,
	volumeRowMarginBottom: 6,
};

export function tileBackground(color: TileColor): { backgroundColor: string; opacity: number } {
	switch (color) {
		case 'bright':
		case 'dark':
			return { backgroundColor: colors.primary, opacity: 1 };
		case 'faded-bright':
		case 'faded-dark':
			return { backgroundColor: colors.primary, opacity: 0.5 };
		case 'dim':
			return { backgroundColor: colors.primary, opacity: 0.2 };
		case 'neutral':
		default:
			return { backgroundColor: '#2a2a2a', opacity: 1 };
	}
}

export function intrinsicSessionWidth(setCount: number, dims: VolumeTilesDimensions): number {
	if (setCount <= 0) {
		return dims.minSessionWidth;
	}
	const stackWidth = setCount * dims.tileSize + Math.max(0, setCount - 1) * dims.setColumnGap;
	return Math.max(dims.minSessionWidth, stackWidth);
}

export function maxStackHeightTiles(layouts: ExerciseSessionLayout[]): number {
	let max = 0;
	for (const l of layouts) {
		for (const col of l.columns) {
			if (col.tiles.length > max) {
				max = col.tiles.length;
			}
		}
	}
	return max;
}

export function layoutGeometry(
	layouts: ExerciseSessionLayout[],
	dims: VolumeTilesDimensions,
): {
	uniformWidth: number;
	centers: number[];
	totalWidth: number;
} {
	let uniformWidth = dims.minSessionWidth;
	for (const l of layouts) {
		const w = intrinsicSessionWidth(l.columns.length, dims);
		if (w > uniformWidth) {
			uniformWidth = w;
		}
	}
	const centers: number[] = [];
	let x = 0;
	for (let i = 0; i < layouts.length; i += 1) {
		centers.push(x + uniformWidth / 2);
		x += uniformWidth + (i < layouts.length - 1 ? dims.columnGap : 0);
	}
	return { uniformWidth, centers, totalWidth: x };
}

function formatDayLabel(iso: string): string {
	try {
		return format(new Date(iso), 'MMM d');
	} catch {
		return iso;
	}
}

interface VolumeTilesProps {
	layouts: ExerciseSessionLayout[];
	dimensions?: Partial<VolumeTilesDimensions>;
	showVolumeText?: boolean;
	showLabels?: boolean;
	showTrend?: boolean;
}

export function VolumeTiles({
	layouts,
	dimensions,
	showVolumeText = true,
	showLabels = true,
	showTrend = true,
}: VolumeTilesProps) {
	const dims: VolumeTilesDimensions = { ...DEFAULT_VOLUME_TILES_DIMENSIONS, ...dimensions };
	const { uniformWidth, centers, totalWidth } = layoutGeometry(layouts, dims);
	const stackHeight = maxStackHeightTiles(layouts) * (dims.tileSize + dims.tileGap);

	let maxVolume = 0;
	for (const l of layouts) {
		if (l.volume > maxVolume) {
			maxVolume = l.volume;
		}
	}

	const trendPoints = layouts
		.map((l, i) => {
			if (maxVolume === 0) {
				return null;
			}
			const yNorm = 1 - l.volume / maxVolume;
			const y =
				dims.trendTopPadding +
				yNorm * (dims.trendHeight - dims.trendTopPadding - dims.trendBottomPadding);
			return { x: centers[i] ?? 0, y };
		})
		.filter((p): p is { x: number; y: number } => p !== null);

	return (
		<View style={{ width: totalWidth }}>
			{showTrend && (
				<View style={{ width: totalWidth, height: dims.trendHeight }}>
					{trendPoints.length > 1 ? (
						<Svg width={totalWidth} height={dims.trendHeight}>
							<Polyline
								points={trendPoints.map(p => `${p.x},${p.y}`).join(' ')}
								fill="none"
								stroke={colors.primary}
								strokeWidth={dims.trendStrokeWidth}
							/>
							{trendPoints.map((p, i) => (
								<Circle
									key={i}
									cx={p.x}
									cy={p.y}
									r={dims.trendDotRadius}
									fill={colors.primary}
									stroke={colors.primary}
									strokeWidth={1}
								/>
							))}
						</Svg>
					) : null}
				</View>
			)}

			{showVolumeText && (
				<View
					style={[
						styles.volumeRow,
						{
							width: totalWidth,
							gap: dims.columnGap,
							marginBottom: dims.volumeRowMarginBottom,
						},
					]}
				>
					{layouts.map(l => (
						<View key={l.logId} style={[styles.volumeCell, { width: uniformWidth }]}>
							<Text style={[styles.volumeText, { fontSize: dims.volumeTextFontSize }]}>
								{l.volume}
							</Text>
						</View>
					))}
				</View>
			)}

			<View
				style={[
					styles.columnsRow,
					{ width: totalWidth, height: stackHeight, gap: dims.columnGap },
				]}
			>
				{layouts.map(l => (
					<SessionStack
						key={l.logId}
						layout={l}
						width={uniformWidth}
						totalHeight={stackHeight}
						dims={dims}
					/>
				))}
			</View>

			{showLabels && (
				<View
					style={[
						styles.labelRow,
						{
							width: totalWidth,
							gap: dims.columnGap,
							marginTop: dims.labelRowMarginTop,
						},
					]}
				>
					{layouts.map(l => (
						<View key={l.logId} style={[styles.labelCell, { width: uniformWidth }]}>
							{l.headerWeightLabel ? (
								<Text
									style={[styles.weightLabel, { fontSize: dims.weightLabelFontSize }]}
								>
									{l.headerWeightLabel}
								</Text>
							) : null}
							<Text style={[styles.dayLabel, { fontSize: dims.dayLabelFontSize }]}>
								{formatDayLabel(l.workoutDate)}
							</Text>
						</View>
					))}
				</View>
			)}
		</View>
	);
}

interface SessionStackProps {
	layout: ExerciseSessionLayout;
	width: number;
	totalHeight: number;
	dims: VolumeTilesDimensions;
}

function SessionStack({ layout, width, totalHeight, dims }: SessionStackProps) {
	const intrinsic = intrinsicSessionWidth(layout.columns.length, dims);
	const leftPad = Math.max(0, Math.round((width - intrinsic) / 2));
	return (
		<View
			style={[
				styles.sessionStack,
				{ width, height: totalHeight, paddingLeft: leftPad, gap: dims.setColumnGap },
			]}
		>
			{layout.columns.map((col, idx) => (
				<View
					key={idx}
					style={[
						styles.setColumn,
						{ width: dims.tileSize, height: totalHeight, gap: dims.tileGap },
					]}
				>
					{col.tiles.map((tile, tIdx) => {
						const bg = tileBackground(tile);
						return (
							<View
								key={tIdx}
								style={{
									width: dims.tileSize,
									height: dims.tileSize,
									backgroundColor: bg.backgroundColor,
									opacity: bg.opacity,
								}}
							/>
						);
					})}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	volumeRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
	},
	volumeCell: {
		alignItems: 'center',
	},
	volumeText: {
		color: colors.text,
		fontWeight: '600',
	},
	columnsRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
	},
	sessionStack: {
		flexDirection: 'row',
		alignItems: 'flex-end',
	},
	setColumn: {
		flexDirection: 'column-reverse',
		justifyContent: 'flex-start',
		alignItems: 'center',
	},
	labelRow: {
		flexDirection: 'row',
	},
	labelCell: {
		alignItems: 'center',
	},
	weightLabel: {
		color: colors.primary,
		marginBottom: 2,
	},
	dayLabel: {
		color: colors.text,
		fontWeight: '600',
	},
});
