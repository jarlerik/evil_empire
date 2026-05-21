import type {
  CoachMessage,
  CoachStreamEvent,
} from '@evil-empire/types/coach';

// Streaming client for POST /api/coach/prompt. Parses the SSE wire format
// frame-by-frame and yields the strongly-typed `CoachStreamEvent`s defined
// in `@evil-empire/types/coach` — same contract the Lambda emits.

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export interface CoachStreamArgs {
  messages: CoachMessage[];
  accessToken: string;
  signal?: AbortSignal;
}

export async function* streamCoachPrompt({
  messages,
  accessToken,
  signal,
}: CoachStreamArgs): AsyncIterable<CoachStreamEvent> {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }

  const res = await fetch(`${API_BASE_URL}/api/coach/prompt`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await safeText(res);
    throw new Error(`coach request failed: ${res.status} ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseFrame(frame);
      if (parsed) yield parsed;
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}

function parseFrame(frame: string): CoachStreamEvent | null {
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return JSON.parse(dataLines.join('\n')) as CoachStreamEvent;
  } catch {
    return null;
  }
}
