import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import React from 'react';
import { router } from 'expo-router';
import { useUserSettings } from '../contexts/UserSettingsContext';

export default function ExerciseInputHelp() {
	const { settings } = useUserSettings();
	const u = settings?.weight_unit || 'kg';

	return (
		<ScrollView
			contentContainerStyle={{ flexGrow: 1 }}
			style={styles.container}
		>
			<View style={styles.content}>
				<View style={styles.headerRow}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backButtonText}>←</Text>
					</Pressable>
					<Text style={styles.title}>Exercise input options and examples</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Basic Format</Text>
					<Text style={styles.description}>
						Standard format for sets, reps, and weight. Weight unit is required ({u}, %, or RIR).
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 6@80{u}</Text>
						<Text style={styles.example}>4 x 6@80%</Text>
						<Text style={styles.example}>4 x 6@1RIR</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps @weight ({u}), sets x reps @percentage (%), or sets x reps @RIR. The unit ({u}, %, or RIR) is required.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Compound Exercises</Text>
					<Text style={styles.description}>
						For exercises with multiple rep parts, such as complex movements. Weight unit is required.
					</Text>
					<Text style={styles.description}>Example: Power snatch + Snatch 4 x 2 + 2@50{u}</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 2 + 2@50{u}</Text>
						<Text style={styles.example}>4 x 2 + 2@60%</Text>
						<Text style={styles.example}>3 x 1 + 3@75{u}</Text>
						<Text style={styles.example}>4 x 1 + 2 + 2 + 2@40{u}</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps1 + reps2 (+ reps3...) @weight ({u}) or @percentage (%). The total reps are calculated automatically. Unit is required.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Multiple Weights</Text>
					<Text style={styles.description}>
						Specify different weights for each set. Unit ({u} or %) must be at the end.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>3 x 1@55 60 65{u}</Text>
						<Text style={styles.example}>3 x 1@60 70 75%</Text>
						<Text style={styles.example}>4 x 5@100 110 120 130{u}</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps @weight1 weight2 weight3...{u} or ...%. The number of weights must match the number of sets. Unit ({u} or %) must be at the end.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Wave Exercises</Text>
					<Text style={styles.description}>
						Decreasing reps across sets with the same weight. Unit ({u} or %) is required.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>3-2-1-3-2-1 50 55 60 55 65 70{u}</Text>
						<Text style={styles.example}>3-2-1-2-2-1 60 70 80 65 75 85%</Text>
					</View>
					<Text style={styles.note}>
						Format: reps1-reps2-reps3... weight ({u}) or weight (%). Each number represents reps for one set. Creates multiple phases automatically. Unit is required.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Percentage-Based Weight</Text>
					<Text style={styles.description}>
						Use a percentage of your 1RM. Requires a 1RM to be set in Repetition Maximums. The % unit is required.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 5@80%</Text>
						<Text style={styles.example}>3 x 1 + 1 + 1@60%</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps@percentage (%). The app will look up your 1RM for the exercise and calculate the weight. Works with compound exercises too. The % unit is required.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Percentage Range</Text>
					<Text style={styles.description}>
						Use a range of percentages of your 1RM.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 5@80-85%</Text>
						<Text style={styles.example}>3 x 5@85-89%</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps@min%-max%. The minimum percentage must be less than or equal to the maximum. Percentages must be between 0 and 100.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Weight Range</Text>
					<Text style={styles.description}>
						Specify a range of absolute weights. The {u} unit is required.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 5@85-89{u}</Text>
						<Text style={styles.example}>3 x 3@50-55{u}</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps@min-max{u}. The minimum weight must be less than or equal to the maximum. The {u} unit is required.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Circuit Format</Text>
					<Text style={styles.description}>
						Multiple exercises performed in sequence.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>2 x 10/10 banded side step, 10 banded skated walk forward...</Text>
						<Text style={styles.example}>3 sets of 10 push-ups, 15 squats</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x exercise1, exercise2... or sets sets of exercise1, exercise2... Each exercise can include reps (e.g., "10/10" or "10") followed by the exercise name.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>RM Build</Text>
					<Text style={styles.description}>
						Build up to a target repetition maximum.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>Build to 8RM</Text>
						<Text style={styles.example}>build to 5rm</Text>
					</View>
					<Text style={styles.note}>
						Format: Build to XRM (case insensitive). Used for progressive loading to find your repetition maximum.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>RIR (Reps in Reserve)</Text>
					<Text style={styles.description}>
						Specify target reps in reserve. Can be used as a unit after weight or as a standalone format.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 6@1RIR</Text>
						<Text style={styles.example}>4 x 6 1RIR</Text>
						<Text style={styles.example}>4 x 8 2-3RIR</Text>
					</View>
					<Text style={styles.note}>
						Format: sets x reps@RIRRIR (as unit) or sets x reps, RIR / sets x reps RIR (standalone). Can specify a range (e.g., "2-3RIR") or single value (e.g., "1RIR"). When used as a unit, it follows the weight directly (e.g., "@1RIR").
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Rest Time</Text>
					<Text style={styles.description}>
						Add rest time between sets to any format. Rest time unit is mandatory.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 3@50{u} 120s</Text>
						<Text style={styles.example}>4 x 3@50% 2min</Text>
						<Text style={styles.example}>3 x 5 @80% 90s</Text>
						<Text style={styles.example}>4 x 3 @50{u} 2m</Text>
					</View>
					<Text style={styles.note}>
						Format: ...rest time. Add rest time at the end using "s" or "sec" for seconds, or "m", "min", or "minute" for minutes. Examples: "120s" (120 seconds), "2m" or "2min" (2 minutes = 120 seconds). The unit is mandatory.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Combining Formats</Text>
					<Text style={styles.description}>
						Many formats can be combined together.
					</Text>
					<View style={styles.exampleContainer}>
						<Text style={styles.example}>4 x 1 + 2 + 2 + 2@60% 120s</Text>
						<Text style={styles.example}>2x 10, 2-3RIR 180s</Text>
						<Text style={styles.example}>3-2-1-1-1 65 90s</Text>
					</View>
					<Text style={styles.note}>
						You can combine formats like compound exercises with percentages, RIR with rest time, wave exercises with rest time, etc.
					</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Tips</Text>
					<Text style={styles.description}>
						• Weight unit is always required: {u}, %, or RIR{'\n'}
						• Extra spaces are automatically handled{'\n'}
						• Case doesn't matter (e.g., "{u.toUpperCase()}", "{u}" all work){'\n'}
						• Decimal weights are supported (e.g., 75.5{u}){'\n'}
						• For multiple weights, the unit goes at the end (e.g., "3 x 1@55 60 65{u}"){'\n'}
						• For percentage-based formats, make sure you have a 1RM set in Repetition Maximums{'\n'}
						• The app will try to match compound exercise names with existing RMs (e.g., "Muscle clean + Push press" will look for "Clean" in your RMs)
					</Text>
				</View>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	content: {
		flex: 1,
		padding: 20,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 20,
		marginBottom: 30,
	},
	backButton: {
		marginRight: 12,
	},
	backButtonText: {
		color: '#fff',
		fontSize: 24,
	},
	title: {
		color: '#c65d24',
		textTransform: 'uppercase',
		fontSize: 32,
		fontWeight: 'bold',
		flex: 1,
	},
	section: {
		marginBottom: 30,
	},
	sectionTitle: {
		color: '#fff',
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	description: {
		color: '#ccc',
		fontSize: 16,
		marginBottom: 12,
		lineHeight: 22,
	},
	exampleContainer: {
		backgroundColor: '#222',
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
	},
	example: {
		color: '#c65d24',
		fontSize: 16,
		fontFamily: 'monospace',
		marginBottom: 4,
	},
	note: {
		color: '#999',
		fontSize: 14,
		lineHeight: 20,
		fontStyle: 'italic',
	},
});
