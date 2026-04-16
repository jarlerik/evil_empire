import { preprocessWorkoutText } from '../src/workoutTextPreprocessor';

describe('preprocessWorkoutText', () => {
	describe('empty / whitespace input', () => {
		it('returns [] for empty string', () => {
			expect(preprocessWorkoutText('')).toEqual([]);
		});

		it('returns [] for whitespace-only', () => {
			expect(preprocessWorkoutText('   \n\n  \t  ')).toEqual([]);
		});
	});

	describe('single multi-line block (typical pasted exercise)', () => {
		it('splits name / set-spec / notes from a 3-line block', () => {
			const raw = [
				'Snatch grip DL with pause',
				'4x 5 @95% of 1RM',
				'pause at knee for 3 sec',
			].join('\n');

			const [block] = preprocessWorkoutText(raw);

			expect(block.suggestedName).toBe('Snatch grip DL with pause');
			expect(block.setSpecLine).toBe('4x 5 @95% of 1RM');
			expect(block.notesText).toBe('pause at knee for 3 sec');
			expect(block.parseError).toBeUndefined();
		});

		it('rewrites "@light weight" to "@60%" on the set-spec line', () => {
			const raw = [
				'High hang muscle snatch + push press BTN + OHS',
				'4 x 3+3+3 @light weight',
				'pause in lockout of each push press & in the bottom of OHS',
			].join('\n');

			const [block] = preprocessWorkoutText(raw);

			expect(block.suggestedName).toBe('High hang muscle snatch + push press BTN + OHS');
			expect(block.setSpecLine).toBe('4 x 3+3+3 @60%');
			expect(block.notesText).toBe('pause in lockout of each push press & in the bottom of OHS');
		});

		it('also rewrites bare "@light" without "weight"', () => {
			const [block] = preprocessWorkoutText('Squat\n5 x 5 @light');
			expect(block.setSpecLine).toBe('5 x 5 @60%');
		});

		it('preserves a percentage range exactly', () => {
			const raw = ['Snatch pull + hang power snatch', '8 x 3+3 @70-75%'].join('\n');
			const [block] = preprocessWorkoutText(raw);

			expect(block.suggestedName).toBe('Snatch pull + hang power snatch');
			expect(block.setSpecLine).toBe('8 x 3+3 @70-75%');
			expect(block.notesText).toBeUndefined();
		});

		it('joins multiple note lines with newlines', () => {
			const raw = ['Bench', '5 x 5 @100kg', 'note line 1', 'note line 2'].join('\n');
			const [block] = preprocessWorkoutText(raw);
			expect(block.notesText).toBe('note line 1\nnote line 2');
		});

		it('joins multiple name lines with a space', () => {
			const raw = ['Snatch', 'grip DL', '4 x 5 @95%'].join('\n');
			const [block] = preprocessWorkoutText(raw);
			expect(block.suggestedName).toBe('Snatch grip DL');
		});

		it('strips trailing separator characters from the name', () => {
			const raw = ['Snatch grip DL —', '4 x 5 @95%'].join('\n');
			const [block] = preprocessWorkoutText(raw);
			expect(block.suggestedName).toBe('Snatch grip DL');
		});
	});

	describe('single-line block', () => {
		it('splits inline "name — spec" form on em dash', () => {
			const [block] = preprocessWorkoutText('Snatch grip DL — 4 x 5 @95%');
			expect(block.suggestedName).toBe('Snatch grip DL');
			expect(block.setSpecLine).toBe('4 x 5 @95%');
		});

		it('splits inline "name: spec" form on colon', () => {
			const [block] = preprocessWorkoutText('Squat: 5 x 5 @100kg');
			expect(block.suggestedName).toBe('Squat');
			expect(block.setSpecLine).toBe('5 x 5 @100kg');
		});

		it('splits inline "name - spec" form on hyphen with surrounding spaces', () => {
			const [block] = preprocessWorkoutText('Squat - 5 x 5 @100kg');
			expect(block.suggestedName).toBe('Squat');
			expect(block.setSpecLine).toBe('5 x 5 @100kg');
		});

		it('does NOT split on hyphen without spaces (preserves "T-bar row")', () => {
			const [block] = preprocessWorkoutText('T-bar row\n4 x 8 @60kg');
			expect(block.suggestedName).toBe('T-bar row');
			expect(block.setSpecLine).toBe('4 x 8 @60kg');
		});

		it('treats a bare set-spec line as a block with empty name', () => {
			const [block] = preprocessWorkoutText('4 x 5 @100kg');
			expect(block.suggestedName).toBe('');
			expect(block.setSpecLine).toBe('4 x 5 @100kg');
			expect(block.parseError).toBeUndefined();
		});

		it('flags a single line with no set-spec as parseError', () => {
			const [block] = preprocessWorkoutText('Snatch WORKOUT');
			expect(block.parseError).toBe('no_set_spec');
			expect(block.suggestedName).toBe('Snatch WORKOUT');
			expect(block.setSpecLine).toBe('');
		});
	});

	describe('multiple blocks separated by blank lines', () => {
		it('splits two blocks on a single blank line', () => {
			const raw = ['Squat', '5 x 5 @100kg', '', 'Bench', '5 x 5 @80kg'].join('\n');
			const blocks = preprocessWorkoutText(raw);
			expect(blocks).toHaveLength(2);
			expect(blocks[0].suggestedName).toBe('Squat');
			expect(blocks[1].suggestedName).toBe('Bench');
		});

		it('splits on multiple blank lines too', () => {
			const raw = 'Squat\n5 x 5 @100kg\n\n\n\nBench\n5 x 5 @80kg';
			expect(preprocessWorkoutText(raw)).toHaveLength(2);
		});

		it('preserves source order', () => {
			const raw = ['A\n1 x 1 @1kg', 'B\n2 x 2 @2kg', 'C\n3 x 3 @3kg'].join('\n\n');
			const names = preprocessWorkoutText(raw).map(b => b.suggestedName);
			expect(names).toEqual(['A', 'B', 'C']);
		});
	});

	describe('full reference screenshot (Snatch session, 1 header + 3 exercises)', () => {
		// Verbatim representation of the workout post the user pasted. The first
		// block is workout-level metadata with no set-spec; the next three are
		// real exercises.
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

		it('produces 4 blocks total', () => {
			expect(preprocessWorkoutText(raw)).toHaveLength(4);
		});

		it('flags the workout-header block as no_set_spec', () => {
			const [header] = preprocessWorkoutText(raw);
			expect(header.parseError).toBe('no_set_spec');
		});

		it('extracts the three real exercises with correct names and rewritten specs', () => {
			const [, ex1, ex2, ex3] = preprocessWorkoutText(raw);

			expect(ex1).toMatchObject({
				suggestedName: 'High hang muscle snatch + push press BTN + OHS',
				setSpecLine: '4 x 3+3+3 @60%',
				notesText: 'pause in lockout of each push press & in the bottom of OHS',
			});
			expect(ex1.parseError).toBeUndefined();

			expect(ex2).toMatchObject({
				suggestedName: 'Snatch pull + hang power snatch',
				setSpecLine: '8 x 3+3 @70-75%',
			});
			expect(ex2.notesText).toBeUndefined();
			expect(ex2.parseError).toBeUndefined();

			expect(ex3).toMatchObject({
				suggestedName: 'Snatch grip DL with pause',
				setSpecLine: '4 x 5 @95% of 1RM',
				notesText: 'pause at knee for 3 sec',
			});
			expect(ex3.parseError).toBeUndefined();
		});
	});

	describe('rawText preservation', () => {
		it('preserves the original block text on rawText', () => {
			const raw = 'Squat\n5 x 5 @100kg\nslow eccentric';
			const [block] = preprocessWorkoutText(raw);
			expect(block.rawText).toBe(raw);
		});
	});
});
