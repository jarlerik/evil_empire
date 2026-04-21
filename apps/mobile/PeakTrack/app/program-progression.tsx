import { useCallback, useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
	fetchProgramProgressionData,
	ProgramProgressionData,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../styles/common';
import { LoadScreen } from './components/LoadScreen';
import { NavigationBar } from '../components/NavigationBar';
import { buildSessionLayout, SessionLayout, TileColor } from '../lib/progressionLayout';

const MIN_SESSION_WIDTH = 44;
const COLUMN_GAP = 8;
const TILE_SIZE = 12;
const TILE_GAP = 2;
const TREND_HEIGHT = 140;
const TREND_TOP_PADDING = 12;
const TREND_BOTTOM_PADDING = 12;
const SET_COLUMN_GAP = 2;

const NEUTRAL = '#2a2a2a';

function tileBackground(color: TileColor): { backgroundColor: string; opacity: number } {
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
			return { backgroundColor: NEUTRAL, opacity: 1 };
	}
}

function maxStackHeightTiles(layouts: SessionLayout[]): number {
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

function intrinsicSessionWidth(setCount: number): number {
	if (setCount <= 0) {
		return MIN_SESSION_WIDTH;
	}
	const stackWidth = setCount * TILE_SIZE + Math.max(0, setCount - 1) * SET_COLUMN_GAP;
	return Math.max(MIN_SESSION_WIDTH, stackWidth);
}

function layoutGeometry(layouts: SessionLayout[]): {
	uniformWidth: number;
	centers: number[];
	totalWidth: number;
} {
	let uniformWidth = MIN_SESSION_WIDTH;
	for (const l of layouts) {
		const w = intrinsicSessionWidth(l.columns.length);
		if (w > uniformWidth) {
			uniformWidth = w;
		}
	}
	const centers: number[] = [];
	let x = 0;
	for (let i = 0; i < layouts.length; i += 1) {
		centers.push(x + uniformWidth / 2);
		x += uniformWidth + (i < layouts.length - 1 ? COLUMN_GAP : 0);
	}
	return { uniformWidth, centers, totalWidth: x };
}

export default function ProgramProgression() {
	const { user } = useAuth();
	const params = useLocalSearchParams<{
		programId: string;
		exerciseName: string;
	}>();
	const programId = typeof params.programId === 'string' ? params.programId : null;
	const exerciseName =
		typeof params.exerciseName === 'string' ? params.exerciseName : null;

	const [data, setData] = useState<ProgramProgressionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!programId || !exerciseName || !user) {
			return;
		}
		setLoading(true);
		setError(null);
		const { data: result, error: err } = await fetchProgramProgressionData(
			programId,
			exerciseName,
		);
		if (err) {
			setError(err);
			setData(null);
		} else {
			setData(result);
		}
		setLoading(false);
	}, [programId, exerciseName, user]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const layouts = useMemo<SessionLayout[]>(() => {
		if (!data) {
			return [];
		}
		return data.sessions.map(row =>
			buildSessionLayout({
				sessionId: row.session.id,
				weekOffset: row.session.week_offset,
				dayOfWeek: row.session.day_of_week,
				prescribed: row.prescribed,
				performed: row.performedLog,
				programRms: data.programRms,
			}),
		);
	}, [data]);

	const maxVolume = useMemo(() => {
		let max = 0;
		for (const l of layouts) {
			const v = l.performedVolume ?? l.prescribedVolume ?? 0;
			if (v > max) {
				max = v;
			}
		}
		return max;
	}, [layouts]);

	if (loading) {
		return (
			<View style={styles.flex}>
				<LoadScreen />
				<NavigationBar />
			</View>
		);
	}

	if (error || !data) {
		return (
			<View style={styles.flex}>
				<View style={styles.centerContainer}>
					<Text style={styles.errorText}>{error ?? 'Failed to load progression'}</Text>
					<Pressable onPress={() => router.back()} style={styles.backInline}>
						<Ionicons name="chevron-back" size={20} color={colors.primary} />
						<Text style={styles.backInlineText}>Go back</Text>
					</Pressable>
				</View>
				<NavigationBar />
			</View>
		);
	}

	const { uniformWidth, centers: sessionCenters, totalWidth: chartWidth } =
		layoutGeometry(layouts);
	const stackHeight = maxStackHeightTiles(layouts) * (TILE_SIZE + TILE_GAP);
	const trendPoints = layouts
		.map((l, i) => {
			const volume = l.performedVolume ?? l.prescribedVolume;
			if (volume == null || maxVolume === 0) {
				return null;
			}
			const yNorm = 1 - volume / maxVolume;
			const y = TREND_TOP_PADDING + yNorm * (TREND_HEIGHT - TREND_TOP_PADDING - TREND_BOTTOM_PADDING);
			return { x: sessionCenters[i] ?? 0, y, performed: l.hasPerformed };
		})
		.filter((p): p is { x: number; y: number; performed: boolean } => p !== null);

	return (
		<View style={styles.flex}>
			<View style={styles.headerRow}>
				<Pressable
					onPress={() => router.back()}
					style={styles.backButton}
					accessibilityLabel="Back"
				>
					<Ionicons name="chevron-back" size={24} color={colors.text} />
				</Pressable>
				<View style={styles.titleBlock}>
					<Text style={styles.title} numberOfLines={1}>
						{exerciseName}
					</Text>
					<Text style={styles.subtitle} numberOfLines={1}>
						{data.program.name}
					</Text>
				</View>
			</View>

			{layouts.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>No sessions for this exercise yet.</Text>
				</View>
			) : (
				<ScrollView
					horizontal
					style={styles.chartScroll}
					contentContainerStyle={styles.chartContent}
					showsHorizontalScrollIndicator={true}
				>
					<View style={[styles.chartInner, { width: chartWidth }]}>
						<View style={[styles.trendArea, { width: chartWidth, height: TREND_HEIGHT }]}>
							{trendPoints.length > 1 ? (
								<Svg width={chartWidth} height={TREND_HEIGHT}>
									<Polyline
										points={trendPoints.map(p => `${p.x},${p.y}`).join(' ')}
										fill="none"
										stroke={colors.primary}
										strokeWidth={2}
									/>
									{trendPoints.map((p, i) => (
										<Circle
											key={i}
											cx={p.x}
											cy={p.y}
											r={3}
											fill={p.performed ? colors.primary : NEUTRAL}
											stroke={colors.primary}
											strokeWidth={1}
										/>
									))}
								</Svg>
							) : null}
						</View>

						<View style={[styles.volumeRow, { width: chartWidth, gap: COLUMN_GAP }]}>
							{layouts.map(l => {
								const volume = l.performedVolume ?? l.prescribedVolume;
								return (
									<View
										key={l.sessionId}
										style={[styles.volumeCell, { width: uniformWidth }]}
									>
										<Text
											style={[
												styles.volumeText,
												!l.hasPerformed && styles.volumeTextDim,
											]}
										>
											{volume != null ? volume : '—'}
										</Text>
									</View>
								);
							})}
						</View>

						<View
							style={[
								styles.columnsRow,
								{ width: chartWidth, height: stackHeight, gap: COLUMN_GAP },
							]}
						>
							{layouts.map(l => (
								<SessionStack
									key={l.sessionId}
									layout={l}
									width={uniformWidth}
									totalHeight={stackHeight}
								/>
							))}
						</View>

						<View style={[styles.labelRow, { width: chartWidth, gap: COLUMN_GAP }]}>
							{layouts.map(l => (
								<View
									key={l.sessionId}
									style={[styles.labelCell, { width: uniformWidth }]}
								>
									{l.headerWeightLabel ? (
										<Text style={styles.weightLabel}>{l.headerWeightLabel}</Text>
									) : null}
									<Text style={styles.dayLabel}>{l.dayLabel}</Text>
									<Text style={styles.weekLabel}>W{l.weekOffset + 1}</Text>
								</View>
							))}
						</View>
					</View>
				</ScrollView>
			)}

			<View style={styles.legend}>
				<LegendDot color={colors.primary} label="Performed" />
				<LegendDot color={colors.primary} opacity={0.2} label="Not performed" />
			</View>
			<NavigationBar />
		</View>
	);
}

interface SessionStackProps {
	layout: SessionLayout;
	width: number;
	totalHeight: number;
}

function SessionStack({ layout, width, totalHeight }: SessionStackProps) {
	const intrinsic = intrinsicSessionWidth(layout.columns.length);
	const leftPad = Math.max(0, Math.round((width - intrinsic) / 2));
	return (
		<View
			style={[
				styles.sessionStack,
				{
					width,
					height: totalHeight,
					paddingLeft: leftPad,
					gap: SET_COLUMN_GAP,
				},
			]}
		>
			{layout.columns.map((col, idx) => (
				<View
					key={idx}
					style={[
						styles.setColumn,
						{
							width: TILE_SIZE,
							height: totalHeight,
							gap: TILE_GAP,
						},
					]}
				>
					{col.tiles.map((tile, tIdx) => {
						const bg = tileBackground(tile);
						return (
							<View
								key={tIdx}
								style={[
									styles.tile,
									{
										width: TILE_SIZE,
										height: TILE_SIZE,
										backgroundColor: bg.backgroundColor,
										opacity: bg.opacity,
									},
								]}
							/>
						);
					})}
					{col.weightLabel ? (
						<Text style={styles.columnWeightLabel} numberOfLines={1}>
							{col.weightLabel}
						</Text>
					) : null}
				</View>
			))}
		</View>
	);
}

function LegendDot({
	color,
	label,
	opacity = 1,
}: {
	color: string;
	label: string;
	opacity?: number;
}) {
	return (
		<View style={styles.legendItem}>
			<View style={[styles.legendDot, { backgroundColor: color, opacity }]} />
			<Text style={styles.legendText}>{label}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
		backgroundColor: colors.background,
	},
	centerContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
		padding: 24,
	},
	errorText: {
		color: colors.error,
		fontSize: 15,
		marginBottom: 12,
	},
	backInline: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	backInlineText: {
		color: colors.primary,
		fontSize: 14,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 8,
		gap: 8,
	},
	backButton: {
		padding: 4,
	},
	titleBlock: {
		flex: 1,
	},
	title: {
		color: colors.primary,
		fontSize: 20,
		fontWeight: '700',
	},
	subtitle: {
		color: colors.textMuted,
		fontSize: 12,
		marginTop: 2,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyText: {
		color: colors.textMuted,
		fontSize: 14,
	},
	chartScroll: {
		flex: 1,
	},
	chartContent: {
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	chartInner: {
		flexDirection: 'column',
	},
	trendArea: {
		// Svg renders inside.
	},
	volumeRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		marginBottom: 6,
	},
	volumeCell: {
		alignItems: 'center',
	},
	volumeText: {
		color: colors.text,
		fontSize: 11,
		fontWeight: '600',
	},
	volumeTextDim: {
		color: colors.textMuted,
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
	tile: {},
	columnWeightLabel: {
		position: 'absolute',
		bottom: -14,
		left: -12,
		right: -12,
		textAlign: 'center',
		color: colors.textMuted,
		fontSize: 9,
	},
	labelRow: {
		flexDirection: 'row',
		marginTop: 8,
	},
	labelCell: {
		alignItems: 'center',
	},
	weightLabel: {
		color: colors.primary,
		fontSize: 10,
		marginBottom: 2,
	},
	dayLabel: {
		color: colors.text,
		fontSize: 11,
		fontWeight: '600',
	},
	weekLabel: {
		color: colors.textMuted,
		fontSize: 10,
		marginTop: 2,
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderTopWidth: 1,
		borderTopColor: '#1a1a1a',
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	legendDot: {
		width: 10,
		height: 10,
		borderRadius: 2,
	},
	legendText: {
		color: colors.textMuted,
		fontSize: 11,
	},
});
