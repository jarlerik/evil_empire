/**
 * Parses rest time from the end of input string
 * Supports formats: "120s", "2m" (requires unit to avoid conflicts with multiple weights)
 * @param input - The input string that may contain rest time at the end
 * @returns Object with restTimeSeconds and remainingInput without rest time
 */
export function parseRestTime(input: string): { restTimeSeconds?: number; remainingInput: string } {
	// Pattern to match rest time at the end: requires space before number and a unit (s, m, etc.)
	// Examples: "120s", "2m", "120 s", "2 m", "2min"
	// Unit is mandatory to avoid conflicts with multiple weights format like "3 x 1 @50 60 70"
	const restTimePattern = /\s+(\d+(?:[.,]\d+)?)\s*(s|m|sec|min|seconds?|minutes?)\s*$/i;
	const match = input.match(restTimePattern);

	if (match) {
		const value = parseFloat(match[1].replace(',', '.'));
		const unit = match[2]?.toLowerCase() || '';

		let restTimeSeconds: number;
		if (unit === 'm' || unit === 'min' || unit === 'minute' || unit === 'minutes') {
			restTimeSeconds = Math.round(value * 60); // Convert minutes to seconds
		} else {
			restTimeSeconds = Math.round(value); // Seconds
		}

		// Remove the rest time part from input
		const remainingInput = input.substring(0, match.index).trim();
		return { restTimeSeconds, remainingInput };
	}

	return { remainingInput: input };
}
