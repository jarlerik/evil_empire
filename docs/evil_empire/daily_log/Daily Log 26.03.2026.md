---
title: Daily Log 26.03.2026
type: note
permalink: evil-empire/daily-log/daily-log-26.03.2026
tags:
- daily-log
- parser
- percentage
- bugfix
---

## Allow percentage values above 100% in parser

Raised the percentage validation cap from 100% to 200% across all parsers (percentageParser, standardParser, compoundParser, waveParser). In strength training, percentages above 100% of a training max are common (e.g., `3 x 3@105-110%`). Updated tests accordingly — 427 tests passing.