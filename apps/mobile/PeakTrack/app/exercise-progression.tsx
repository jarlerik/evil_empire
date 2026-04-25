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
import { format } from 'date-fns';
import {
	fetchExerciseProgressionData,
	ExerciseProgressionRow,
} from '@evil-empire/peaktrack-services';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { colors } from '../styles/common';
import { LoadScreen } from './components/LoadScreen';
import { NavigationBar } from '../components/NavigationBar';
import { VolumeStatCardRow } from '../components/VolumeStatCardRow';
import {
	buildExerciseSessionLayout,
	ExerciseSessionLayout,
} from '../lib/exerciseProgressionLayout';
import type { TileColor } from '../lib/progressionLayoutCore';
import { bucketByDate, type VolumePoint } from '../lib/volumeStats';

const MIN_SESSION_WIDTH = 44;
const COLUMN_GAP = 8;
const TILE_SIZE = 12;
const TILE_GAP = 2;
const TREND_HEIGHT = 140;
const TREND_TOP_PADDING = 12;
const TREND_BOTTOM_PADDING = 12;
const SET_COLUMN_GAP = 2;

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
			return { backgroundColor: '#2a2a2a', opacity: 1 };
	}
}

function maxStackHeightTiles(layouts: ExerciseSessionLayout[]): number {
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

function layoutGeometry(layouts: ExerciseSessionLayout[]): {
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

function formatDayLabel(iso: string): string {
	try {
		return format(new Date(iso), 'MMM d');
	} catch {
		return iso;
	}
}

export default function ExerciseProgression() {
	const { user } = useAuth();
	const { settings } = useUserSettings();
	const weightUnit = settings?.weight_unit || 'kg';
	const params = useLocalSearchParams<{ exerciseName: string }>();
	const exerciseName =
		typeof params.exerciseName === 'string' ? params.exerciseName : null;

	const [rows, setRows] = useState<ExerciseProgressionRow[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!user || !exerciseName) {
			return;
		}
		setLoading(true);
		setError(null);
		const { data, error: err } = await fetchExerciseProgressionData(
			user.id,
			exerciseName,
		);
		if (err) {
			setError(err);
			setRows(null);
		} else {
			setRows(data ?? []);
		}
		setLoading(false);
	}, [user, exerciseName]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const layouts = useMemo<ExerciseSessionLayout[]>(() => {
		if (!rows) {
			return [];
		}
		const out: ExerciseSessionLayout[] = [];
		for (const row of rows) {
			const layout = buildExerciseSessionLayout({ row, weightUnit });
			if (layout) {
				out.push(layout);
			}
		}
		return out;
	}, [rows, weightUnit]);

	const maxVolume = useMemo(() => {
		let max = 0;
		for (const l of layouts) {
			if (l.volume > max) {
				max = l.volume;
			}
		}
		return max;
	}, [layouts]);

	const hasAnyCompound = useMemo(
		() => layouts.some(l => l.isCompound),
		[layouts],
	);

	const volumePoints = useMemo<VolumePoint[]>(
		() =>
			bucketByDate(
				layouts.map(l => ({ date: l.workoutDate, volume: l.volume })),
			),
		[layouts],
	);

	if (loading) {
		return (
			<View style={styles.flex}>
				<LoadScreen />
				<NavigationBar />
			</View>
		);
	}

	if (error || !exerciseName) {
		return (
			<View style={styles.flex}>
				<View style={styles.centerContainer}>
					<Text style={styles.errorText}>{error ?? 'Missing exercise name'}</Text>
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
			if (maxVolume === 0) {
				return null;
			}
			const yNorm = 1 - l.volume / maxVolume;
			const y =
				TREND_TOP_PADDING +
				yNorm * (TREND_HEIGHT - TREND_TOP_PADDING - TREND_BOTTOM_PADDING);
			return { x: sessionCenters[i] ?? 0, y };
		})
		.filter((p): p is { x: number; y: number } => p !== null);

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
				</View>
			</View>

			{layouts.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>
						No recorded sessions for {exerciseName} yet.
					</Text>
				</View>
			) : (
				<>
				<VolumeStatCardRow points={volumePoints} unit={weightUnit} />
				<ScrollView
					horizontal
					style={styles.chartScroll}
					contentContainerStyle={styles.chartContent}
					showsHorizontalScrollIndicator={true}
				>
					<View style={[styles.chartInner, { width: chartWidth }]}>
						<View
							style={[styles.trendArea, { width: chartWidth, height: TREND_HEIGHT }]}
						>
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
											fill={colors.primary}
											stroke={colors.primary}
											strokeWidth={1}
										/>
									))}
								</Svg>
							) : null}
						</View>

						<View style={[styles.volumeRow, { width: chartWidth, gap: COLUMN_GAP }]}>
							{layouts.map(l => (
								<View key={l.logId} style={[styles.volumeCell, { width: uniformWidth }]}>
									<Text style={styles.volumeText}>{l.volume}</Text>
								</View>
							))}
						</View>

						<View
							style={[
								styles.columnsRow,
								{ width: chartWidth, height: stackHeight, gap: COLUMN_GAP },
							]}
						>
							{layouts.map(l => (
								<SessionStack
									key={l.logId}
									layout={l}
									width={uniformWidth}
									totalHeight={stackHeight}
								/>
							))}
						</View>

						<View style={[styles.labelRow, { width: chartWidth, gap: COLUMN_GAP }]}>
							{layouts.map(l => (
								<View key={l.logId} style={[styles.labelCell, { width: uniformWidth }]}>
									{l.headerWeightLabel ? (
										<Text style={styles.weightLabel}>{l.headerWeightLabel}</Text>
									) : null}
									<Text style={styles.dayLabel}>{formatDayLabel(l.workoutDate)}</Text>
								</View>
							))}
						</View>
					</View>
				</ScrollView>
				</>
			)}

			{hasAnyCompound ? (
				<View style={styles.legend}>
					<LegendDot color={colors.primary} label="Analysed segment" />
					<LegendDot color={colors.primary} opacity={0.5} label="Other segments" />
				</View>
			) : null}
			<NavigationBar />
		</View>
	);
}

interface SessionStackProps {
	layout: ExerciseSessionLayout;
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
				{ width, height: totalHeight, paddingLeft: leftPad, gap: SET_COLUMN_GAP },
			]}
		>
			{layout.columns.map((col, idx) => (
				<View
					key={idx}
					style={[
						styles.setColumn,
						{ width: TILE_SIZE, height: totalHeight, gap: TILE_GAP },
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
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	emptyText: {
		color: colors.textMuted,
		fontSize: 14,
		textAlign: 'center',
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
	trendArea: {},
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
