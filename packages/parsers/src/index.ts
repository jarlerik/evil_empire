/**
 * Parser Module Index
 *
 * This module orchestrates all parsing patterns for exercise input strings.
 * Patterns are tried in a specific order to ensure correct matching.
 */

import { ParsedSetData, invalidResult } from './types';
import { parseEmom } from './emomParser';
import { parseRestTime } from './restTimeParser';

// Import all parsers
import { parseCompoundPercentage, parseCompoundWeight } from './compoundParser';
import { parsePercentageRange, parseSimplePercentage } from './percentageParser';
import { parseWeightRange, parseStandard, parseMultipleWeights } from './standardParser';
import { parseSimpleRir, parseStandardWithRir, parseRirWithoutWeight } from './rirParser';
import { parseWave } from './waveParser';
import { parseCircuitSetsOf, parseCircuitX } from './circuitParser';
import { parseRmBuild } from './rmBuildParser';

// Re-export types and utilities
export type { ParsedSetData } from './types';
export { invalidResult } from './types';
export { reverseParsePhase } from './reverseParser';
export { formatExercisePhase } from './formatExercisePhase';
export type { ExercisePhase } from './formatExercisePhase';

/**
 * Parses a string input in various exercise formats.
 *
 * Supported formats:
 * - Standard: "4 x 3 @50kg"
 * - Weight range: "4 x 3 @85-89kg"
 * - Multiple weights: "3 x 1 @50 60 70kg"
 * - Percentage: "4 x 3 @80%"
 * - Percentage range: "4 x 3 @80-85%"
 * - Compound: "4 x 2 + 2 @50kg"
 * - Compound percentage: "4 x 2 + 2 @80%"
 * - Wave: "3-2-1-1-1 65kg"
 * - Circuit: "2 sets of 10/10 exercise1, 10 exercise2"
 * - RM Build: "Build to 8RM"
 * - RIR: "4 x 6, 2-3RIR"
 * - Standard with RIR: "4 x 6 @50kg, 2-3RIR"
 * - All formats support optional rest time: "4 x 3 @50kg 120s"
 *
 * @param input - The input string to parse
 * @returns ParsedSetData object with parsed values and validity status
 */
export function parseSetInput(input: string): ParsedSetData {
	// Handle empty or whitespace-only input
	if (!input || !input.trim()) {
		return invalidResult('Please enter a valid format (e.g., "3 x 5 @50kg")');
	}

	// Split on first newline to separate exercise format from notes
	const lines = input.trim().split('\n');
	const exerciseLine = lines[0].trim();
	const notesLine = lines.length > 1 ? lines.slice(1).join('\n').trim() : undefined;

	// Helper to add notes and EMOM to a valid result
	const withExtras = (result: ParsedSetData): ParsedSetData => {
		if (!result.isValid) {return result;}
		const extras: Partial<ParsedSetData> = {};
		if (notesLine) {extras.notes = notesLine;}
		if (emomIntervalSeconds) {extras.emomIntervalSeconds = emomIntervalSeconds;}
		return Object.keys(extras).length > 0 ? { ...result, ...extras } : result;
	};

	// Parse EMOM prefix from the exercise line
	const { emomIntervalSeconds, remainingInput: afterEmom } = parseEmom(exerciseLine);

	// Parse rest time from the exercise line (not notes)
	// When EMOM is set, rest is implicit in the interval so ignore rest time
	const { restTimeSeconds, remainingInput } = emomIntervalSeconds
		? { restTimeSeconds: undefined, remainingInput: afterEmom }
		: parseRestTime(afterEmom);

	// Remove any extra spaces and convert to lowercase for easier parsing
	const cleanInput = remainingInput.toLowerCase();

	// Pattern order matters! More specific patterns must come before general ones.
	// Each parser returns { matched: boolean, data?: ParsedSetData }

	// 1. Compound with percentage/RIR (most specific compound pattern)
	const compoundPercentage = parseCompoundPercentage(cleanInput, restTimeSeconds);
	if (compoundPercentage.matched) {
		return withExtras(compoundPercentage.data!);
	}

	// 2. Percentage range (before simple percentage)
	const percentageRange = parsePercentageRange(cleanInput, restTimeSeconds);
	if (percentageRange.matched) {
		return withExtras(percentageRange.data!);
	}

	// 3. Simple percentage
	const simplePercentage = parseSimplePercentage(cleanInput, restTimeSeconds);
	if (simplePercentage.matched) {
		return withExtras(simplePercentage.data!);
	}

	// 4. Weight range (before simple standard)
	const weightRange = parseWeightRange(cleanInput, restTimeSeconds);
	if (weightRange.matched) {
		return withExtras(weightRange.data!);
	}

	// 5. Standard with RIR (before simple standard, more specific)
	const standardWithRir = parseStandardWithRir(cleanInput, restTimeSeconds);
	if (standardWithRir.matched) {
		return withExtras(standardWithRir.data!);
	}

	// 6. Simple RIR format (@2RIR)
	const simpleRir = parseSimpleRir(cleanInput, restTimeSeconds);
	if (simpleRir.matched) {
		return withExtras(simpleRir.data!);
	}

	// 7. Simple standard format
	const standard = parseStandard(cleanInput, restTimeSeconds);
	if (standard.matched) {
		return withExtras(standard.data!);
	}

	// 8. Multiple weights format
	const multipleWeights = parseMultipleWeights(cleanInput, restTimeSeconds);
	if (multipleWeights.matched) {
		return withExtras(multipleWeights.data!);
	}

	// 9. Compound with weight (kg)
	const compoundWeight = parseCompoundWeight(cleanInput, restTimeSeconds);
	if (compoundWeight.matched) {
		return withExtras(compoundWeight.data!);
	}

	// 10. Wave format
	const wave = parseWave(cleanInput, restTimeSeconds);
	if (wave.matched) {
		return withExtras(wave.data!);
	}

	// 11. Circuit "sets of" format (uses original case input)
	const circuitSetsOf = parseCircuitSetsOf(remainingInput, cleanInput, restTimeSeconds);
	if (circuitSetsOf.matched) {
		return withExtras(circuitSetsOf.data!);
	}

	// 12. Circuit "x" format (uses original case input)
	const circuitX = parseCircuitX(remainingInput, cleanInput, restTimeSeconds);
	if (circuitX.matched) {
		return withExtras(circuitX.data!);
	}

	// 13. RM Build format
	const rmBuild = parseRmBuild(cleanInput, restTimeSeconds);
	if (rmBuild.matched) {
		return withExtras(rmBuild.data!);
	}

	// 14. RIR without weight (less specific, checked last among RIR patterns)
	const rirWithoutWeight = parseRirWithoutWeight(cleanInput, restTimeSeconds);
	if (rirWithoutWeight.matched) {
		return withExtras(rirWithoutWeight.data!);
	}

	// Error detection for partial matches - provide helpful messages about what's missing

	// Check for "sets x reps" without weight (e.g., "5 x 5", "4x3")
	const setsRepsNoWeight = /^\d+\s*x\s*\d+(\s*\+\s*\d+)*\s*$/i;
	if (setsRepsNoWeight.test(cleanInput)) {
		return invalidResult('Missing weight. Add weight in kg (e.g., "5 x 5 @50kg") or as percentage (e.g., "5 x 5 @80%").');
	}

	// Check for "sets x reps @weight" without unit (e.g., "5 x 5 @50")
	const setsRepsWeightNoUnit = /^\d+\s*x\s*\d+(\s*\+\s*\d+)*\s*@\s*[\d.\-\s]+$/i;
	if (setsRepsWeightNoUnit.test(cleanInput)) {
		return invalidResult('Missing weight unit. Add "kg" or "%" after the weight (e.g., "@50kg" or "@80%").');
	}

	// Check for multiple weights-like patterns that failed validation
	const multipleWeightsLikePattern = /^\d+\s*x\s*\d+\s*@\s*[\d\s]+/i;
	if (multipleWeightsLikePattern.test(cleanInput)) {
		return invalidResult('Invalid weight values. Please use numbers only.');
	}

	// Check for wave-like patterns without unit (e.g., "3-2-1 65", "3-2-1@65")
	const waveNoUnit = /^\d+(-\d+)+(?:\s+|@)[\d.,\s]+$/i;
	if (waveNoUnit.test(cleanInput)) {
		return invalidResult('Missing weight unit. Add "kg" or "%" after the weight (e.g., "3-2-1 65kg" or "3-2-1 80%").');
	}

	// Check for wave-like patterns that failed validation
	const waveLikePattern = /^[\d\-\s]+[\d\.]+/i;
	if (waveLikePattern.test(cleanInput)) {
		return invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg"). Unit is required.');
	}

	// Check for wave-like patterns with non-numeric characters
	const waveWithNonNumericPattern = /^[\d\-\s]*[a-zA-Z][\d\-\s]*[\d\.]+/i;
	if (waveWithNonNumericPattern.test(cleanInput)) {
		return invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg"). Unit is required.');
	}

	// Check for any pattern that looks like wave but failed validation
	const anyWaveLikePattern = /^[\d\-\s]*[a-zA-Z][\d\-\s]*\d+/i;
	if (anyWaveLikePattern.test(cleanInput)) {
		return invalidResult('Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg"). Unit is required.');
	}

	// If we get here, none of the patterns matched
	return invalidResult(
		'Unrecognized format. Examples: "3 x 5 @50kg", "4 x 3 @80%", "3-2-1 65kg", "Build to 8RM".',
	);
}
