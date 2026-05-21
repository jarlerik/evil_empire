import { describe, it, expect, vi, beforeEach } from 'vitest';

// JWT middleware is the boundary in production; in unit tests we stub it
// so the test exercises the route body, not Supabase JWKS fetching.
vi.mock('../../middleware/jwt', () => ({
	requireSupabaseJwt: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('../env', () => ({
	coachEnv: {
		anthropicApiKey: '',
		hasProviderConfigured: false,
	},
}));

import { Hono } from 'hono';
import { coachRoutes } from '../routes';

beforeEach(() => {
	vi.clearAllMocks();
});

function buildApp() {
	const app = new Hono();
	app.route('/api/coach', coachRoutes);
	return app;
}

describe('POST /api/coach/prompt', () => {
	it('rejects non-JSON bodies with 400', async () => {
		const app = buildApp();
		const res = await app.request('/api/coach/prompt', {
			method: 'POST',
			body: 'not json',
		});
		expect(res.status).toBe(400);
	});

	it('rejects requests with no messages', async () => {
		const app = buildApp();
		const res = await app.request('/api/coach/prompt', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ messages: [] }),
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string; reason: string };
		expect(body.error).toBe('invalid_request');
	});

	it('rejects unknown roles', async () => {
		const app = buildApp();
		const res = await app.request('/api/coach/prompt', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ messages: [{ role: 'admin', content: 'hi' }] }),
		});
		expect(res.status).toBe(400);
	});

	it('streams SSE events from the stub provider when no API key is set', async () => {
		const app = buildApp();
		const res = await app.request('/api/coach/prompt', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ messages: [{ role: 'user', content: 'hello coach' }] }),
		});
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);

		const text = await res.text();
		expect(text).toContain('event: message_start');
		expect(text).toContain('event: text_delta');
		expect(text).toContain('event: message_end');
		expect(text).toContain('"finishReason":"stop"');
	});
});
