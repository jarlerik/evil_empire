import { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

interface UseWorkoutTimerProps {
	workoutState: WorkoutState;
}

interface UseWorkoutTimerReturn {
	restTimeRemaining: number;
	setRestTimeRemaining: (time: number) => void;
	blinkOpacity: Animated.Value;
	formatTime: (seconds: number) => string;
	startRestTimer: (duration: number) => void;
	clearRestTimer: () => void;
}

export function useWorkoutTimer({ workoutState }: UseWorkoutTimerProps): UseWorkoutTimerReturn {
	const [restTimeRemaining, setRestTimeRemaining] = useState<number>(0);
	const restTimerIntervalRef = useRef<number | null>(null);
	const blinkOpacity = useRef(new Animated.Value(1)).current;
	const beepSound = useRef<Audio.Sound | null>(null);

	// Helper function to format time as MM:SS
	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	// Clear rest timer
	const clearRestTimer = () => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}
	};

	// Start rest timer countdown
	const startRestTimer = (duration: number) => {
		setRestTimeRemaining(duration);

		// Clear any existing interval
		clearRestTimer();

		// Start countdown
		restTimerIntervalRef.current = setInterval(() => {
			setRestTimeRemaining((prev) => {
				if (prev <= 1) {
					clearRestTimer();
					return 0;
				}
				return prev - 1;
			});
		}, 1000) as unknown as number;
	};

	// Cleanup rest timer on unmount
	useEffect(() => {
		return () => {
			clearRestTimer();
		};
	}, []);

	// Load beep sound on mount
	useEffect(() => {
		const loadSound = async () => {
			const { sound } = await Audio.Sound.createAsync(
				require('../assets/sounds/beep.wav'),
			);
			beepSound.current = sound;
		};
		loadSound();

		return () => {
			if (beepSound.current) {
				beepSound.current.unloadAsync();
			}
		};
	}, []);

	// Audio and vibration feedback for rest timer countdown
	useEffect(() => {
		if (workoutState === 'rest' && restTimeRemaining <= 5 && restTimeRemaining > 0) {
			// Play beep sound for final 5 seconds
			if (beepSound.current) {
				beepSound.current.replayAsync();
			}
		}
		if (workoutState === 'rest' && restTimeRemaining === 0) {
			if (beepSound.current) {
				beepSound.current.replayAsync();
			}
			// Vibrate when timer ends
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}
	}, [restTimeRemaining, workoutState]);

	// Blinking animation for WORKING and RESTING states
	useEffect(() => {
		if (workoutState === 'work' || workoutState === 'rest') {
			const blinkAnimation = Animated.loop(
				Animated.sequence([
					Animated.timing(blinkOpacity, {
						toValue: 0.3,
						duration: 500,
						useNativeDriver: true,
					}),
					Animated.timing(blinkOpacity, {
						toValue: 1,
						duration: 500,
						useNativeDriver: true,
					}),
				]),
			);
			blinkAnimation.start();
			return () => blinkAnimation.stop();
		} else {
			blinkOpacity.setValue(1);
		}
	}, [workoutState, blinkOpacity]);

	return {
		restTimeRemaining,
		setRestTimeRemaining,
		blinkOpacity,
		formatTime,
		startRestTimer,
		clearRestTimer,
	};
}
