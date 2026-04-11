import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { initSupabaseClient, getSupabaseClient } from '@evil-empire/peaktrack-services';
import { SupabaseClient } from '@supabase/supabase-js';

// Replace these with your Supabase project credentials
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

let supabaseInstance: SupabaseClient | null = null;

// Only create the client on the client-side
if (!(Platform.OS === 'web' && typeof window === 'undefined')) {
  supabaseInstance = initSupabaseClient({
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  });

  // Handle auth state changes only on the client-side
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabaseInstance!.auth.startAutoRefresh();
    } else {
      supabaseInstance!.auth.stopAutoRefresh();
    }
  });
}

// Legacy export for AuthContext which uses supabase directly for auth operations
export const supabase = supabaseInstance;

// Re-export the getter for any code that needs it
export { getSupabaseClient };
