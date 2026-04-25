import { createFileRoute } from '@tanstack/react-router';
import { View } from 'react-native';
import { Card, Text, Button } from '@evil-empire/ui';

// Renders a single @evil-empire/ui component to prove the RN-Web alias
// path works end-to-end before PR 2 starts adding real product UI.
function Home() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card variant="bordered" style={{ maxWidth: 480, gap: 16 }}>
        <Text variant="display">PeakTrack</Text>
        <Text variant="body">
          Web app scaffolded — RN-Web alias and TanStack Router are wired. PR 2 brings auth.
        </Text>
        <Button title="Placeholder" variant="primary" onPress={() => undefined} />
      </Card>
    </View>
  );
}

export const Route = createFileRoute('/')({
  component: Home,
});
