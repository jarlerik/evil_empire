---
title: Stats View - Exercise History Visualization
type: note
permalink: evil-empire/ideas/stats-view-exercise-history-visualization
tags:
- idea
- stats
- visualization
- post-mvp
- charts
---

# Stats View - Exercise History Visualization

![[Pasted image 20260313084852.png]]

Post-MVP idea for a per-exercise stats screen showing workout history with a unique visual approach.

## The Concept

A stats screen filtered to a single exercise (e.g., "Clean") that combines two visualizations:

### 1. Waffle/Grid Chart (Reps Visualization)
- Each workout session shows a **grid** where each small square = 1 repetition
- Squares are grouped into columns by set, making the set structure immediately visible
- Example: `5 x 3` = 5 columns of 3 squares; `3 x 2 + 1` = 3 columns of 3 squares (2 dark + 1 lighter for compound)
- Different shading could represent compound reps, different weights, or intensity zones
- X-axis labels show the exercise name variant for that session (e.g., "Power clean + clean", "Clean deadlift")

### 2. Volume Trend Line (overlaid)
- A line chart overlaid on top of the grid showing **total session volume** (sets × reps × weight)
- Example: `5 x 3 x 83kg = 1,245kg` volume
- Each data point sits above its corresponding waffle grid
- **PR markers** (trophy icon) highlight personal records on the trend line — e.g., heaviest single, highest volume session

## Technical Considerations

### Data Availability (what we have today)
- **exercise_phases** table has all needed fields: `sets`, `repetitions`, `weight`, `weights[]`, `compound_reps[]`, `exercise_type`
- **repetition_maximums** table tracks PRs by exercise name + reps + date
- Volume calculation is straightforward for standard sets: `sets × reps × weight`
- Compound sets need special handling: `sets × sum(compound_reps) × weight`
- Wave sets: each rep count in the wave × weight
- Multiple weights (`weights[]`): sum each set's volume individually

### What's Missing / Needs Building

#### 1. Exercise Family/Grouping System (MAJOR)
- Currently exercises are **flat strings** with no taxonomy
- The mockup groups "Clean", "Power clean + clean", "Clean deadlift", "Muscle clean + OHS" together
- **Options to consider:**
  - **Manual tagging**: User assigns exercises to families — flexible but tedious
  - **Keyword-based heuristic**: Auto-detect "clean" in exercise names → group under "Clean" family. Simple but fragile
  - **Exercise library with families**: Predefined exercise database with parent-child relationships. Most robust but significant effort
  - **AI-assisted grouping**: Use LLM to classify exercise names into families. Cool but adds dependency
- **Recommendation**: Start with keyword-based heuristic + allow user override. Add a `exercise_family` column to exercises table later

#### 2. Charting Library (MAJOR)
- **No charting library currently installed**
- Options for React Native:
  - **react-native-skia + d3**: Most flexible, best for custom visualizations like the waffle grid. Skia is a 2D graphics engine. Best fit for the unique waffle chart.
  - **victory-native**: Built on Skia, good for standard charts but waffle grid would need custom implementation
  - **react-native-gifted-charts**: Simpler API, bar/line/pie charts. Waffle grid not supported natively.
- **Recommendation**: `@shopify/react-native-skia` + `d3` for full control. The waffle grid is non-standard enough to need a canvas-level API. Victory-native could work for the volume trend line overlay.

#### 3. Volume Calculation Service (MODERATE)
- Need a service that calculates volume per exercise per workout
- Must handle all exercise types: standard, compound, wave, percentage-based, RM builds
- Percentage-based exercises need RM lookup to resolve actual weight
- RM build exercises ("Build to 8RM") don't have a fixed weight — need to decide how to handle (exclude? use the RM value?)

#### 4. PR Detection Logic (MODERATE)
- Need to identify volume PRs across workout history
- Could also track: heaviest weight PR, most reps PR, best estimated 1RM
- `repetition_maximums` table already tracks weight PRs per rep count
- Volume PRs would be a new concept — could add to same table or compute on the fly

#### 5. Data Query Performance (LOW for now)
- Querying all exercise_phases for a given exercise name across all workouts
- Will need a JOIN: workouts → exercises → exercise_phases, filtered by exercise name
- With exercise families, the filter becomes more complex (family lookup)
- Consider: Supabase RPC function for the aggregated query, or compute client-side for MVP

### Visual Design Considerations
- The waffle grid is the hero element — it's what makes this unique vs. every other fitness app's line chart
- Color coding options: intensity zones (light for warmup, dark for working sets), or gradient by weight
- Compound reps could use split-color squares (e.g., `2 + 1` = 2 dark + 1 lighter in same column)
- Wave sets naturally create a descending staircase pattern in the grid — visually satisfying
- Mobile viewport is narrow — need to handle horizontal scrolling for many workouts, or limit visible history

### Current Limitations
1. **No exercise taxonomy** — the biggest gap. Without grouping, stats view only works for exact name matches
2. **No charting infrastructure** — need to add a graphics library (adds bundle size)
3. **Percentage-based exercises** need RM context to calculate actual volume
4. **Free-form exercise names** mean typos create separate exercise histories (e.g., "Clean" vs "clean" vs "Cleans")
5. **No workout execution tracking of actual weights** — if user modifies weights during workout execution, we may not capture the actual performed weight vs. planned weight

### Implementation Phases (when ready)
1. **Phase 1**: Volume calculation service + simple line chart (volume over time for exact exercise name match)
2. **Phase 2**: Waffle grid visualization with Skia
3. **Phase 3**: Exercise family grouping (keyword heuristic)
4. **Phase 4**: PR detection + trophy markers
5. **Phase 5**: Exercise name normalization / fuzzy matching
## Grouping Discussion (2026-03-13)

User confirms exercises need to be grouped by "family" (e.g., all clean variants under "Clean"). 

**Leading approach**: Hybrid — auto-suggest family via keyword match, let user confirm/override. Substring matching works well for weightlifting where the root word (clean, snatch, squat, deadlift) is almost always in the exercise name. Add user override for edge cases.