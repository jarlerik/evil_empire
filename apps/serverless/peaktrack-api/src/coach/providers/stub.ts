import type { CoachMessage, CoachStreamEvent } from '@evil-empire/types/coach';

import type { CoachProvider } from './types';

// Stub provider used when ANTHROPIC_API_KEY isn't configured. v1's plan calls
// for the plumbing to be provable end-to-end even before an AI provider is
// chosen — the stub echoes the last user message back as a few delta chunks
// so the streaming/SSE path is exercised on every deploy.

const ENCODER_CHUNK_SIZE = 24;

function chunk(text: string): string[] {
	const out: string[] = [];
	for (let i = 0; i < text.length; i += ENCODER_CHUNK_SIZE) {
		out.push(text.slice(i, i + ENCODER_CHUNK_SIZE));
	}
	return out;
}

export const stubProvider: CoachProvider = {
	name: 'stub',
	async *stream(messages: CoachMessage[]): AsyncIterable<CoachStreamEvent> {
		const lastUser = [...messages].reverse().find((m) => m.role === 'user');
		const reply = lastUser
			? `(stub) Got your message: "${lastUser.content}". Set ANTHROPIC_API_KEY to enable a real coach response.`
			: '(stub) No user message received.';

		const messageId = `stub_${Date.now().toString(36)}`;
		yield { type: 'message_start', messageId };
		for (const part of chunk(reply)) {
			yield { type: 'text_delta', delta: part };
		}
		yield { type: 'message_end', finishReason: 'stop' };
	},
};
