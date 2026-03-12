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

// Mock supabase
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../lib/supabase', () => ({
	supabase: {
		from: () => ({
			select: () => ({
				eq: () => ({
					single: () => mockSingle(),
				}),
			}),
			update: (data: unknown) => {
				mockUpdate(data);
				return {
					eq: () => ({
						select: () => ({
							single: () => mockSingle(),
						}),
					}),
				};
			},
			insert: (data: unknown) => {
				mockInsert(data);
				return {
					select: () => ({
						single: () => mockSingle(),
					}),
				};
			},
		}),
	},
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<UserSettingsProvider>{children}</UserSettingsProvider>
);

describe('UserSettingsContext', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUserState.user = { id: 'user-1', email: 'test@example.com' };
		mockSingle.mockResolvedValue({
			data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
			error: null,
		});
	});

	describe('useUserSettings', () => {
		it('should throw error when used outside UserSettingsProvider', () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			expect(() => {
				renderHook(() => useUserSettings());
			}).toThrow('useUserSettings must be used within a UserSettingsProvider');

			consoleSpy.mockRestore();
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
			mockSingle
				.mockResolvedValueOnce({
					data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
					error: null,
				})
				.mockResolvedValueOnce({
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

			expect(mockUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					weight_unit: 'lbs',
					user_weight: '85',
				}),
			);
		});

		it('should merge partial updates with existing settings', async () => {
			mockSingle
				.mockResolvedValueOnce({
					data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
					error: null,
				})
				.mockResolvedValueOnce({
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

			expect(mockUpdate).toHaveBeenCalledWith(
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
			mockSingle
				.mockResolvedValueOnce({
					data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
					error: null,
				})
				.mockResolvedValueOnce({
					data: null,
					error: null,
				})
				.mockResolvedValueOnce({
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

			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: 'user-1',
					weight_unit: 'lbs',
				}),
			);
		});

		it('should throw error on insert failure', async () => {
			// First call: fetch settings successfully
			// Second call: update returns no data (triggers insert)
			// Third call: insert fails
			mockSingle
				.mockResolvedValueOnce({
					data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
					error: null,
				})
				.mockResolvedValueOnce({
					data: null,
					error: null,
				})
				.mockRejectedValueOnce({ message: 'Insert failed' });

			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.updateSettings({ weight_unit: 'lbs' });
				}),
			).rejects.toEqual({ message: 'Insert failed' });

			consoleSpy.mockRestore();
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

			expect(mockUpdate).not.toHaveBeenCalled();
		});
	});

	describe('default settings creation', () => {
		it('should create default settings when none exist', async () => {
			mockSingle
				.mockRejectedValueOnce({ code: 'PGRST116', message: 'No rows' })
				.mockResolvedValueOnce({
					data: { weight_unit: 'kg', user_weight: '85', onboarding_completed: false },
					error: null,
				});

			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			const { result } = renderHook(() => useUserSettings(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			consoleSpy.mockRestore();
		});
	});

	describe('settings values', () => {
		it('should support kg weight unit', async () => {
			mockSingle.mockResolvedValue({
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
			mockSingle.mockResolvedValue({
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
