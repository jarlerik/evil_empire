import { Platform } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

export function HapticTab(props: BottomTabBarButtonProps) {
	const handlePress = () => {
		if (Platform.OS !== 'web') {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		props.onPress();
	};

	return <PlatformPressable {...props} onPress={handlePress} />;
}
