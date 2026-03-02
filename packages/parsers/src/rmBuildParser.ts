import { ParserResult, validResult } from './types';

/**
 * Pattern 6: RM Build format - "Build to 8RM" or "build to 8rm"
 * Example: "Build to 8RM"
 */
export function parseRmBuild(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const rmBuildPattern = /^build\s+to\s+(\d+)\s*rm$/i;
	const match = cleanInput.match(rmBuildPattern);

	if (!match) {
		return { matched: false };
	}

	const targetRm = parseInt(match[1]);

	if (targetRm <= 0) {
		return { matched: false };
	}

	return {
		matched: true,
		data: validResult({
			sets: 0, // RM builds don't have fixed sets
			reps: 0, // RM builds don't have fixed reps
			weight: 0, // Weight is built up to
			exerciseType: 'rm_build',
			targetRm,
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}
