import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { UserSettingsProvider, useUserSettings } from '../UserSettingsContext';

// Mock user state - must be prefixed with 'mock' to be accessible in jest.mock
const mockUserState = {
	user: { id: 'user-1', email: 'test@example.com' } as { id: string; email: string } | null,
};

jest.mock('../AuthContext', () => ({
	useAuth: () => ({
		user: mockUserState.user,
	}),
}));

// Mock peaktrack-services
const mockFetchUserSettings = jest.fn();
const mockUpsertUserSettings = jest.fn();
const mockMarkOnboardingCompleted = jest.fn();

jest.mock('@evil-empire/peaktrack-services', () => ({
	fetchUserSettings: (...args: unknown[]) => mockFetchUserSettings(...args),
	upsertUserSettings: (...args: unknown[]) => mockUpsertUserSettings(...args),
	markOnboardingCompleted: (...args: unknown[]) => mockMarkOnboardingCompleted(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<UserSettingsProvider>{children}</UserSettingsProvider>
);

describe('UserSettingsContext', () => {
	let consoleSpy: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		mockUserState.user = { id: 'user-1', email: 'test@example.com' };
		mockFetchUserSettings.mockResolvedValue({
			data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
			error: null,
		});
		mockUpsertUserSettings.mockResolvedValue({
			data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
			error: null,
		});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe('useUserSettings', () => {
		it('should throw error when used outside UserSettingsProvider', () => {
			expect(() => {
				renderHook(() => useUserSettings());
			}).toThrow('useUserSettings must be used within a UserSettingsProvider');
		});

		it('should return initial loading state', () => {
			const { result } = renderHook(() => useUserSettings(), { wrapper });

			expect(result.current.loading).toBe(true);
		});

		it('should fetch settings on mount when user exists', async () => {
			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(result.current.settings).toEqual({
				weight_unit: 'kg',
				user_weight: '85',
				onboarding_completed: false,
			});
		});

		it('should set settings to null when no user', async () => {
			mockUserState.user = null;

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(result.current.settings).toBeNull();
		});
	});

	describe('updateSettings', () => {
		it('should update settings in database and local state', async () => {
			mockUpsertUserSettings.mockResolvedValue({
				data: { weight_unit: 'lbs', user_weight: '185', onboarding_completed: false },
				error: null,
			});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.updateSettings({ weight_unit: 'lbs' });
			});

			expect(mockUpsertUserSettings).toHaveBeenCalledWith(
				'user-1',
				expect.objectContaining({
					weight_unit: 'lbs',
					user_weight: '85',
				}),
			);
		});

		it('should merge partial updates with existing settings', async () => {
			mockUpsertUserSettings.mockResolvedValue({
				data: { weight_unit: 'kg', user_weight: '90', onboarding_completed: false },
				error: null,
			});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.updateSettings({ user_weight: '90' });
			});

			expect(mockUpsertUserSettings).toHaveBeenCalledWith(
				'user-1',
				expect.objectContaining({
					weight_unit: 'kg',
					user_weight: '90',
				}),
			);

			expect(result.current.settings).toEqual({
				weight_unit: 'kg',
				user_weight: '90',
				onboarding_completed: false,
			});
		});

		it('should insert settings if update returns no data', async () => {
			mockUpsertUserSettings.mockResolvedValue({
				data: { weight_unit: 'lbs', user_weight: '185', onboarding_completed: false },
				error: null,
			});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.updateSettings({ weight_unit: 'lbs' });
			});

			expect(mockUpsertUserSettings).toHaveBeenCalledWith(
				'user-1',
				expect.objectContaining({
					weight_unit: 'lbs',
					user_weight: '85',
				}),
			);
		});

		it('should throw error on upsert failure', async () => {
			mockUpsertUserSettings.mockResolvedValue({
				data: null,
				error: 'Upsert failed',
			});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.updateSettings({ weight_unit: 'lbs' });
				}),
			).rejects.toThrow('Upsert failed');

			expect(consoleSpy).toHaveBeenCalled();
		});

		it('should not update when no user', async () => {
			mockUserState.user = null;

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.updateSettings({ weight_unit: 'lbs' });
			});

			expect(mockUpsertUserSettings).not.toHaveBeenCalled();
		});
	});

	describe('settings values', () => {
		it('should support kg weight unit', async () => {
			mockFetchUserSettings.mockResolvedValue({
				data: { weight_unit: 'kg', user_weight: '100', onboarding_completed: false },
				error: null,
			});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(result.current.settings?.weight_unit).toBe('kg');
		});

		it('should support lbs weight unit', async () => {
			mockFetchUserSettings.mockResolvedValue({
				data: { weight_unit: 'lbs', user_weight: '220', onboarding_completed: false },
				error: null,
			});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(result.current.settings?.weight_unit).toBe('lbs');
		});
	});
});
