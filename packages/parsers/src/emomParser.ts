/**
 * Parses EMOM (Every Minute On the Minute) prefix from input string
 * Supports formats: "EMOM 5min:", "EMOM 90s:", "E5min:", "E90s:", etc.
 * @param input - The input string that may contain EMOM prefix
 * @returns Object with emomIntervalSeconds and remainingInput without EMOM prefix
 */
export function parseEmom(input: string): { emomIntervalSeconds?: number; remainingInput: string } {
	const emomPattern = /^(?:emom|e)\s*(\d+)\s*(minutes?|min|sec|m|s)\s*[:;]?\s*/i;
	const match = input.match(emomPattern);

	if (match) {
		const value = parseInt(match[1], 10);
		const unit = match[2]?.toLowerCase() || '';

		let emomIntervalSeconds: number;
		if (unit === 'm' || unit === 'min' || unit === 'minute' || unit === 'minutes') {
			emomIntervalSeconds = value * 60;
		} else {
			emomIntervalSeconds = value;
		}

		const remainingInput = input.substring(match[0].length).trim();
		return { emomIntervalSeconds, remainingInput };
	}

	return { remainingInput: input };
}
