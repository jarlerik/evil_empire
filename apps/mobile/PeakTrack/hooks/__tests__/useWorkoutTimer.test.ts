import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWorkoutTimer } from '../useWorkoutTimer';
import { Animated } from 'react-native';

// Mock AudioContext
jest.mock('../../contexts/AudioContext', () => ({
	useAudio: jest.fn().mockReturnValue({
		beepSound: { play: jest.fn(), seekTo: jest.fn().mockReturnValue(Promise.resolve()) },
		tenSecondsSound: { play: jest.fn(), seekTo: jest.fn().mockReturnValue(Promise.resolve()) },
		letsGoSound: { play: jest.fn(), seekTo: jest.fn().mockReturnValue(Promise.resolve()) },
	}),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
	notificationAsync: jest.fn(),
	NotificationFeedbackType: {
		Success: 'success',
	},
}));

// Mock Animated methods
jest.spyOn(Animated, 'loop').mockReturnValue({
	start: jest.fn(),
	stop: jest.fn(),
	reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);
jest.spyOn(Animated, 'sequence').mockReturnValue({
	start: jest.fn(),
	stop: jest.fn(),
	reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);
jest.spyOn(Animated, 'timing').mockReturnValue({
	start: jest.fn(),
	stop: jest.fn(),
	reset: jest.fn(),
} as unknown as Animated.CompositeAnimation);

describe('useWorkoutTimer', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	describe('formatTime', () => {
		it('should format seconds correctly', () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'idle', isEmom: false }));

			expect(result.current.formatTime(0)).toBe('00:00');
			expect(result.current.formatTime(30)).toBe('00:30');
			expect(result.current.formatTime(60)).toBe('01:00');
			expect(result.current.formatTime(90)).toBe('01:30');
			expect(result.current.formatTime(125)).toBe('02:05');
			expect(result.current.formatTime(3600)).toBe('60:00');
		});

		it('should pad single digit minutes and seconds', () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'idle', isEmom: false }));

			expect(result.current.formatTime(5)).toBe('00:05');
			expect(result.current.formatTime(65)).toBe('01:05');
		});
	});

	describe('startRestTimer', () => {
		it('should set initial rest time', () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'rest', isEmom: false }));

			act(() => {
				result.current.startRestTimer(120);
			});

			expect(result.current.restTimeRemaining).toBe(120);
		});

		it('should countdown each second', async () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'rest', isEmom: false }));

			act(() => {
				result.current.startRestTimer(5);
			});

			expect(result.current.restTimeRemaining).toBe(5);

			act(() => {
				jest.advanceTimersByTime(1000);
			});

			await waitFor(() => {
				expect(result.current.restTimeRemaining).toBe(4);
			});

			act(() => {
				jest.advanceTimersByTime(1000);
			});

			await waitFor(() => {
				expect(result.current.restTimeRemaining).toBe(3);
			});
		});

		it('should stop at zero', async () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'rest', isEmom: false }));

			act(() => {
				result.current.startRestTimer(2);
			});

			act(() => {
				jest.advanceTimersByTime(3000);
			});

			await waitFor(() => {
				expect(result.current.restTimeRemaining).toBe(0);
			});
		});
	});

	describe('clearRestTimer', () => {
		it('should stop the countdown', async () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'rest', isEmom: false }));

			act(() => {
				result.current.startRestTimer(10);
			});

			act(() => {
				jest.advanceTimersByTime(2000);
			});

			await waitFor(() => {
				expect(result.current.restTimeRemaining).toBe(8);
			});

			act(() => {
				result.current.clearRestTimer();
			});

			const timeAfterClear = result.current.restTimeRemaining;

			act(() => {
				jest.advanceTimersByTime(3000);
			});

			// Time should not have changed after clear
			expect(result.current.restTimeRemaining).toBe(timeAfterClear);
		});
	});

	describe('setRestTimeRemaining', () => {
		it('should allow manual setting of rest time', () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'idle', isEmom: false }));

			act(() => {
				result.current.setRestTimeRemaining(45);
			});

			expect(result.current.restTimeRemaining).toBe(45);
		});
	});

	describe('initial state', () => {
		it('should start with zero rest time', () => {
			const { result } = renderHook(() => useWorkoutTimer({ workoutState: 'idle', isEmom: false }));

			expect(result.current.restTimeRemaining).toBe(0);
		});
	});
});
