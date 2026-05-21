import type { CoachMessage, CoachStreamEvent } from '@evil-empire/types/coach';

import { coachEnv } from './env';
import { createAnthropicProvider } from './providers/anthropic';
import { stubProvider } from './providers/stub';
import type { CoachProvider } from './providers/types';

// Resolves which provider services a coach prompt and streams its events.
// Provider selection is one decision in one place — adding a second provider
// (or a feature flag, or per-tenant routing) edits this function.

export function resolveProvider(): CoachProvider {
	if (coachEnv.hasProviderConfigured) {
		return createAnthropicProvider({ apiKey: coachEnv.anthropicApiKey });
	}
	return stubProvider;
}

export async function* runCoachStream(
	messages: CoachMessage[],
): AsyncIterable<CoachStreamEvent> {
	const provider = resolveProvider();
	try {
		for await (const event of provider.stream(messages)) {
			yield event;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown error';
		yield { type: 'error', error: `provider_failure: ${message}` };
	}
}
