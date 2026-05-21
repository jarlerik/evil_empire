import { parseSetInput } from '@evil-empire/parsers';
import type { ProgramSessionForDate } from '@evil-empire/types';
import type { MaterializeExerciseInput } from './programService';
import {
	exerciseNeedsRmSnapshot,
	resolveWeightsFromSnapshot,
	findProgramRm,
} from './resolveProgramWeights';
import { buildPhaseData } from './buildPhaseData';

export function sessionLabel(item: ProgramSessionForDate): string {
	return `${item.session.name ?? item.program.name} - W${item.session.week_offset + 1} D${item.session.day_of_week}`;
}

export type PrepareMaterializeResult =
	| { ok: true; exercises: MaterializeExerciseInput[] }
	| { ok: false; error: string };

export function prepareMaterializeInputs(
	item: ProgramSessionForDate,
	defaultRestSeconds?: number | null,
): PrepareMaterializeResult {
	const missingNames: string[] = [];
	for (const ex of item.exercises) {
		const parsed = parseSetInput(ex.raw_input);
		if (exerciseNeedsRmSnapshot(parsed) && !findProgramRm(ex.name, item.rms)) {
			missingNames.push(ex.name);
		}
	}
	if (missingNames.length > 0) {
		return {
			ok: false,
			error: `Missing 1RM snapshot for: ${missingNames.join(', ')}. Open the program to resolve.`,
		};
	}

	const exercises: MaterializeExerciseInput[] = [];
	for (let i = 0; i < item.exercises.length; i++) {
		const ex = item.exercises[i];
		const parsed = parseSetInput(ex.raw_input);
		if (!parsed.isValid) {
			return { ok: false, error: `Cannot parse "${ex.raw_input}" for ${ex.name}` };
		}

		let calculatedWeight = parsed.weight;
		let weightRange: { min: number; max: number } | undefined;

		if (exerciseNeedsRmSnapshot(parsed)) {
			const resolved = resolveWeightsFromSnapshot(ex.name, parsed, item.rms);
			calculatedWeight = resolved.weight;
			if (resolved.weightMin !== undefined && resolved.weightMax !== undefined) {
				weightRange = { min: resolved.weightMin, max: resolved.weightMax };
			}
			if (resolved.weights) {
				parsed.weights = resolved.weights;
			}
		} else if (parsed.weightMin !== undefined && parsed.weightMax !== undefined) {
			weightRange = { min: parsed.weightMin, max: parsed.weightMax };
			calculatedWeight = parsed.weightMin;
		}

		const phase = buildPhaseData('', parsed, calculatedWeight, weightRange, false, defaultRestSeconds);
		const { exercise_id: _exerciseId, ...phaseWithoutId } = phase;
		exercises.push({ name: ex.name, order_index: i, phase: phaseWithoutId });
	}

	return { ok: true, exercises };
}
