import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { addDays, format } from 'date-fns';

interface WeekDaySelectorProps {
	weekStart: Date;
	selectedDate: Date;
	onSelectDate: (date: Date) => void;
	dayStatuses?: Record<string, 'completed' | 'missed' | 'planned'>;
}

export function WeekDaySelector({ weekStart, selectedDate, onSelectDate, dayStatuses }: WeekDaySelectorProps) {
	return (
		<View style={styles.daySelector}>
			{Array.from({ length: 7 }).map((_, i) => {
				const day = addDays(weekStart, i);
				const dayKey = format(day, 'yyyy-MM-dd');
				const isSelected = dayKey === format(selectedDate, 'yyyy-MM-dd');
				const status = dayStatuses?.[dayKey];

				return (
					<Pressable
						key={i}
						onPress={() => onSelectDate(day)}
						style={styles.dayPressable}
					>
						<Text style={styles.dayLabel}>
							{format(day, 'EEE').toUpperCase()}
						</Text>
						<View
							style={[
								styles.dayCircle,
								isSelected ? styles.dayCircleSelected : styles.dayCircleUnselected,
							]}
						>
							<Text
								style={[
									styles.dayNumber,
									isSelected ? styles.dayNumberSelected : styles.dayNumberUnselected,
								]}
							>
								{format(day, 'd')}
							</Text>
						</View>
						<View style={styles.dotContainer}>
							{status && (
								<View
									style={[
										styles.statusDot,
										status === 'missed' ? styles.dotMissed : status === 'planned' ? styles.dotPlanned : styles.dotCompleted,
									]}
								/>
							)}
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	daySelector: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 24,
	},
	dayPressable: {
		alignItems: 'center',
		flex: 1,
		paddingVertical: 4,
	},
	dayLabel: {
		fontWeight: 'bold',
		fontSize: 13,
		letterSpacing: 1,
		textAlign: 'center',
		color: '#fff',
	},
	dayCircle: {
		borderRadius: 20,
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 2,
	},
	dayCircleSelected: {
		backgroundColor: '#fff',
	},
	dayCircleUnselected: {
		backgroundColor: 'rgba(26, 26, 26, 1.00)',
	},
	dayNumber: {
		fontWeight: 'bold',
		fontSize: 20,
		textAlign: 'center',
	},
	dayNumberSelected: {
		color: '#000',
	},
	dayNumberUnselected: {
		color: '#fff',
	},
	dotContainer: {
		height: 10,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 2,
	},
	statusDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	dotMissed: {
		backgroundColor: '#E53935',
	},
	dotCompleted: {
		backgroundColor: '#4CAF50',
	},
	dotPlanned: {
		backgroundColor: '#C65D24',
	},
});
