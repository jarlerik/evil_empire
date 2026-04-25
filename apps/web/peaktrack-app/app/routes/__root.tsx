import { Outlet, createRootRoute, useRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';
import { Card, Text, Button } from '@evil-empire/ui';
import { AuthProvider } from '../contexts/AuthContext';
import { UserSettingsProvider } from '../contexts/UserSettingsContext';
import { queryClient } from '../lib/query-client';

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserSettingsProvider>
          <Outlet />
        </UserSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card variant="bordered" style={{ maxWidth: 480, gap: 16 }}>
        <Text variant="display">404</Text>
        <Text variant="body">This page doesn't exist.</Text>
        <Button title="Go home" variant="primary" onPress={() => router.navigate({ to: '/' })} />
      </Card>
    </View>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
