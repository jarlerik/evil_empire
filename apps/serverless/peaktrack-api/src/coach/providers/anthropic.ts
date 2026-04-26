import type { CoachMessage, CoachStreamEvent, CoachFinishReason } from '@evil-empire/types/coach';

import type { CoachProvider } from './types';

// Thin adapter over Anthropic's Messages streaming API. We use plain `fetch`
// + manual SSE parsing instead of the SDK so the Lambda bundle stays small —
// the SDK pulls a sizeable tree, and we only need a handful of event types.
//
// Translation map (Anthropic -> CoachStreamEvent):
//   message_start            -> message_start  (capture id)
//   content_block_delta      -> text_delta     (forward each text delta)
//   message_delta            -> ignore (carries usage / stop_reason)
//   message_stop             -> message_end
//   error                    -> error
//
// Stop-reason mapping: Anthropic's `stop_reason` is one of
// 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'. We collapse to
// the CoachFinishReason enum the contract exposes.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;

const SYSTEM_PROMPT =
	'You are PeakTrack Coach, a strength-training assistant. Be concise, ' +
	'practical, and reference the user\'s data when relevant. Avoid medical advice.';

interface AnthropicProviderOptions {
	apiKey: string;
	model?: string;
	maxTokens?: number;
}

export function createAnthropicProvider(opts: AnthropicProviderOptions): CoachProvider {
	const model = opts.model ?? DEFAULT_MODEL;
	const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

	return {
		name: 'anthropic',
		async *stream(messages: CoachMessage[]): AsyncIterable<CoachStreamEvent> {
			// Anthropic takes `system` separately and only allows user/assistant
			// in `messages`. Pull any system entries the client sent, prepend
			// the server-side system prompt as the source of truth.
			const { system, conversation } = splitSystem(messages);

			const res = await fetch(ANTHROPIC_URL, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-api-key': opts.apiKey,
					'anthropic-version': ANTHROPIC_VERSION,
				},
				body: JSON.stringify({
					model,
					max_tokens: maxTokens,
					stream: true,
					system: system ? `${SYSTEM_PROMPT}\n\n${system}` : SYSTEM_PROMPT,
					messages: conversation.map((m) => ({ role: m.role, content: m.content })),
				}),
			});

			if (!res.ok || !res.body) {
				const detail = await safeReadError(res);
				yield { type: 'error', error: `provider_error: ${detail}` };
				return;
			}

			let messageEmitted = false;
			let finishReason: CoachFinishReason = 'stop';

			for await (const evt of parseSseStream(res.body)) {
				if (evt.event === 'message_start') {
					const id = pickString(evt.json, ['message', 'id']) ?? `anthropic_${Date.now().toString(36)}`;
					messageEmitted = true;
					yield { type: 'message_start', messageId: id };
				} else if (evt.event === 'content_block_delta') {
					const delta = pickString(evt.json, ['delta', 'text']);
					if (delta) yield { type: 'text_delta', delta };
				} else if (evt.event === 'message_delta') {
					const stop = pickString(evt.json, ['delta', 'stop_reason']);
					if (stop === 'max_tokens') finishReason = 'length';
					else if (stop) finishReason = 'stop';
				} else if (evt.event === 'error') {
					const message = pickString(evt.json, ['error', 'message']) ?? 'unknown provider error';
					yield { type: 'error', error: message };
					return;
				}
			}

			if (!messageEmitted) {
				yield { type: 'error', error: 'provider produced no message_start event' };
				return;
			}
			yield { type: 'message_end', finishReason };
		},
	};
}

function splitSystem(messages: CoachMessage[]): {
	system: string | null;
	conversation: CoachMessage[];
} {
	const systems: string[] = [];
	const conversation: CoachMessage[] = [];
	for (const m of messages) {
		if (m.role === 'system') systems.push(m.content);
		else conversation.push(m);
	}
	return {
		system: systems.length > 0 ? systems.join('\n\n') : null,
		conversation,
	};
}

async function safeReadError(res: Response): Promise<string> {
	try {
		const text = await res.text();
		return `${res.status} ${text.slice(0, 200)}`;
	} catch {
		return `${res.status}`;
	}
}

interface ParsedSseEvent {
	event: string;
	json: unknown;
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<ParsedSseEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		// SSE frames are separated by a blank line. Anthropic sends \n\n.
		let sep: number;
		while ((sep = buffer.indexOf('\n\n')) !== -1) {
			const frame = buffer.slice(0, sep);
			buffer = buffer.slice(sep + 2);
			const parsed = parseFrame(frame);
			if (parsed) yield parsed;
		}
	}
}

function parseFrame(frame: string): ParsedSseEvent | null {
	let event = 'message';
	const dataLines: string[] = [];
	for (const line of frame.split('\n')) {
		if (line.startsWith('event:')) event = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
	}
	if (dataLines.length === 0) return null;
	const data = dataLines.join('\n');
	try {
		return { event, json: JSON.parse(data) };
	} catch {
		return null;
	}
}

function pickString(obj: unknown, path: string[]): string | undefined {
	let cur: unknown = obj;
	for (const key of path) {
		if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
			cur = (cur as Record<string, unknown>)[key];
		} else {
			return undefined;
		}
	}
	return typeof cur === 'string' ? cur : undefined;
}
