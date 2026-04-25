import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@tanstack/react-router';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession } },
  getSupabaseClient: vi.fn(),
}));

import { redirectIfAuthed, requireSession } from '../lib/auth-guards';

beforeEach(() => {
  getSession.mockReset();
});

describe('requireSession', () => {
  it('throws a redirect to /sign-in when no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(requireSession()).rejects.toMatchObject({ options: { to: '/sign-in' } });
  });

  it('resolves silently when a session exists', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await expect(requireSession()).resolves.toBeUndefined();
  });

  it('throws a real TanStack redirect, not a generic error', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    try {
      await requireSession();
      throw new Error('should have thrown');
    } catch (err) {
      expect(isRedirect(err)).toBe(true);
    }
  });
});

describe('redirectIfAuthed', () => {
  it('throws a redirect to / when a session exists', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await expect(redirectIfAuthed()).rejects.toMatchObject({ options: { to: '/' } });
  });

  it('resolves silently when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(redirectIfAuthed()).resolves.toBeUndefined();
  });
});
