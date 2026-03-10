import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

const beepSoundSource = require('../assets/sounds/beep.m4a');
const beepLongSoundSource = require('../assets/sounds/beep-long.m4a');

interface UseWorkoutTimerProps {
	workoutState: WorkoutState;
	isEmom: boolean;
	onEmomTimerZero?: () => void;
}

interface UseWorkoutTimerReturn {
	restTimeRemaining: number;
	blinkOpacity: Animated.Value;
	hasActiveCountdown: React.RefObject<boolean>;
	formatTime: (seconds: number) => string;
	startRestTimer: (duration: number) => void;
	startEmomTimer: (intervalSeconds: number) => void;
	clearRestTimer: () => void;
	setRestTimeRemaining: (time: number) => void;
}

export function useWorkoutTimer({ workoutState, isEmom, onEmomTimerZero }: UseWorkoutTimerProps): UseWorkoutTimerReturn {
	const [restTimeRemaining, setRestTimeRemaining] = useState<number>(0);
	const restTimerIntervalRef = useRef<number | null>(null);
	const blinkOpacity = useRef(new Animated.Value(1)).current;
	const hasActiveCountdown = useRef(false);
	const beepSound = useAudioPlayer(beepSoundSource);
	const beepLongSound = useAudioPlayer(beepLongSoundSource);

	// Store callback in ref to avoid stale closures in effects
	const onEmomTimerZeroRef = useRef(onEmomTimerZero);
	onEmomTimerZeroRef.current = onEmomTimerZero;

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	const clearRestTimer = useCallback(() => {
		if (restTimerIntervalRef.current) {
			clearInterval(restTimerIntervalRef.current);
			restTimerIntervalRef.current = null;
		}
	}, []);

	const startCountdown = useCallback((duration: number) => {
		clearRestTimer();
		setRestTimeRemaining(duration);

		restTimerIntervalRef.current = setInterval(() => {
			setRestTimeRemaining((prev) => {
				if (prev <= 1) {
					if (restTimerIntervalRef.current) {
						clearInterval(restTimerIntervalRef.current);
						restTimerIntervalRef.current = null;
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1000) as unknown as number;
	}, [clearRestTimer]);

	const startRestTimer = useCallback((duration: number) => {
		hasActiveCountdown.current = true;
		startCountdown(duration);
	}, [startCountdown]);

	const startEmomTimer = useCallback((intervalSeconds: number) => {
		hasActiveCountdown.current = true;
		startCountdown(intervalSeconds);
	}, [startCountdown]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			clearRestTimer();
		};
	}, [clearRestTimer]);

	// Audio and vibration feedback for rest timer countdown
	useEffect(() => {
		if (!hasActiveCountdown.current) {return;}

		// Beep countdown in last 5 seconds (rest state, or EMOM work state)
		if ((workoutState === 'rest' || (workoutState === 'work' && isEmom)) && restTimeRemaining <= 5 && restTimeRemaining > 0) {
			try {
				beepSound.play();
			} catch {
				// Native audio player may not be ready
			}
		}

		// Long beep at zero
		if ((workoutState === 'rest' || (workoutState === 'work' && isEmom)) && restTimeRemaining === 0) {
			try {
				beepLongSound.play();
			} catch {
				// Native audio player may not be ready
			}
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}

		// EMOM auto-advance when timer hits 0
		if (isEmom && (workoutState === 'rest' || workoutState === 'work') && restTimeRemaining === 0) {
			onEmomTimerZeroRef.current?.();
		}
	}, [restTimeRemaining, workoutState, isEmom]);

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
		blinkOpacity,
		hasActiveCountdown,
		formatTime,
		startRestTimer,
		startEmomTimer,
		clearRestTimer,
		setRestTimeRemaining,
	};
}
