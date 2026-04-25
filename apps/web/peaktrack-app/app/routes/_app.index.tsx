import { createFileRoute, useRouter } from '@tanstack/react-router';
import { View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { useAuth } from '../contexts/AuthContext';

export const Route = createFileRoute('/_app/')({
  component: Home,
});

function Home() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: '/sign-in' });
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card variant="bordered" style={{ maxWidth: 480, gap: 16 }}>
        <Text variant="display">PeakTrack</Text>
        <Text variant="body">Signed in as {user?.email ?? 'unknown'}.</Text>
        <Text variant="caption">Workout management lands in PR 4.</Text>
        <Button title="Sign out" variant="outline" onPress={handleSignOut} />
      </Card>
    </View>
  );
}
