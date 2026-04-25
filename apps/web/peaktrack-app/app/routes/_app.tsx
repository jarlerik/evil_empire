import {
  Outlet,
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SidebarNav, Text, type NavItem } from '@evil-empire/ui';
import { useAuth } from '../contexts/AuthContext';
import { requireSession } from '../lib/auth-guards';

interface NavTarget {
  key: string;
  label: string;
  to: string;
  match: (path: string) => boolean;
}

const NAV: NavTarget[] = [
  { key: 'home', label: 'Home', to: '/', match: (p) => p === '/' || p.startsWith('/workouts/') },
  { key: 'history', label: 'History', to: '/history', match: (p) => p.startsWith('/history') },
  { key: 'rms', label: 'Rep maxes', to: '/rms', match: (p) => p.startsWith('/rms') },
  { key: 'settings', label: 'Settings', to: '/settings', match: (p) => p.startsWith('/settings') },
];

const NAV_ITEMS: NavItem[] = NAV.map(({ key, label }) => ({ key, label }));

export const Route = createFileRoute('/_app')({
  component: AppShell,
  beforeLoad: requireSession,
});

function AppShell() {
  const { loading } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const activeKey = useMemo(() => {
    return NAV.find((n) => n.match(pathname))?.key ?? 'home';
  }, [pathname]);

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
          const target = NAV.find((n) => n.key === key);
          if (target) router.navigate({ to: target.to });
        }}
        header={<Text variant="heading-sm">PeakTrack</Text>}
      />
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </View>
    </View>
  );
}
