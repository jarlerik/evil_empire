import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export interface SupabaseClientOptions {
	url: string;
	anonKey: string;
	storage?: any;
	autoRefreshToken?: boolean;
	persistSession?: boolean;
	detectSessionInUrl?: boolean;
}

export function initSupabaseClient(options: SupabaseClientOptions): SupabaseClient {
	supabaseInstance = createClient(options.url, options.anonKey, {
		auth: {
			storage: options.storage,
			autoRefreshToken: options.autoRefreshToken ?? true,
			persistSession: options.persistSession ?? false,
			detectSessionInUrl: options.detectSessionInUrl ?? false,
		},
	});
	return supabaseInstance;
}

export function getSupabaseClient(): SupabaseClient {
	if (!supabaseInstance) {
		throw new Error('Supabase client not initialized. Call initSupabaseClient() first.');
	}
	return supabaseInstance;
}
