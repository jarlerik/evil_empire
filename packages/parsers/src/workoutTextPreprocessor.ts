/**
 * Workout Text Preprocessor
 *
 * Splits free-form pasted workout text (multi-line, multi-block) into a list of
 * `PreprocessedBlock`s — each representing one exercise's name, set-spec, and notes.
 *
 * The preprocessor's job is to bridge the gap between the kind of text users paste
 * from other apps (multi-line, often with stray header lines and non-numeric
 * intensity descriptors) and the single-line + optional notes shape that
 * `parseSetInput` expects.
 *
 * It does NOT call `parseSetInput`. The caller (typically `parseWorkoutText`)
 * feeds `setSpecLine` into the parser and combines the results.
 */


const LIGHT_WEIGHT_PERCENTAGE = 60;

export interface PreprocessedBlock {
	/** Original block text exactly as the user pasted it (for "edit raw" UI fallback). */
	rawText: string;
	/** Best guess at the exercise name. May be empty if no name line was present. */
	suggestedName: string;
	/**
	 * The set-spec line, ready to feed to `parseSetInput`.
	 * Token rewrites already applied (e.g. `@light weight` → `@60%`).
	 * Empty string when `parseError === 'no_set_spec'`.
	 */
	setSpecLine: string;
	/** Lines after the set-spec, joined with `\n`. Undefined when none. */
	notesText?: string;
	/** Set when no set-spec line could be detected in this block. */
	parseError?: 'no_set_spec';
}

// Matches "<digits>[space]x[space]<digit>" — the universal sets-x-reps shape.
// Tolerates "4x3", "4 x 3", "4 × 3" (unicode multiplication sign), case-insensitive.
const SET_SPEC_REGEX = /\b\d+\s*[x×]\s*\d/i;

// Inline separators between name and set-spec on a single line. Tried in order;
// each requires whitespace placement that avoids common false positives:
// - em/en dash and ASCII hyphen require surrounding whitespace (preserves "T-bar row")
// - colon requires only trailing whitespace ("Squat: 5 x 5 @100kg")
const INLINE_SEPARATOR_REGEXES: RegExp[] = [
	/^(.+?)\s+[—–]\s+(.+)$/,
	/^(.+?)\s-\s(.+)$/,
	/^(.+?):\s+(.+)$/,
];

// Strip a trailing separator that can hang off a name line (e.g. "Snatch:" → "Snatch").
const TRAILING_SEPARATOR_REGEX = /[—–\-:]\s*$/;

function trySplitInline(line: string): { name: string; spec: string } | null {
	for (const re of INLINE_SEPARATOR_REGEXES) {
		const m = line.match(re);
		if (m) {
			return { name: m[1].trim(), spec: m[2].trim() };
		}
	}
	return null;
}

/**
 * Apply token rewrites to a set-spec line so the existing parsers can handle it.
 *
 * Currently:
 * - `@light` / `@light weight` → `@60%` (per design decision; treat as a default-light prescription)
 *
 * `of 1RM` is intentionally NOT rewritten here — `parseSetInput` already strips it
 * globally so all parsers benefit.
 */
function rewriteSetSpec(line: string): string {
	return line.replace(/@\s*light(?:\s*weight)?\b/gi, `@${LIGHT_WEIGHT_PERCENTAGE}%`).trim();
}

function stripTrailingSeparator(line: string): string {
	return line.replace(TRAILING_SEPARATOR_REGEX, '').trim();
}

function processBlock(blockText: string): PreprocessedBlock {
	const lines = blockText
		.split('\n')
		.map(l => l.trim())
		.filter(l => l.length > 0);

	// Single-line block: try inline-separator split first (e.g. "Squat — 5 x 5 @100kg").
	if (lines.length === 1) {
		const line = lines[0];
		const inline = trySplitInline(line);
		// Only treat as name + spec if the right side has a set-spec and the left side doesn't
		if (inline && SET_SPEC_REGEX.test(inline.spec) && !SET_SPEC_REGEX.test(inline.name)) {
			return {
				rawText: blockText,
				suggestedName: stripTrailingSeparator(inline.name),
				setSpecLine: rewriteSetSpec(inline.spec),
			};
		}

		if (SET_SPEC_REGEX.test(line)) {
			return {
				rawText: blockText,
				suggestedName: '',
				setSpecLine: rewriteSetSpec(line),
			};
		}

		return {
			rawText: blockText,
			suggestedName: line,
			setSpecLine: '',
			parseError: 'no_set_spec',
		};
	}

	// Multi-line: find the first line that looks like a set spec.
	const setSpecIdx = lines.findIndex(l => SET_SPEC_REGEX.test(l));

	if (setSpecIdx === -1) {
		return {
			rawText: blockText,
			suggestedName: lines.join(' '),
			setSpecLine: '',
			parseError: 'no_set_spec',
		};
	}

	const nameLines = lines.slice(0, setSpecIdx);
	const noteLines = lines.slice(setSpecIdx + 1);
	const suggestedName = stripTrailingSeparator(nameLines.join(' '));
	const notesText = noteLines.length > 0 ? noteLines.join('\n') : undefined;

	return {
		rawText: blockText,
		suggestedName,
		setSpecLine: rewriteSetSpec(lines[setSpecIdx]),
		...(notesText !== undefined && { notesText }),
	};
}

/**
 * Split free-form pasted workout text into one block per exercise.
 *
 * Block boundary heuristic: blank line(s). Within a block:
 * - Find the first line containing a sets-x-reps pattern → set-spec line.
 * - Lines before it → suggestedName (joined with spaces).
 * - Lines after it → notesText (joined with newlines).
 * - Apply token rewrites to the set-spec line (e.g. `@light weight` → `@60%`).
 *
 * Blocks that contain no set-spec (e.g. workout headers like "Snatch WORKOUT")
 * are returned with `parseError: 'no_set_spec'` so the UI can either skip them
 * or surface them for manual editing.
 *
 * @param raw - The full pasted text, possibly containing multiple blocks.
 * @returns One `PreprocessedBlock` per non-empty block, in source order. Returns
 * an empty array for empty input.
 */
export function preprocessWorkoutText(raw: string): PreprocessedBlock[] {
	if (!raw || !raw.trim()) {
		return [];
	}

	return raw
		.split(/\n\s*\n+/)
		.map(b => b.trim())
		.filter(b => b.length > 0)
		.map(processBlock);
}
