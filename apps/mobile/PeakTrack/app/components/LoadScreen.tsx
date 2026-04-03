import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
	withSequence,
	withDelay,
	withRepeat,
	Easing,
} from 'react-native-reanimated';

const LETTERS = ['P', 'K', 'T', 'R'];
const STAGGER = 50;
const BOUNCE_UP_DURATION = 600;
const BOUNCE_DOWN_DURATION = 800;
const BOUNCE_DOWN_DELAY = 100;
const ROTATE_DURATION = BOUNCE_UP_DURATION + BOUNCE_DOWN_DELAY + BOUNCE_DOWN_DURATION;
const TOTAL_ANIMATION = ROTATE_DURATION + STAGGER * (LETTERS.length - 1);
const LOOP_PAUSE = 1000;
const BOUNCE_HEIGHT = -44;

function AnimatedLetter({ letter, index }: { letter: string; index: number }) {
	const translateY = useSharedValue(0);
	const rotation = useSharedValue(0);

	useEffect(() => {
		const staggerDelay = index * STAGGER;

		translateY.value = withDelay(
			staggerDelay,
			withRepeat(
				withSequence(
					withTiming(BOUNCE_HEIGHT, {
						duration: BOUNCE_UP_DURATION,
						easing: Easing.out(Easing.exp),
					}),
					withDelay(
						BOUNCE_DOWN_DELAY,
						withTiming(0, {
							duration: BOUNCE_DOWN_DURATION,
							easing: Easing.bounce,
						}),
					),
					withTiming(0, { duration: TOTAL_ANIMATION - ROTATE_DURATION + LOOP_PAUSE - staggerDelay }),
				),
				-1,
				false,
			),
		);

		rotation.value = withDelay(
			staggerDelay,
			withRepeat(
				withSequence(
					withTiming(360, {
						duration: ROTATE_DURATION,
						easing: Easing.inOut(Easing.circle),
					}),
					withTiming(360, { duration: TOTAL_ANIMATION - ROTATE_DURATION + LOOP_PAUSE - staggerDelay }),
				),
				-1,
				false,
			),
		);
	}, [index, translateY, rotation]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: translateY.value },
			{ rotate: `${rotation.value}deg` },
		],
	}));

	return (
		<Animated.Text style={[styles.letter, animatedStyle]}>
			{letter}
		</Animated.Text>
	);
}

export function LoadScreen() {
	return (
		<View style={styles.container}>
			<View style={styles.letterRow}>
				{LETTERS.map((letter, index) => (
					<AnimatedLetter key={letter} letter={letter} index={index} />
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#000',
	},
	letterRow: {
		flexDirection: 'row',
	},
	letter: {
		fontSize: 48,
		fontWeight: '700',
		color: '#c65d24',
		marginHorizontal: 2,
	},
});
