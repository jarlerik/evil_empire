# Daily Log 28.04.2026

## feat(parsers,import): capture "of 1RM <exercise>" suffix and split inline multi-phase lines
Extended `parseSetInput` to capture the trailing exercise name from `@X% of 1RM <name>` into a new `rmSourceExercise` field, and taught the preprocessor to split a single line carrying multiple back-to-back set-specs (paste that lost its newlines, e.g. `1 x 3+1 @60% 2 x 2+1 @65% 5 x 1+1 @70-75%`) into one line per phase. The mobile import-workout view now pre-fills the RM picker (eager lookup, resolve handler, both modals) with the parsed source name instead of the block's own exercise name.
