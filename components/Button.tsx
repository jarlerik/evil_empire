import { Pressable, Text, StyleSheet, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'style'> {
	title: string;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
}

export function Button({ title, disabled, style, ...props }: ButtonProps) {
	return (
		<Pressable
			style={[styles.button, disabled && styles.buttonDisabled, style]}
			disabled={disabled}
			{...props}
		>
			<Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
				{title}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		backgroundColor: '#C65D24',
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	buttonTextDisabled: {
		color: '#ccc',
	},
});
