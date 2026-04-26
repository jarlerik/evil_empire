import { env as rootEnv } from '../env';

// Coach-feature env access. Kept inside `src/coach/` so a future split (the
// criteria are documented in the v1 plan) is a folder move, not a hunt
// through `src/env.ts` for which keys belong to which feature.
//
// The root env is still the single place that reads `process.env`; coach-
// specific keys live there but are exposed through this façade.

export const coachEnv = {
	get anthropicApiKey(): string {
		return rootEnv.ANTHROPIC_API_KEY;
	},
	get hasProviderConfigured(): boolean {
		return rootEnv.ANTHROPIC_API_KEY.trim().length > 0;
	},
};
