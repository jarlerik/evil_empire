import { Pressable, Text, StyleSheet, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'style'> {
	title: string;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
	variant?: 'primary' | 'secondary';
}

export function Button({ title, disabled, style, variant = 'primary', ...props }: ButtonProps) {


	const baseStyle = [styles.baseButton, variant === 'primary' && styles.buttonPrimary, variant === 'secondary' && styles.buttonSecondary];
	const styleProps = [...baseStyle, disabled && styles.buttonDisabled, style];
	return (
		<Pressable
			style={styleProps}
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
	baseButton: {
		padding: 15,
		borderRadius: 8,
		alignItems: 'center',
	},
	buttonPrimary: {
		backgroundColor: '#C65D24',
	},
	buttonSecondary: {
		backgroundColor: '#262626',
		borderWidth: 1,
		borderColor: '#fff',
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
