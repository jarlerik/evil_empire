// Promise-returning wrapper around `localStorage` so the storage interface
// passed to Supabase matches the AsyncStorage shape mobile uses. Supabase v2
// accepts either, but keeping the shape symmetric makes future churn cheap.
//
// `globalThis.localStorage` is defensive: vitest with jsdom provides it, but
// SSR paths (none in v1, but cheap) won't.
export const webStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof globalThis.localStorage === 'undefined') return;
    globalThis.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof globalThis.localStorage === 'undefined') return;
    globalThis.localStorage.removeItem(key);
  },
};
