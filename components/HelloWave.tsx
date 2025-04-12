import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from 'react-native-reanimated';

export function HelloWave() {
	const rotationAnimation = useSharedValue(0);

	useEffect(() => {
		rotationAnimation.value = withRepeat(
			withSequence(withTiming(1, { duration: 1000 }), withTiming(0, { duration: 1000 })),
			-1, // Infinite repetition
		);
	}, [rotationAnimation]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotationAnimation.value * 25}deg` }],
	}));

	return <Animated.Text style={[styles.wave, animatedStyle]}>👋</Animated.Text>;
}

const styles = StyleSheet.create({
	wave: {
		fontSize: 24,
	},
});
