import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Button } from './Button';

interface WorkoutRatingModalProps {
	visible: boolean;
	onSave: (rating: number) => void;
	onSkip: () => void;
}

export function WorkoutRatingModal({ visible, onSave, onSkip }: WorkoutRatingModalProps) {
	const [selectedRating, setSelectedRating] = useState<number | null>(null);

	const handleSave = () => {
		if (selectedRating !== null) {
			onSave(selectedRating);
			setSelectedRating(null);
		}
	};

	const handleSkip = () => {
		setSelectedRating(null);
		onSkip();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={handleSkip}
		>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<Text style={styles.title}>How was your workout?</Text>

					<View style={styles.ratingRow}>
						{[1, 2, 3, 4, 5].map((value) => (
							<Pressable
								key={value}
								onPress={() => setSelectedRating(value)}
								style={[
									styles.ratingCircle,
									selectedRating === value && styles.ratingCircleSelected,
								]}
							>
								<Text
									style={[
										styles.ratingText,
										selectedRating === value && styles.ratingTextSelected,
									]}
								>
									{value}
								</Text>
							</Pressable>
						))}
					</View>

					<View style={styles.labelsRow}>
						<Text style={styles.labelText}>Easy</Text>
						<Text style={styles.labelText}>Brutal</Text>
					</View>

					<View style={styles.buttonRow}>
						<Button
							title="Skip"
							variant="secondary"
							onPress={handleSkip}
							style={styles.button}
						/>
						<Button
							title="Save"
							onPress={handleSave}
							disabled={selectedRating === null}
							style={styles.button}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		backgroundColor: '#171717',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 20,
	},
	title: {
		color: '#C65D24',
		fontSize: 20,
		fontWeight: 'bold',
		textTransform: 'uppercase',
		textAlign: 'center',
		marginBottom: 24,
	},
	ratingRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 12,
		marginBottom: 8,
	},
	ratingCircle: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: '#262626',
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 2,
		borderColor: '#333',
	},
	ratingCircleSelected: {
		backgroundColor: '#C65D24',
		borderColor: '#C65D24',
	},
	ratingText: {
		color: '#888',
		fontSize: 18,
		fontWeight: 'bold',
	},
	ratingTextSelected: {
		color: '#fff',
	},
	labelsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 8,
		marginBottom: 24,
	},
	labelText: {
		color: '#666',
		fontSize: 12,
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
	},
	button: {
		flex: 1,
	},
});
