import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  fetchUserSettings as fetchUserSettingsService,
  upsertUserSettings,
  markOnboardingCompleted,
} from '@evil-empire/peaktrack-services';
import { useAuth } from './AuthContext';

interface UserSettings {
  weight_unit: 'kg' | 'lbs' | null;
  user_weight: string;
  onboarding_completed: boolean;
}

interface UserSettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await fetchUserSettingsService(user.id);
        if (cancelled) return;
        if (error) throw new Error(error);

        if (data) {
          setSettings({
            weight_unit: data.weight_unit,
            user_weight: data.user_weight,
            onboarding_completed: data.onboarding_completed ?? false,
          });
        } else {
          setSettings({ weight_unit: null, user_weight: '85', onboarding_completed: false });
        }
      } catch (error) {
        console.error('Error fetching user settings:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    const currentSettings =
      settings ?? { weight_unit: null, user_weight: '85', onboarding_completed: false };
    const updatedSettings = { ...currentSettings, ...newSettings };

    if (!updatedSettings.weight_unit) {
      setSettings(updatedSettings);
      return;
    }

    const { error } = await upsertUserSettings(user.id, {
      weight_unit: updatedSettings.weight_unit,
      user_weight: updatedSettings.user_weight,
    });
    if (error) throw new Error(error);

    setSettings(updatedSettings);
  };

  const completeOnboarding = async () => {
    if (!user) return;
    const { error } = await markOnboardingCompleted(user.id);
    if (!error) {
      setSettings(prev => (prev ? { ...prev, onboarding_completed: true } : prev));
    }
  };

  const value: UserSettingsContextType = {
    settings,
    loading,
    updateSettings,
    completeOnboarding,
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
