import React from 'react';
import { Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WorkoutActionsModalProps {
	visible: boolean;
	workoutName: string;
	canStart: boolean;
	isMoveActive: boolean;
	onClose: () => void;
	onStart: () => void;
	onReschedule: () => void;
	onDelete: () => void;
}

export function WorkoutActionsModal({
	visible,
	workoutName,
	canStart,
	isMoveActive,
	onClose,
	onStart,
	onReschedule,
	onDelete,
}: WorkoutActionsModalProps) {
	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<Pressable style={styles.backdrop} onPress={onClose}>
				<Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
					<Text style={styles.title} numberOfLines={1}>
						{workoutName}
					</Text>

					{canStart && (
						<Pressable
							style={styles.actionRow}
							onPress={() => {
								onClose();
								onStart();
							}}
						>
							<Ionicons name="stopwatch-outline" size={22} color="#fff" />
							<Text style={styles.actionText}>Start workout</Text>
						</Pressable>
					)}

					<Pressable
						style={styles.actionRow}
						onPress={() => {
							onClose();
							onReschedule();
						}}
					>
						<Ionicons
							name="arrow-forward-outline"
							size={22}
							color={isMoveActive ? '#C87E25' : '#fff'}
						/>
						<Text style={[styles.actionText, isMoveActive && styles.actionTextActive]}>
							{isMoveActive ? 'Cancel reschedule' : 'Reschedule'}
						</Text>
					</Pressable>

					<Pressable
						style={styles.actionRow}
						onPress={() => {
							onClose();
							onDelete();
						}}
					>
						<Ionicons name="trash-outline" size={22} color="#E55454" />
						<Text style={[styles.actionText, styles.actionTextDestructive]}>
							Delete workout
						</Text>
					</Pressable>

					<Pressable style={styles.cancelRow} onPress={onClose}>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	sheet: {
		backgroundColor: '#171717',
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 32,
	},
	title: {
		color: '#C87E25',
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 16,
	},
	actionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 14,
		gap: 14,
	},
	actionText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '500',
	},
	actionTextActive: {
		color: '#C87E25',
	},
	actionTextDestructive: {
		color: '#E55454',
	},
	cancelRow: {
		marginTop: 12,
		paddingVertical: 14,
		alignItems: 'center',
		borderTopWidth: 1,
		borderTopColor: '#262626',
	},
	cancelText: {
		color: '#888',
		fontSize: 16,
		fontWeight: '500',
	},
});
