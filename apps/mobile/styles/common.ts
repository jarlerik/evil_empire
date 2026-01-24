import { StyleSheet } from 'react-native';

/**
 * Common colors used throughout the app
 */
export const colors = {
	background: '#171717',
	backgroundDark: '#000',
	backgroundCard: '#111',
	backgroundInput: '#262626',
	backgroundInputAlt: '#222',
	primary: '#c65d24',
	text: '#fff',
	textMuted: '#666',
	textSecondary: '#666666',
};

/**
 * Common styles shared across multiple screens
 */
export const commonStyles = StyleSheet.create({
	/**
	 * Standard screen container with dark background
	 */
	container: {
		flex: 1,
		backgroundColor: colors.background,
		padding: 20,
	},

	/**
	 * Header row with back button and title
	 * Override marginBottom if needed (default: 30)
	 */
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 20,
		marginBottom: 30,
	},

	/**
	 * Back button container
	 */
	backButton: {
		marginRight: 12,
	},

	/**
	 * Back button text (arrow)
	 */
	backButtonText: {
		color: colors.text,
		fontSize: 24,
	},

	/**
	 * Screen title in primary color
	 */
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		color: colors.primary,
		textTransform: 'uppercase',
	},

	/**
	 * Title that takes remaining space (with flex: 1)
	 */
	titleFlex: {
		fontSize: 32,
		fontWeight: 'bold',
		color: colors.primary,
		textTransform: 'uppercase',
		flex: 1,
	},

	/**
	 * Section subtitle
	 */
	subtitle: {
		fontSize: 18,
		color: colors.text,
		marginTop: 20,
		marginBottom: 10,
	},

	/**
	 * Standard text input styling
	 */
	input: {
		backgroundColor: colors.backgroundInput,
		color: colors.text,
		padding: 15,
		borderRadius: 8,
		fontSize: 16,
		marginBottom: 20,
	},
});
