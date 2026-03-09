import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { fetchUserSettings as fetchUserSettingsService, upsertUserSettings } from '../services/userSettingsService';

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
      if (!user) {return;}

      const { data, error } = await fetchUserSettingsService(user.id);

      if (error) {throw new Error(error);}

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
      if (!user) {return;}

      // Ensure we have all required fields by merging with current settings
      const currentSettings = settings || { weight_unit: 'kg', user_weight: '85' };
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
      };

      const { error } = await upsertUserSettings(user.id, {
        weight_unit: updatedSettings.weight_unit,
        user_weight: updatedSettings.user_weight,
      });

      if (error) {throw new Error(error);}

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
