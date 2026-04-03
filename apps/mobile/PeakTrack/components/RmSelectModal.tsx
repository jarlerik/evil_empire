import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { RmMatch } from '../hooks/useRmLookup';

interface RmSelectModalProps {
	visible: boolean;
	onClose: () => void;
	onSelect: (match: RmMatch) => void;
	onAddNew: () => void;
	matches: RmMatch[];
	exerciseName: string;
	unit: string;
}

export function RmSelectModal({
	visible,
	onClose,
	onSelect,
	onAddNew,
	matches,
	exerciseName,
	unit,
}: RmSelectModalProps) {
	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<View style={styles.modalContainer}>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Select 1RM</Text>
						<Pressable onPress={onClose} style={styles.closeButton}>
							<Text style={styles.closeButtonText}>×</Text>
						</Pressable>
					</View>

					<Text style={styles.infoText}>
						No exact 1RM found for "{exerciseName}". Use one of these similar exercises, or add a new 1RM.
					</Text>

					<View style={styles.matchList}>
						{matches.map((match) => (
							<Pressable
								key={match.exerciseName}
								style={styles.matchItem}
								onPress={() => onSelect(match)}
							>
								<Text style={styles.matchName}>{match.exerciseName}</Text>
								<Text style={styles.matchWeight}>{match.weight} {unit}</Text>
							</Pressable>
						))}
					</View>

					<Pressable style={styles.addNewButton} onPress={onAddNew}>
						<Text style={styles.addNewButtonText}>Add new 1RM</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
	},
	modalContent: {
		backgroundColor: '#1a1a1a',
		borderRadius: 12,
		width: '90%',
		maxWidth: 400,
		padding: 20,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	modalTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#fff',
	},
	closeButton: {
		padding: 4,
	},
	closeButtonText: {
		color: '#fff',
		fontSize: 28,
	},
	infoText: {
		color: '#999',
		fontSize: 14,
		lineHeight: 20,
		marginBottom: 16,
	},
	matchList: {
		gap: 8,
		marginBottom: 16,
	},
	matchItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#222',
		padding: 15,
		borderRadius: 8,
	},
	matchName: {
		color: '#fff',
		fontSize: 16,
	},
	matchWeight: {
		color: '#C65D24',
		fontSize: 16,
		fontWeight: '600',
	},
	addNewButton: {
		backgroundColor: '#333',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	addNewButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
});
