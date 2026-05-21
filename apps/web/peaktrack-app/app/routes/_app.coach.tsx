import { createFileRoute, redirect } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Input, Text } from '@evil-empire/ui';
import type { CoachMessage } from '@evil-empire/types/coach';
import { useAuth } from '../contexts/AuthContext';
import { streamCoachPrompt } from '../lib/coach-client';

// Hidden / feature-flagged coach surface. The plan calls for a surface that
// "exercises the endpoint" so we can prove the streaming + secret plumbing
// end-to-end before committing to a final coach UX. Gated behind
// `VITE_COACH_ENABLED=1` so a forgotten link in production doesn't expose
// it; route is intentionally not added to the sidebar nav. Reach it via
// `/coach` directly.

const COACH_ENABLED = import.meta.env.VITE_COACH_ENABLED === '1';

export const Route = createFileRoute('/_app/coach')({
  component: CoachPage,
  beforeLoad: () => {
    if (!COACH_ENABLED) {
      throw redirect({ to: '/' });
    }
  },
});

interface DisplayMessage {
  role: CoachMessage['role'];
  content: string;
  pending?: boolean;
}

function CoachPage() {
  const { session } = useAuth();
  const [history, setHistory] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || streaming) return;
    if (!session?.access_token) {
      setError('Not signed in.');
      return;
    }

    setError(null);
    setDraft('');

    const userMessage: DisplayMessage = { role: 'user', content };
    const assistantPlaceholder: DisplayMessage = {
      role: 'assistant',
      content: '',
      pending: true,
    };
    const nextHistory = [...history, userMessage, assistantPlaceholder];
    setHistory(nextHistory);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const wireMessages: CoachMessage[] = nextHistory
        .filter((m) => !m.pending)
        .map(({ role, content }) => ({ role, content }));

      let assistant = '';
      for await (const event of streamCoachPrompt({
        messages: wireMessages,
        accessToken: session.access_token,
        signal: controller.signal,
      })) {
        if (event.type === 'text_delta') {
          assistant += event.delta;
          setHistory((prev) => withAssistant(prev, assistant, true));
        } else if (event.type === 'message_end') {
          setHistory((prev) => withAssistant(prev, assistant, false));
        } else if (event.type === 'error') {
          setError(event.error);
          setHistory((prev) => prev.slice(0, -1));
          break;
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Coach request failed');
        setHistory((prev) => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 720 }}>
      <Text variant="display">Coach</Text>
      <Text variant="caption">
        Hidden surface — exercises POST /api/coach/prompt with your Supabase JWT.
      </Text>

      <View style={{ gap: 12 }}>
        {history.map((m, i) => (
          <Card
            key={i}
            variant="bordered"
            style={{
              padding: 12,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <Text variant="caption">{m.role}</Text>
            <Text variant="body">{m.content || (m.pending ? '…' : '')}</Text>
          </Card>
        ))}
      </View>

      <Card variant="bordered" style={{ gap: 12 }}>
        <Input
          label="Message"
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask the coach…"
          editable={!streaming}
          multiline
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={streaming ? 'Streaming…' : 'Send'}
            variant="primary"
            loading={streaming}
            onPress={handleSend}
            disabled={!draft.trim() || streaming}
          />
          {streaming ? <Button title="Stop" variant="outline" onPress={handleStop} /> : null}
        </View>
      </Card>

      {error ? (
        <Card variant="bordered" style={{ padding: 12 }}>
          <Text variant="caption">Error</Text>
          <Text variant="body">{error}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function withAssistant(
  prev: DisplayMessage[],
  assistant: string,
  pending: boolean,
): DisplayMessage[] {
  if (prev.length === 0) return prev;
  const next = prev.slice();
  next[next.length - 1] = { role: 'assistant', content: assistant, pending };
  return next;
}
