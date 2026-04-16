import { parseWorkoutText } from '../src';

describe('parseWorkoutText', () => {
	it('returns [] for empty input', () => {
		expect(parseWorkoutText('')).toEqual([]);
		expect(parseWorkoutText('   \n  ')).toEqual([]);
	});

	describe('single exercise', () => {
		it('returns a fully-parsed block for a clean spec', () => {
			const [block] = parseWorkoutText('Squat\n5 x 5 @100kg');

			expect(block.suggestedName).toBe('Squat');
			expect(block.parsed.isValid).toBe(true);
			expect(block.parsed.sets).toBe(5);
			expect(block.parsed.reps).toBe(5);
			expect(block.parsed.weight).toBe(100);
			expect(block.missing).toEqual([]);
			expect(block.notes).toBeUndefined();
		});

		it('flags a percentage-based block with missing: ["rmSource"]', () => {
			const [block] = parseWorkoutText('Snatch pull + hang power snatch\n8 x 3+3 @70-75%');

			expect(block.parsed.isValid).toBe(true);
			expect(block.parsed.needsRmLookup).toBe(true);
			expect(block.parsed.weightMinPercentage).toBe(70);
			expect(block.parsed.weightMaxPercentage).toBe(75);
			expect(block.missing).toEqual(['rmSource']);
		});

		it('rewrites @light weight → @60% and flags rmSource', () => {
			const [block] = parseWorkoutText(
				'High hang muscle snatch + push press BTN + OHS\n4 x 3+3+3 @light weight\npause in lockout',
			);

			expect(block.parsed.isValid).toBe(true);
			expect(block.parsed.weightPercentage).toBe(60);
			expect(block.parsed.compoundReps).toEqual([3, 3, 3]);
			expect(block.parsed.needsRmLookup).toBe(true);
			expect(block.notes).toBe('pause in lockout');
			expect(block.missing).toEqual(['rmSource']);
		});

		it('strips "of 1RM" suffix and parses cleanly', () => {
			const [block] = parseWorkoutText('Snatch grip DL with pause\n4 x 5 @95% of 1RM\npause at knee for 3 sec');

			expect(block.parsed.isValid).toBe(true);
			expect(block.parsed.weightPercentage).toBe(95);
			expect(block.notes).toBe('pause at knee for 3 sec');
			expect(block.missing).toEqual(['rmSource']);
		});

		it('flags an unparseable spec with missing: ["unparseable"]', () => {
			const [block] = parseWorkoutText('Some exercise\nthis is not a valid spec');

			// "this is not a valid spec" doesn't match the set-spec regex either,
			// so the preprocessor surfaces it as parseError: 'no_set_spec'.
			expect(block.parsed.isValid).toBe(false);
			expect(block.missing).toEqual(['unparseable']);
		});

		it('flags a parseable-looking but invalid spec with missing: ["unparseable"]', () => {
			// "5 x 5" matches the set-spec regex but parseSetInput rejects it (missing weight).
			const [block] = parseWorkoutText('Squat\n5 x 5');

			expect(block.parsed.isValid).toBe(false);
			expect(block.missing).toEqual(['unparseable']);
		});

		it('preserves rawText for the block', () => {
			const raw = 'Squat\n5 x 5 @100kg';
			const [block] = parseWorkoutText(raw);
			expect(block.rawText).toBe(raw);
		});
	});

	describe('full reference screenshot end-to-end', () => {
		const raw = [
			'Snatch WORKOUT',
			'Last done by Kasitonniisen Urheilijat on 9th April 2026',
			'',
			'High hang muscle snatch + push press BTN + OHS',
			'4 x 3+3+3 @light weight',
			'pause in lockout of each push press & in the bottom of OHS',
			'',
			'Snatch pull + hang power snatch',
			'8 x 3+3 @70-75%',
			'',
			'Snatch grip DL with pause',
			'4 x 5 @95% of 1RM',
			'pause at knee for 3 sec',
		].join('\n');

		it('returns 4 blocks: 1 unparseable header + 3 valid exercises', () => {
			const blocks = parseWorkoutText(raw);
			expect(blocks).toHaveLength(4);

			const [header, ex1, ex2, ex3] = blocks;

			expect(header.missing).toEqual(['unparseable']);
			expect(header.parsed.isValid).toBe(false);

			expect(ex1.suggestedName).toBe('High hang muscle snatch + push press BTN + OHS');
			expect(ex1.parsed.isValid).toBe(true);
			expect(ex1.parsed.weightPercentage).toBe(60);
			expect(ex1.parsed.compoundReps).toEqual([3, 3, 3]);
			expect(ex1.notes).toBe('pause in lockout of each push press & in the bottom of OHS');
			expect(ex1.missing).toEqual(['rmSource']);

			expect(ex2.suggestedName).toBe('Snatch pull + hang power snatch');
			expect(ex2.parsed.isValid).toBe(true);
			expect(ex2.parsed.weightMinPercentage).toBe(70);
			expect(ex2.parsed.weightMaxPercentage).toBe(75);
			expect(ex2.parsed.compoundReps).toEqual([3, 3]);
			expect(ex2.missing).toEqual(['rmSource']);

			expect(ex3.suggestedName).toBe('Snatch grip DL with pause');
			expect(ex3.parsed.isValid).toBe(true);
			expect(ex3.parsed.sets).toBe(4);
			expect(ex3.parsed.reps).toBe(5);
			expect(ex3.parsed.weightPercentage).toBe(95);
			expect(ex3.notes).toBe('pause at knee for 3 sec');
			expect(ex3.missing).toEqual(['rmSource']);
		});
	});

	describe('mixed validity in one paste', () => {
		it('returns each block independently with its own missing list', () => {
			const raw = ['Squat\n5 x 5 @100kg', 'Bench\n5 x 5 @80%', 'Deadlift\nbroken spec'].join('\n\n');
			const blocks = parseWorkoutText(raw);

			expect(blocks).toHaveLength(3);
			expect(blocks[0].missing).toEqual([]);
			expect(blocks[1].missing).toEqual(['rmSource']);
			expect(blocks[2].missing).toEqual(['unparseable']);
		});
	});
});
