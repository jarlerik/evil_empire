import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useOnboarding } from '../contexts/OnboardingContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CoachMark() {
	const { currentStep, steps, nextStep, skipOnboarding, layouts } = useOnboarding();
	const pathname = usePathname();

	if (currentStep === null) {return null;}

	const step = steps[currentStep];
	if (!step) {return null;}

	// Only show coach mark if current step targets this screen
	if (step.screen !== pathname) {return null;}

	const layout = layouts[step.targetId];
	const tooltipPosition = getTooltipPosition(layout);

	return (
		<Modal transparent visible animationType="fade">
			<View style={styles.overlay}>
				{layout && (
					<View
						style={[
							styles.highlight,
							{
								top: layout.y - 4,
								left: layout.x - 4,
								width: layout.width + 8,
								height: layout.height + 8,
							},
						]}
					/>
				)}

				<View style={[styles.tooltip, tooltipPosition]}>
					<Text style={styles.title}>{step.title}</Text>
					<Text style={styles.message}>{step.message}</Text>

					<View style={styles.footer}>
						<Pressable onPress={skipOnboarding}>
							<Text style={styles.skipText}>Skip tour</Text>
						</Pressable>

						<View style={styles.rightFooter}>
							<Text style={styles.stepIndicator}>
								{currentStep + 1} of {steps.length}
							</Text>
							<Pressable style={styles.nextButton} onPress={nextStep}>
								<Text style={styles.nextButtonText}>
									{currentStep === steps.length - 1 ? 'Done' : 'Next'}
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function getTooltipPosition(layout: { x: number; y: number; width: number; height: number } | undefined) {
	const tooltipHeight = 160;
	const margin = 12;
	const fallback = { top: SCREEN_HEIGHT / 2 - 80, left: 20, right: 20 };

	if (!layout) {
		return fallback;
	}

	// If the target is off-screen (e.g., inside a ScrollView beyond viewport), use centered fallback
	if (layout.y + layout.height < 0 || layout.y > SCREEN_HEIGHT) {
		return fallback;
	}

	const spaceBelow = SCREEN_HEIGHT - (layout.y + layout.height);
	const showBelow = spaceBelow > tooltipHeight + margin;
	let top = showBelow ? layout.y + layout.height + margin : layout.y - tooltipHeight - margin;

	// Clamp to stay within screen bounds
	top = Math.max(margin, Math.min(top, SCREEN_HEIGHT - tooltipHeight - margin));

	return { top, left: 20, right: 20 };
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.7)',
	},
	highlight: {
		position: 'absolute',
		borderRadius: 8,
		borderWidth: 2,
		borderColor: '#C65D24',
		backgroundColor: 'rgba(198,93,36,0.1)',
	},
	tooltip: {
		position: 'absolute',
		backgroundColor: '#262626',
		borderRadius: 12,
		padding: 20,
	},
	title: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 8,
	},
	message: {
		color: '#ccc',
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 16,
	},
	footer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	skipText: {
		color: '#666',
		fontSize: 14,
	},
	rightFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	stepIndicator: {
		color: '#666',
		fontSize: 12,
	},
	nextButton: {
		backgroundColor: '#C65D24',
		borderRadius: 8,
		paddingHorizontal: 20,
		paddingVertical: 10,
	},
	nextButtonText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: '600',
	},
});
