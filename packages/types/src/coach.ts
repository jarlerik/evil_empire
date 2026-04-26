// Shared contract for `/api/coach/*` traffic. Imported by the web app, the
// mobile app (when it adopts the coach), and the peaktrack-api Lambda — all
// three speak the same TypeScript types so a change here is caught at
// compile time on every consumer instead of at runtime in production.
//
// v1 ships with one endpoint (`POST /api/coach/prompt`) that streams the
// response as SSE. The non-streaming response shape is included so a future
// batch endpoint can reuse it without another contract change.

export type CoachRole = 'user' | 'assistant' | 'system';

export interface CoachMessage {
	role: CoachRole;
	content: string;
}

export interface CoachPromptRequest {
	messages: CoachMessage[];
}

export type CoachFinishReason = 'stop' | 'length' | 'error';

export interface CoachPromptResponse {
	messageId: string;
	content: string;
	finishReason: CoachFinishReason;
}

// SSE event payloads. Each `data:` line on the wire is the JSON encoding of
// one of these. The `type` field is the discriminator; clients can switch on
// it without checking individual fields.
export type CoachStreamEvent =
	| { type: 'message_start'; messageId: string }
	| { type: 'text_delta'; delta: string }
	| { type: 'message_end'; finishReason: CoachFinishReason }
	| { type: 'error'; error: string };
