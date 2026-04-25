import { afterEach, describe, expect, it } from 'vitest';
import { webStorageAdapter } from '../lib/storage-adapter';

describe('webStorageAdapter', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('returns null for missing keys', async () => {
    expect(await webStorageAdapter.getItem('missing')).toBeNull();
  });

  it('round-trips a value through localStorage', async () => {
    await webStorageAdapter.setItem('sb-session', 'token-payload');
    expect(globalThis.localStorage.getItem('sb-session')).toBe('token-payload');
    expect(await webStorageAdapter.getItem('sb-session')).toBe('token-payload');
  });

  it('removes a key', async () => {
    await webStorageAdapter.setItem('k', 'v');
    await webStorageAdapter.removeItem('k');
    expect(await webStorageAdapter.getItem('k')).toBeNull();
  });

  it('returns Promises so the shape matches AsyncStorage', () => {
    expect(webStorageAdapter.getItem('x')).toBeInstanceOf(Promise);
    expect(webStorageAdapter.setItem('x', 'y')).toBeInstanceOf(Promise);
    expect(webStorageAdapter.removeItem('x')).toBeInstanceOf(Promise);
  });
});
