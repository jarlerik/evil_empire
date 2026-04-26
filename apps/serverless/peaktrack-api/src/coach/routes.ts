import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { CoachMessage, CoachPromptRequest, CoachStreamEvent } from '@evil-empire/types/coach';

import { requireSupabaseJwt } from '../middleware/jwt';
import { runCoachStream } from './service';

// POST /api/coach/prompt — JWT-gated, streams CoachStreamEvent JSON payloads
// over SSE. The Lambda Function URL is configured for RESPONSE_STREAM invoke
// mode (see template.yaml) so the bytes flush incrementally instead of being
// buffered until the handler returns.

const ALLOWED_ROLES = new Set<CoachMessage['role']>(['user', 'assistant', 'system']);
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8000;

export const coachRoutes = new Hono();

coachRoutes.post('/prompt', requireSupabaseJwt, async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'invalid_json' }, 400);
	}

	const validation = validateRequest(body);
	if ('error' in validation) {
		return c.json({ error: 'invalid_request', reason: validation.error }, 400);
	}

	return streamSSE(c, async (stream) => {
		for await (const event of runCoachStream(validation.messages)) {
			await stream.writeSSE({
				event: event.type,
				data: JSON.stringify(event satisfies CoachStreamEvent),
			});
			if (event.type === 'message_end' || event.type === 'error') break;
		}
	});
});

function validateRequest(
	body: unknown,
): { messages: CoachMessage[] } | { error: string } {
	if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
	const candidate = body as Partial<CoachPromptRequest>;
	if (!Array.isArray(candidate.messages)) return { error: 'messages must be an array' };
	if (candidate.messages.length === 0) return { error: 'messages must be non-empty' };
	if (candidate.messages.length > MAX_MESSAGES) {
		return { error: `messages exceeds limit of ${MAX_MESSAGES}` };
	}

	const messages: CoachMessage[] = [];
	for (const [index, raw] of candidate.messages.entries()) {
		if (!raw || typeof raw !== 'object') {
			return { error: `messages[${index}] must be an object` };
		}
		const m = raw as Partial<CoachMessage>;
		if (typeof m.role !== 'string' || !ALLOWED_ROLES.has(m.role as CoachMessage['role'])) {
			return { error: `messages[${index}].role must be one of user|assistant|system` };
		}
		if (typeof m.content !== 'string' || m.content.length === 0) {
			return { error: `messages[${index}].content must be a non-empty string` };
		}
		if (m.content.length > MAX_CONTENT_LENGTH) {
			return { error: `messages[${index}].content exceeds ${MAX_CONTENT_LENGTH} chars` };
		}
		messages.push({ role: m.role as CoachMessage['role'], content: m.content });
	}
	return { messages };
}
