import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface UserSettings {
  weight_unit: 'kg' | 'lbs';
  user_weight: string;
}

interface UserSettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    fetchUserSettings();
  }, [user]);

  const fetchUserSettings = async () => {
    try {
      if (!supabase || !user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          weight_unit: data.weight_unit,
          user_weight: data.user_weight,
        });
      } else {
        // Create default settings if none exist
        const defaultSettings: UserSettings = {
          weight_unit: 'kg',
          user_weight: '85',
        };
        await updateSettings(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      if (!supabase || !user) return;

      // Ensure we have all required fields by merging with current settings
      const currentSettings = settings || { weight_unit: 'kg', user_weight: '85' };
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
      };

      // First try to update existing settings
      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          weight_unit: updatedSettings.weight_unit,
          user_weight: updatedSettings.user_weight,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      // If no row was updated (doesn't exist yet), then insert
      if (!data) {
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            weight_unit: updatedSettings.weight_unit,
            user_weight: updatedSettings.user_weight,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
      } else if (updateError) {
        throw updateError;
      }

      // Update local state
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  };

  const value = {
    settings,
    loading,
    updateSettings,
  };

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
} 