import { Outlet, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SidebarNav, Text, type NavItem } from '@evil-empire/ui';
import { useAuth } from '../contexts/AuthContext';
import { requireSession } from '../lib/auth-guards';

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'history', label: 'History' },
  { key: 'programs', label: 'Programs' },
  { key: 'rms', label: 'Rep maxes' },
  { key: 'settings', label: 'Settings' },
];

export const Route = createFileRoute('/_app')({
  component: AppShell,
  beforeLoad: requireSession,
});

function AppShell() {
  const { loading } = useAuth();
  const router = useRouter();
  const [activeKey, setActiveKey] = useState('home');

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <SidebarNav
        items={NAV_ITEMS}
        activeKey={activeKey}
        onSelect={(key) => {
          setActiveKey(key);
          // Real targets land in PR 4–6; for now only home is wired.
          if (key === 'home') router.navigate({ to: '/' });
        }}
        header={<Text variant="heading-sm">PeakTrack</Text>}
      />
      <View style={{ flex: 1 }}>
        <Outlet />
      </View>
    </View>
  );
}
