import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { addDays, format } from 'date-fns';

interface WeekDaySelectorProps {
	weekStart: Date;
	selectedDate: Date;
	onSelectDate: (date: Date) => void;
}

export function WeekDaySelector({ weekStart, selectedDate, onSelectDate }: WeekDaySelectorProps) {
	return (
		<View style={styles.daySelector}>
			{Array.from({ length: 7 }).map((_, i) => {
				const day = addDays(weekStart, i);
				const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

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
								isSelected ? styles.dayCircleSelected : styles.dayCircleUnselected
							]}
						>
							<Text
								style={[
									styles.dayNumber,
									isSelected ? styles.dayNumberSelected : styles.dayNumberUnselected
								]}
							>
								{format(day, 'd')}
							</Text>
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
});
