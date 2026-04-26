import type { CoachMessage, CoachStreamEvent } from '@evil-empire/types/coach';

// Provider adapter contract. Each provider yields the same `CoachStreamEvent`
// shape so the route handler doesn't have to care which backend is wired up.
// Splitting later into a different provider (OpenAI, in-house, etc.) is a
// new file under `providers/` and a switch in `service.ts`.

export interface CoachProvider {
	readonly name: string;
	stream(messages: CoachMessage[]): AsyncIterable<CoachStreamEvent>;
}
