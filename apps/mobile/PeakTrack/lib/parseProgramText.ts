import { parseSetInput } from '@evil-empire/parsers';

export interface ParsedPlanSession {
	/** `raw_input` for the session's single exercise, e.g. "6 x 2@80%". */
	rawInput: string;
	/** Optional name override. Undefined → caller falls back to program name. */
	name?: string;
}

export interface ParsedPlanWeek {
	/** 1-indexed in the source text for error reporting. */
	weekNumber: number;
	sessions: ParsedPlanSession[];
}

export interface ParsedPlan {
	/** Sessions per week declared in the `## N x week` header, or null when absent. */
	sessionsPerWeek: number | null;
	weeks: ParsedPlanWeek[];
	/** Human-readable issues; does not block saving if weeks were parseable. */
	warnings: string[];
	/** Hard errors — set spec lines that could not be parsed. Block save. */
	errors: string[];
}

const SESSIONS_PER_WEEK_HEADER = /^##\s*(\d+)\s*x\s*week\s*$/i;
const NAME_PREFIX = /^([^:]{1,60}):\s*(.+)$/;

/**
 * Parse a free-form program plan.
 *
 * Grammar:
 * - Optional first line `## N x week` declares how many sessions per week.
 * - Blocks separated by blank lines are weeks, in order.
 * - Each non-blank line in a block is one session (one exercise).
 * - A session line may optionally be prefixed with `name: ` to override
 *   the default exercise name (which the caller supplies, typically the
 *   program name).
 *
 * Validation returns:
 * - `errors` when a session line fails `parseSetInput` — these block save.
 * - `warnings` when a week has ≠ `sessionsPerWeek` lines.
 */
export function parseProgramText(text: string): ParsedPlan {
	const warnings: string[] = [];
	const errors: string[] = [];

	// Split on any run of blank lines.
	const rawLines = text.replace(/\r\n/g, '\n').split('\n');

	let sessionsPerWeek: number | null = null;

	// Look for the header on the first non-blank line.
	let headerIndex = -1;
	for (let i = 0; i < rawLines.length; i++) {
		if (rawLines[i].trim().length === 0) {
			continue;
		}
		const m = rawLines[i].match(SESSIONS_PER_WEEK_HEADER);
		if (m) {
			const n = parseInt(m[1], 10);
			if (n >= 1 && n <= 7) {
				sessionsPerWeek = n;
				headerIndex = i;
			}
		}
		break;
	}

	const bodyLines = headerIndex >= 0 ? rawLines.slice(headerIndex + 1) : rawLines;

	// Group consecutive non-blank lines into blocks.
	const blocks: string[][] = [];
	let current: string[] = [];
	for (const line of bodyLines) {
		if (line.trim().length === 0) {
			if (current.length > 0) {
				blocks.push(current);
				current = [];
			}
			continue;
		}
		current.push(line);
	}
	if (current.length > 0) {
		blocks.push(current);
	}

	const weeks: ParsedPlanWeek[] = [];
	for (let weekIdx = 0; weekIdx < blocks.length; weekIdx++) {
		const lines = blocks[weekIdx];
		const sessions: ParsedPlanSession[] = [];
		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			const trimmed = lines[lineIdx].trim();
			if (trimmed.length === 0) {
				continue;
			}
			let name: string | undefined;
			let spec = trimmed;
			const match = NAME_PREFIX.exec(trimmed);
			if (match) {
				const candidateName = match[1].trim();
				const candidateSpec = match[2].trim();
				// Only treat as name:spec if the remainder parses; otherwise
				// assume the colon was part of the spec (rare but possible).
				if (parseSetInput(candidateSpec).isValid) {
					name = candidateName;
					spec = candidateSpec;
				}
			}
			const parsed = parseSetInput(spec);
			if (!parsed.isValid) {
				errors.push(
					`Week ${weekIdx + 1} line ${lineIdx + 1}: ${parsed.errorMessage ?? 'could not parse'} (${spec})`,
				);
				continue;
			}
			sessions.push({ rawInput: spec, ...(name && { name }) });
		}

		if (sessions.length === 0) {
			continue; // drop entirely empty blocks (e.g. multiple blank lines)
		}

		if (sessionsPerWeek !== null && sessions.length !== sessionsPerWeek) {
			warnings.push(
				`Week ${weekIdx + 1} has ${sessions.length} session${sessions.length === 1 ? '' : 's'}; header declares ${sessionsPerWeek}/week.`,
			);
		}

		weeks.push({ weekNumber: weekIdx + 1, sessions });
	}

	// If no header, infer sessions/week from the most common block length.
	if (sessionsPerWeek === null && weeks.length > 0) {
		const counts = new Map<number, number>();
		for (const w of weeks) {
			counts.set(w.sessions.length, (counts.get(w.sessions.length) ?? 0) + 1);
		}
		let best = 0;
		let bestCount = 0;
		for (const [len, c] of counts.entries()) {
			if (c > bestCount) {
				best = len;
				bestCount = c;
			}
		}
		if (best >= 1 && best <= 7) {
			sessionsPerWeek = best;
		}
	}

	return { sessionsPerWeek, weeks, warnings, errors };
}

/**
 * Default day-of-week (1=Mon … 7=Sun) for the i-th session in a week, given
 * N total sessions per week. Matches common block-periodization splits.
 */
export function defaultDayForSession(sessionIndex: number, sessionsPerWeek: number): number {
	const table: Record<number, number[]> = {
		1: [1],
		2: [1, 4],
		3: [1, 3, 5],
		4: [1, 2, 4, 5],
		5: [1, 2, 3, 4, 5],
		6: [1, 2, 3, 4, 5, 6],
		7: [1, 2, 3, 4, 5, 6, 7],
	};
	const days = table[sessionsPerWeek] ?? [1];
	return days[sessionIndex] ?? days[days.length - 1];
}

interface SerializeSessionInput {
	week_offset: number;
	day_of_week: number;
	exercises: Array<{ name: string; raw_input: string }>;
}

/**
 * Reverse-parse existing sessions back into the free-form text format.
 * Sessions are grouped by week_offset (ascending) and sorted within a week
 * by day_of_week. When every exercise name equals `defaultName`, the
 * `name:` prefix is omitted for readability.
 */
export function serializeProgramText(
	sessions: SerializeSessionInput[],
	defaultName: string,
): string {
	if (sessions.length === 0) {
		return '';
	}

	const byWeek = new Map<number, SerializeSessionInput[]>();
	for (const s of sessions) {
		const list = byWeek.get(s.week_offset) ?? [];
		list.push(s);
		byWeek.set(s.week_offset, list);
	}

	const maxWeek = Math.max(...Array.from(byWeek.keys()));
	// Derive sessionsPerWeek from the most-populated week.
	let sessionsPerWeek = 0;
	for (const list of byWeek.values()) {
		if (list.length > sessionsPerWeek) {
			sessionsPerWeek = list.length;
		}
	}

	// Every exercise name case-insensitively equal to defaultName?
	const defaultLower = defaultName.trim().toLowerCase();
	let allDefault = true;
	for (const s of sessions) {
		for (const ex of s.exercises) {
			if (ex.name.trim().toLowerCase() !== defaultLower) {
				allDefault = false;
				break;
			}
		}
		if (!allDefault) {
			break;
		}
	}

	const out: string[] = [];
	if (sessionsPerWeek > 0) {
		out.push(`## ${sessionsPerWeek} x week`);
		out.push('');
	}

	for (let week = 0; week <= maxWeek; week++) {
		const weekSessions = (byWeek.get(week) ?? [])
			.slice()
			.sort((a, b) => a.day_of_week - b.day_of_week);
		if (weekSessions.length === 0) {
			out.push(''); // preserve blank week placeholders
			out.push('');
			continue;
		}
		for (const sess of weekSessions) {
			// Take the first exercise; multi-exercise sessions are represented
			// by one line here — editing in the plan text collapses them.
			const ex = sess.exercises[0];
			if (!ex) {
				continue;
			}
			const line = allDefault ? ex.raw_input : `${ex.name}: ${ex.raw_input}`;
			out.push(line);
		}
		out.push('');
	}

	// Trim trailing blanks
	while (out.length > 0 && out[out.length - 1] === '') {
		out.pop();
	}
	return out.join('\n');
}
