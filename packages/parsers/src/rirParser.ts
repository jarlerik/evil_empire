import { ParserResult, validResult } from './types';

/**
 * Pattern 0c (RIR variant): Simple RIR format "sets x reps @RIRRIR"
 * Example: "4 x 3 @2RIR"
 */
export function parseSimpleRir(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const rirPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*rir$/i;
	const match = cleanInput.match(rirPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const value = parseFloat(match[3]);

	return {
		matched: true,
		data: validResult({
			sets,
			reps,
			weight: 0,
			exerciseType: 'standard',
			rirMin: value,
			rirMax: value,
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}

/**
 * Pattern 8: Standard format with RIR - "2x 10 @50kg, 2-3RIR" or "2x 10 @50kg 2-3RIR"
 * Example: "4 x 6 @50kg, 1RIR", "4 x 6 @50kg 2-3RIR"
 * Note: This pattern is for weight + RIR, not @weightRIR (which is handled by parseSimpleRir)
 */
export function parseStandardWithRir(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const standardWithRirPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*(?:kg|lbs)(?:,\s*|\s+)(\d+)(?:-(\d+))?\s*rir$/i;
	const match = cleanInput.match(standardWithRirPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const weight = parseFloat(match[3]);
	const rirMin = parseInt(match[4]);
	const rirMax = match[5] ? parseInt(match[5]) : undefined;

	return {
		matched: true,
		data: validResult({
			sets,
			reps,
			weight,
			exerciseType: 'standard',
			rirMin,
			rirMax: rirMax || rirMin,
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}

/**
 * Pattern 7: RIR format without weight - "2x 10, 2-3RIR" or "2x 10, 2RIR" or "2x 10 2-3RIR" or "2x 10 2RIR"
 * Example: "4 x 6, 1RIR", "4 x 6 2-3RIR"
 * Note: RIR with weight is handled by parseStandardWithRir or parseSimpleRir (@weightRIR)
 */
export function parseRirWithoutWeight(cleanInput: string, restTimeSeconds?: number): ParserResult {
	const rirPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)(?:,\s*|\s+)(\d+)(?:-(\d+))?\s*rir$/i;
	const match = cleanInput.match(rirPattern);

	if (!match) {
		return { matched: false };
	}

	const sets = parseInt(match[1]);
	const reps = parseInt(match[2]);
	const rirMin = parseInt(match[3]);
	const rirMax = match[4] ? parseInt(match[4]) : undefined;

	return {
		matched: true,
		data: validResult({
			sets,
			reps,
			weight: 0, // RIR format doesn't specify weight
			exerciseType: 'standard',
			rirMin,
			rirMax: rirMax || rirMin, // If no max, use min as max
			...(restTimeSeconds !== undefined && { restTimeSeconds }),
		}),
	};
}
