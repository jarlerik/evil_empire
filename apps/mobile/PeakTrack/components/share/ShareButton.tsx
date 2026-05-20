import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/common';

interface ShareButtonProps {
	onPress: () => void;
	disabled?: boolean;
	size?: number;
	color?: string;
	style?: StyleProp<ViewStyle>;
	accessibilityLabel?: string;
}

export function ShareButton({
	onPress,
	disabled,
	size = 22,
	color = colors.text,
	style,
	accessibilityLabel = 'Share progress',
}: ShareButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={[styles.button, disabled && styles.disabled, style]}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			hitSlop={8}
		>
			<Ionicons name="share-outline" size={size} color={color} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		padding: 4,
	},
	disabled: {
		opacity: 0.4,
	},
});
