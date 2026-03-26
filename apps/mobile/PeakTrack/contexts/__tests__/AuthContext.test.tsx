import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock supabase
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockResend = jest.fn();

jest.mock('../../lib/supabase', () => ({
	supabase: {
		auth: {
			getSession: () => mockGetSession(),
			onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
				mockOnAuthStateChange(callback);
				return {
					data: {
						subscription: {
							unsubscribe: jest.fn(),
						},
					},
				};
			},
			signUp: (params: unknown) => mockSignUp(params),
			signInWithPassword: (params: unknown) => mockSignInWithPassword(params),
			signOut: () => mockSignOut(),
			resend: (params: unknown) => mockResend(params),
		},
	},
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
	let consoleSpy: jest.SpyInstance;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		mockGetSession.mockResolvedValue({ data: { session: null } });
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe('useAuth', () => {
		it('should throw error when used outside AuthProvider', () => {
			expect(() => {
				renderHook(() => useAuth());
			}).toThrow('useAuth must be used within an AuthProvider');
		});

		it('should return initial state', async () => {
			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(result.current.user).toBeNull();
			expect(result.current.session).toBeNull();
		});

		it('should set user and session from getSession', async () => {
			const mockUser = { id: 'user-1', email: 'test@example.com' };
			const mockSession = { user: mockUser, access_token: 'token' };

			mockGetSession.mockResolvedValue({ data: { session: mockSession } });

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(result.current.user).toEqual(mockUser);
			expect(result.current.session).toEqual(mockSession);
		});
	});

	describe('signUp', () => {
		it('should call supabase signUp with email and password', async () => {
			mockSignUp.mockResolvedValue({
				data: { user: { id: 'new-user', identities: [{}] } },
				error: null,
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.signUp('test@example.com', 'password123');
			});

			expect(mockSignUp).toHaveBeenCalledWith({
				email: 'test@example.com',
				password: 'password123',
				options: {
					emailRedirectTo: 'evil-empire://sign-in',
				},
			});
		});

		it('should throw error when email is already registered', async () => {
			mockSignUp.mockResolvedValue({
				data: { user: { id: 'user', identities: [] } },
				error: null,
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signUp('existing@example.com', 'password123');
				}),
			).rejects.toThrow('This email is already registered');
		});

		it('should throw error on auth failure', async () => {
			mockSignUp.mockResolvedValue({
				data: null,
				error: { status: 400, message: 'Invalid email' },
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signUp('invalid', 'password123');
				}),
			).rejects.toThrow();
		});
	});

	describe('signIn', () => {
		it('should call supabase signInWithPassword', async () => {
			const mockSession = { access_token: 'token' };
			mockSignInWithPassword.mockResolvedValue({
				data: { session: mockSession },
				error: null,
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.signIn('test@example.com', 'password123');
			});

			expect(mockSignInWithPassword).toHaveBeenCalledWith({
				email: 'test@example.com',
				password: 'password123',
			});
		});

		it('should throw error when no session created', async () => {
			mockSignInWithPassword.mockResolvedValue({
				data: { session: null },
				error: null,
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signIn('test@example.com', 'password123');
				}),
			).rejects.toThrow('No session created');
		});

		it('should throw error for invalid credentials', async () => {
			mockSignInWithPassword.mockResolvedValue({
				data: null,
				error: { status: 400, message: 'Invalid login credentials' },
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signIn('test@example.com', 'wrong');
				}),
			).rejects.toThrow('Invalid email or password');
		});

		it('should throw error for unconfirmed email', async () => {
			mockSignInWithPassword.mockResolvedValue({
				data: null,
				error: { status: 400, message: 'Email not confirmed' },
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signIn('test@example.com', 'password');
				}),
			).rejects.toThrow('confirm your account');
		});

		it('should throw error for rate limiting', async () => {
			mockSignInWithPassword.mockResolvedValue({
				data: null,
				error: { status: 429, message: 'Rate limit exceeded' },
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signIn('test@example.com', 'password');
				}),
			).rejects.toThrow('Too many attempts');
		});
	});

	describe('signOut', () => {
		it('should call supabase signOut', async () => {
			mockSignOut.mockResolvedValue({ error: null });

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.signOut();
			});

			expect(mockSignOut).toHaveBeenCalled();
		});

		it('should throw error on signOut failure', async () => {
			mockSignOut.mockResolvedValue({ error: new Error('Sign out failed') });

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.signOut();
				}),
			).rejects.toThrow();
		});
	});

	describe('resendVerificationEmail', () => {
		it('should call supabase resend', async () => {
			mockResend.mockResolvedValue({ error: null });

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.resendVerificationEmail('test@example.com');
			});

			expect(mockResend).toHaveBeenCalledWith({
				type: 'signup',
				email: 'test@example.com',
				options: {
					emailRedirectTo: 'evil-empire://sign-in',
				},
			});
		});

		it('should throw error on resend failure', async () => {
			mockResend.mockResolvedValue({
				error: { status: 400, message: 'Resend failed' },
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.resendVerificationEmail('test@example.com');
				}),
			).rejects.toThrow();
		});
	});

	describe('auth state changes', () => {
		it('should update user on auth state change', async () => {
			let authChangeCallback: (event: string, session: unknown) => void;

			mockOnAuthStateChange.mockImplementation((callback) => {
				authChangeCallback = callback;
			});

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			const newUser = { id: 'user-2', email: 'new@example.com' };
			const newSession = { user: newUser, access_token: 'new-token' };

			await act(async () => {
				authChangeCallback!('SIGNED_IN', newSession);
			});

			expect(result.current.user).toEqual(newUser);
			expect(result.current.session).toEqual(newSession);
		});
	});
});
