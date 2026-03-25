import { supabase } from '../lib/supabase';
import { ServiceResult, UserSettingsRow } from './types';

export async function fetchUserSettings(
	userId: string,
): Promise<ServiceResult<UserSettingsRow>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { data, error } = await supabase
		.from('user_settings')
		.select('*')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		return { data: null, error: error.message };
	}

	return { data, error: null };
}

export async function upsertUserSettings(
	userId: string,
	settings: { weight_unit: 'kg' | 'lbs'; user_weight: string },
): Promise<ServiceResult<UserSettingsRow>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	// Try update first
	const { data, error: updateError } = await supabase
		.from('user_settings')
		.update({
			weight_unit: settings.weight_unit,
			user_weight: settings.user_weight,
			updated_at: new Date().toISOString(),
		})
		.eq('user_id', userId)
		.select()
		.single();

	// If no row was updated, insert
	if (!data) {
		const { data: insertData, error: insertError } = await supabase
			.from('user_settings')
			.insert({
				user_id: userId,
				weight_unit: settings.weight_unit,
				user_weight: settings.user_weight,
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (insertError) {
			return { data: null, error: insertError.message };
		}

		return { data: insertData, error: null };
	}

	if (updateError) {
		return { data: null, error: updateError.message };
	}

	return { data, error: null };
}

export async function markOnboardingCompleted(
	userId: string,
): Promise<ServiceResult<null>> {
	if (!supabase) {
		return { data: null, error: 'Database not available' };
	}

	const { error } = await supabase
		.from('user_settings')
		.update({ onboarding_completed: true })
		.eq('user_id', userId);

	if (error) {
		return { data: null, error: error.message };
	}

	return { data: null, error: null };
}
