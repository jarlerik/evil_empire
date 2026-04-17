import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import { commonStyles, colors } from '../styles/common';
import { NavigationBar } from '../components/NavigationBar';
import { LoadScreen } from './components/LoadScreen';
import { Button } from '../components/Button';

const statusLabels: Record<string, string> = {
	draft: 'Draft',
	active: 'Active',
	archived: 'Archived',
};

export default function Programs() {
	const { user, loading: authLoading } = useAuth();
	const { programs, loading } = usePrograms();

	useEffect(() => {
		if (!authLoading && !user) {
			router.replace('/(auth)/sign-in');
		}
	}, [user, authLoading]);

	if (authLoading || loading) {
		return (
			<View style={styles.flex}>
				<LoadScreen />
				<NavigationBar />
			</View>
		);
	}

	return (
		<View style={styles.flex}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={commonStyles.container}>
					<View style={[commonStyles.headerRow, styles.headerRow]}>
						<Text style={commonStyles.title}>Programs</Text>
					</View>

					{programs.length === 0 ? (
						<View style={styles.emptyState}>
							<Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
							<Text style={styles.emptyText}>
								No programs yet.
							</Text>
							<Text style={styles.emptySubtext}>
								Build a multi-week block and assign it to a start week.
							</Text>
						</View>
					) : (
						<View style={styles.list}>
							{programs.map(p => {
								// Hide duration on drafts — it's a placeholder until the
								// user saves a plan, at which point it becomes the parsed
								// week count.
								const subtitle = [
									p.status === 'draft'
										? null
										: `${p.duration_weeks} week${p.duration_weeks === 1 ? '' : 's'}`,
									p.start_iso_year != null && p.start_iso_week != null
										? `Week ${p.start_iso_week}, ${p.start_iso_year}`
										: null,
									statusLabels[p.status],
								]
									.filter(Boolean)
									.join(' · ');

								return (
									<Pressable
										key={p.id}
										onPress={() =>
											router.push({ pathname: '/program-detail', params: { programId: p.id } })
										}
										style={styles.card}
										accessibilityRole="button"
										accessibilityLabel={`Open program ${p.name}`}
									>
										<View style={styles.cardRow}>
											<View style={styles.cardBody}>
												<Text style={styles.cardTitle}>{p.name}</Text>
												<Text style={styles.cardSubtitle}>{subtitle}</Text>
												{p.description ? (
													<Text style={styles.cardDesc} numberOfLines={2}>
														{p.description}
													</Text>
												) : null}
											</View>
											<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
										</View>
									</Pressable>
								);
							})}
						</View>
					)}

					<View style={styles.cta}>
						<Button
							title="+ New program"
							onPress={() => router.push('/create-program')}
						/>
					</View>
				</View>
			</ScrollView>
			<NavigationBar />
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	scrollContent: { flexGrow: 1 },
	headerRow: {
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	emptyState: {
		alignItems: 'center',
		marginTop: 60,
		paddingHorizontal: 20,
	},
	emptyText: {
		color: colors.text,
		fontSize: 18,
		fontWeight: '600',
		marginTop: 12,
	},
	emptySubtext: {
		color: colors.textMuted,
		fontSize: 14,
		textAlign: 'center',
		marginTop: 8,
	},
	list: {
		gap: 12,
	},
	card: {
		backgroundColor: colors.backgroundCard,
		borderRadius: 8,
		padding: 16,
		borderWidth: 1,
		borderColor: '#222',
	},
	cardRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	cardBody: {
		flex: 1,
	},
	cardTitle: {
		color: colors.text,
		fontSize: 18,
		fontWeight: '600',
	},
	cardSubtitle: {
		color: colors.primary,
		fontSize: 13,
		marginTop: 4,
	},
	cardDesc: {
		color: colors.textMuted,
		fontSize: 13,
		marginTop: 6,
	},
	cta: {
		marginTop: 24,
	},
});
