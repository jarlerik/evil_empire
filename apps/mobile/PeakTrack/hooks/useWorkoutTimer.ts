import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useAudio } from '../contexts/AudioContext';

const REST_DONE_NOTIFICATION_ID = 'rest-timer-done';

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
		shouldShowBanner: true,
		shouldShowList: true,
	}),
});

type WorkoutState = 'idle' | 'work' | 'rest' | 'exercise_done' | 'workout_done';

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
	const timerEndTimeRef = useRef<number | null>(null);
	const { beepSound, tenSecondsSound, letsGoSound } = useAudio();

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
		timerEndTimeRef.current = null;
		Notifications.cancelScheduledNotificationAsync(REST_DONE_NOTIFICATION_ID).catch(() => {});
	}, []);

	const scheduleTimerNotification = useCallback((duration: number) => {
		Notifications.scheduleNotificationAsync({
			identifier: REST_DONE_NOTIFICATION_ID,
			content: {
				title: 'Rest Over',
				body: 'Time to get back to work!',
				sound: 'default',
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
				seconds: duration,
			},
		}).catch(() => {});
	}, []);

	const startCountdown = useCallback((duration: number) => {
		clearRestTimer();
		setRestTimeRemaining(duration);
		timerEndTimeRef.current = Date.now() + duration * 1000;
		scheduleTimerNotification(duration);

		restTimerIntervalRef.current = setInterval(() => {
			const endTime = timerEndTimeRef.current;
			if (!endTime) {return;}

			const remaining = Math.round((endTime - Date.now()) / 1000);
			if (remaining <= 0) {
				if (restTimerIntervalRef.current) {
					clearInterval(restTimerIntervalRef.current);
					restTimerIntervalRef.current = null;
				}
				setRestTimeRemaining(0);
			} else {
				setRestTimeRemaining(remaining);
			}
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

	// Recalculate timer when app returns to foreground
	useEffect(() => {
		const handleAppStateChange = (nextState: AppStateStatus) => {
			if (nextState === 'active' && timerEndTimeRef.current && hasActiveCountdown.current) {
				const remaining = Math.round((timerEndTimeRef.current - Date.now()) / 1000);
				if (remaining <= 0) {
					clearRestTimer();
					setRestTimeRemaining(0);
				} else {
					setRestTimeRemaining(remaining);
				}
			}
		};

		const subscription = AppState.addEventListener('change', handleAppStateChange);
		return () => subscription.remove();
	}, [clearRestTimer]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			clearRestTimer();
		};
	}, [clearRestTimer]);

	// Audio and vibration feedback for rest timer countdown
	useEffect(() => {
		if (!hasActiveCountdown.current) {return;}

		if ((workoutState === 'rest' || (workoutState === 'work' && isEmom)) && restTimeRemaining === 10) {
			tenSecondsSound.seekTo(0).then(() => tenSecondsSound.play()).catch(() => {});
		}

		// Voice cue and beep at zero
		if ((workoutState === 'rest' || (workoutState === 'work' && isEmom)) && restTimeRemaining === 0) {
			letsGoSound.seekTo(0).then(() => letsGoSound.play()).catch(() => {});
			beepSound.seekTo(0).then(() => beepSound.play()).catch(() => {});
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
