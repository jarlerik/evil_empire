import { useCallback, useMemo, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
import { VolumeTiles } from '../components/VolumeTiles';
import {
	buildExerciseSessionLayout,
	ExerciseSessionLayout,
} from '@evil-empire/peaktrack-services';
import { bucketByDate, type VolumePoint } from '../lib/volumeStats';
import { ShareButton } from '../components/share/ShareButton';
import { useShareExerciseImage } from '../hooks/useShareExerciseImage';

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

	const share = useShareExerciseImage();

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
				{layouts.length > 0 && exerciseName ? (
					<ShareButton
						onPress={() =>
							share.share({ exerciseName, layouts, weightUnit })
						}
						disabled={share.capturing}
					/>
				) : null}
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
					<VolumeTiles layouts={layouts} />
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
			{share.OffscreenCard}
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
