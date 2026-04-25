import { initSupabaseClient, getSupabaseClient } from '@evil-empire/peaktrack-services';
import type { SupabaseClient } from '@supabase/supabase-js';
import { webStorageAdapter } from './storage-adapter';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabaseInstance: SupabaseClient | null = null;

if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  } else {
    supabaseInstance = initSupabaseClient({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      storage: webStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // Picks up Supabase's `#access_token=…&refresh_token=…` hash after
      // email-verification redirects so the user lands signed in instead of
      // having to enter their password again.
      detectSessionInUrl: true,
    });
  }
}

export const supabase = supabaseInstance;
export { getSupabaseClient };
