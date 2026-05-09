import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Input, Pressable, Text } from '@evil-empire/ui';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { settings, updateSettings, loading } = useUserSettings();

  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [userWeight, setUserWeight] = useState('85');
  const [defaultRest, setDefaultRest] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setUnit(settings.weight_unit ?? 'kg');
      setUserWeight(settings.user_weight ?? '85');
      setDefaultRest(
        settings.default_rest_seconds != null ? String(settings.default_rest_seconds) : '',
      );
    }
  }, [settings]);

  const handleSave = async () => {
    const trimmedRest = defaultRest.trim();
    let restValue: number | null = null;
    if (trimmedRest !== '') {
      const parsed = parseInt(trimmedRest, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        setMessage('Default rest must be a non-negative whole number of seconds.');
        return;
      }
      restValue = parsed;
    }

    setSaving(true);
    setMessage('');
    try {
      await updateSettings({
        weight_unit: unit,
        user_weight: userWeight,
        default_rest_seconds: restValue,
      });
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: '/sign-in' });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 640 }}>
      <Text variant="display">Settings</Text>
      <Text variant="caption">Signed in as {user?.email}</Text>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Text variant="heading-sm">Weight unit</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['kg', 'lbs'] as const).map((u) => (
            <Pressable
              key={u}
              accessibilityRole="radio"
              accessibilityState={{ selected: unit === u }}
              accessibilityLabel={`Use ${u.toUpperCase()} as weight unit`}
              onPress={() => setUnit(u)}
            >
              <Card
                variant="bordered"
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderColor: unit === u ? '#C87E25' : undefined,
                }}
              >
                <Text variant="body">{u.toUpperCase()}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Text variant="heading-sm">Body weight</Text>
        <Input
          label={`Weight (${unit})`}
          value={userWeight}
          onChangeText={setUserWeight}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
      </Card>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Text variant="heading-sm">Default rest between sets</Text>
        <Text variant="caption">
          Used when you don&apos;t specify a rest time on an exercise. Leave empty for none.
        </Text>
        <Input
          label="Seconds"
          value={defaultRest}
          onChangeText={setDefaultRest}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="e.g. 120"
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Save" variant="primary" loading={saving || loading} onPress={handleSave} />
        <Button title="Sign out" variant="outline" onPress={handleSignOut} />
      </View>
      {message ? <Text variant="caption">{message}</Text> : null}
    </ScrollView>
  );
}
