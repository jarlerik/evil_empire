import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const TEST_EMAIL = "j.e.malmstrom+test@gmail.com";
const TEST_PASSWORD = "password";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Training templates
// ---------------------------------------------------------------------------
interface PhaseTemplate {
  sets: number;
  repetitions: number;
  weight: number;
  exercise_type?: string;
  rest_time_seconds?: number;
  compound_reps?: number[];
  rir_min?: number;
  rir_max?: number;
  weight_min?: number;
  weight_max?: number;
  notes?: string;
}

interface ExerciseTemplate {
  name: string;
  phases: PhaseTemplate[];
}

interface WorkoutTemplate {
  name: string;
  exercises: ExerciseTemplate[];
}

// Base weights (starting point ~Sep 2025). Progression multiplier applied over time.
const TEMPLATES: WorkoutTemplate[] = [
  {
    name: "Upper A — Push Focus",
    exercises: [
      {
        name: "Bench Press",
        phases: [{ sets: 4, repetitions: 5, weight: 80, rest_time_seconds: 180 }],
      },
      {
        name: "Overhead Press",
        phases: [{ sets: 3, repetitions: 8, weight: 45, rest_time_seconds: 120 }],
      },
      {
        name: "Incline Dumbbell Press",
        phases: [{ sets: 3, repetitions: 10, weight: 28, rest_time_seconds: 90 }],
      },
      {
        name: "Cable Lateral Raise",
        phases: [{ sets: 3, repetitions: 15, weight: 7.5, rest_time_seconds: 60 }],
      },
      {
        name: "Tricep Pushdown",
        phases: [{ sets: 3, repetitions: 12, weight: 25, rest_time_seconds: 60 }],
      },
    ],
  },
  {
    name: "Lower A — Squat Focus",
    exercises: [
      {
        name: "Back Squat",
        phases: [{ sets: 4, repetitions: 5, weight: 110, rest_time_seconds: 180 }],
      },
      {
        name: "Romanian Deadlift",
        phases: [{ sets: 3, repetitions: 8, weight: 90, rest_time_seconds: 120 }],
      },
      {
        name: "Leg Press",
        phases: [{ sets: 3, repetitions: 12, weight: 180, rest_time_seconds: 120 }],
      },
      {
        name: "Leg Curl",
        phases: [{ sets: 3, repetitions: 12, weight: 40, rest_time_seconds: 60 }],
      },
      {
        name: "Calf Raise",
        phases: [{ sets: 4, repetitions: 15, weight: 60, rest_time_seconds: 60 }],
      },
    ],
  },
  {
    name: "Upper B — Pull Focus",
    exercises: [
      {
        name: "Barbell Row",
        phases: [{ sets: 4, repetitions: 6, weight: 75, rest_time_seconds: 120 }],
      },
      {
        name: "Weighted Pull-up",
        phases: [{ sets: 3, repetitions: 6, weight: 10, rest_time_seconds: 120 }],
      },
      {
        name: "Face Pull",
        phases: [{ sets: 3, repetitions: 15, weight: 15, rest_time_seconds: 60 }],
      },
      {
        name: "Dumbbell Curl",
        phases: [{ sets: 3, repetitions: 12, weight: 14, rest_time_seconds: 60 }],
      },
      {
        name: "Hammer Curl",
        phases: [{ sets: 2, repetitions: 12, weight: 12, rest_time_seconds: 60 }],
      },
    ],
  },
  {
    name: "Lower B — Deadlift Focus",
    exercises: [
      {
        name: "Deadlift",
        phases: [{ sets: 3, repetitions: 5, weight: 140, rest_time_seconds: 180 }],
      },
      {
        name: "Front Squat",
        phases: [{ sets: 3, repetitions: 6, weight: 80, rest_time_seconds: 120 }],
      },
      {
        name: "Bulgarian Split Squat",
        phases: [
          {
            sets: 3,
            repetitions: 10,
            weight: 16,
            rest_time_seconds: 90,
            weight_min: 16,
            weight_max: 20,
          },
        ],
      },
      {
        name: "Leg Extension",
        phases: [{ sets: 3, repetitions: 15, weight: 35, rest_time_seconds: 60 }],
      },
      {
        name: "Ab Wheel Rollout",
        phases: [{ sets: 3, repetitions: 12, weight: 0, rest_time_seconds: 60 }],
      },
    ],
  },
];

// Days of the week to train (Mon=1, Tue=2, Wed=3, Thu=4, Fri=5)
const TRAINING_DAYS = [1, 2, 4, 5]; // Mon, Tue, Thu, Fri

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate all training dates from startDate to endDate, following TRAINING_DAYS schedule */
function generateTrainingDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ...
    if (TRAINING_DAYS.includes(dayOfWeek)) {
      // Skip ~10% of sessions randomly to simulate missed days
      if (Math.random() > 0.1) {
        dates.push(new Date(current));
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Format date as YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Progressive overload: weight increases ~8-12% over the full period */
function progressWeight(baseWeight: number, progress: number): number {
  // progress is 0..1 over the training period
  const multiplier = 1 + progress * 0.1; // ~10% increase
  // Round to nearest 2.5 for barbell, 0.5 for small weights
  const step = baseWeight >= 20 ? 2.5 : 0.5;
  return Math.round((baseWeight * multiplier) / step) * step;
}

/** Small random variation in reps (-1 to +1) */
function varyReps(base: number): number {
  const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
  return Math.max(1, base + delta);
}

// ---------------------------------------------------------------------------
// RM progression data
// ---------------------------------------------------------------------------
interface RmEntry {
  exercise_name: string;
  reps: number;
  startWeight: number;
  endWeight: number;
}

const RM_PROGRESSIONS: RmEntry[] = [
  { exercise_name: "Back Squat", reps: 1, startWeight: 130, endWeight: 142.5 },
  { exercise_name: "Back Squat", reps: 3, startWeight: 120, endWeight: 130 },
  { exercise_name: "Bench Press", reps: 1, startWeight: 100, endWeight: 110 },
  { exercise_name: "Bench Press", reps: 3, startWeight: 92.5, endWeight: 100 },
  { exercise_name: "Deadlift", reps: 1, startWeight: 170, endWeight: 185 },
  { exercise_name: "Deadlift", reps: 3, startWeight: 155, endWeight: 170 },
  { exercise_name: "Overhead Press", reps: 1, startWeight: 57.5, endWeight: 65 },
  { exercise_name: "Overhead Press", reps: 5, startWeight: 47.5, endWeight: 52.5 },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Signing in as test user...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Signed in as ${userId}`);

  // Clean existing data
  console.log("Cleaning existing data...");
  const { error: delRm } = await supabase
    .from("repetition_maximums")
    .delete()
    .eq("user_id", userId);
  if (delRm) console.warn("  repetition_maximums delete warning:", delRm.message);

  // Delete execution logs first (they reference workouts/exercises)
  const { data: existingWorkouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId);
  if (existingWorkouts && existingWorkouts.length > 0) {
    const woIds = existingWorkouts.map((w: { id: string }) => w.id);
    const { error: delLogs } = await supabase
      .from("workout_execution_logs")
      .delete()
      .in("workout_id", woIds);
    if (delLogs) console.warn("  execution_logs delete warning:", delLogs.message);
  }

  const { error: delWo } = await supabase
    .from("workouts")
    .delete()
    .eq("user_id", userId);
  if (delWo) console.warn("  workouts delete warning:", delWo.message);

  // Generate training dates: ~Sep 2025 to today
  const startDate = new Date(2025, 8, 1); // Sep 1, 2025
  const endDate = new Date(); // today
  const trainingDates = generateTrainingDates(startDate, endDate);
  const totalDays = trainingDates.length;

  console.log(`Inserting ${totalDays} workouts...`);

  let workoutCount = 0;
  let exerciseCount = 0;
  let phaseCount = 0;
  let logCount = 0;

  for (let i = 0; i < trainingDates.length; i++) {
    const date = trainingDates[i];
    const template = TEMPLATES[i % TEMPLATES.length];
    const progress = i / trainingDates.length; // 0..1

    // Insert workout
    const { data: workout, error: woErr } = await supabase
      .from("workouts")
      .insert({
        name: template.name,
        user_id: userId,
        workout_date: formatDate(date),
      })
      .select("id")
      .single();

    if (woErr || !workout) {
      console.error(`  Failed to insert workout: ${woErr?.message}`);
      continue;
    }
    workoutCount++;

    // Insert exercises and phases
    for (const exerciseTemplate of template.exercises) {
      const { data: exercise, error: exErr } = await supabase
        .from("exercises")
        .insert({
          name: exerciseTemplate.name,
          workout_id: workout.id,
        })
        .select("id")
        .single();

      if (exErr || !exercise) {
        console.error(`  Failed to insert exercise: ${exErr?.message}`);
        continue;
      }
      exerciseCount++;

      // Insert phases
      for (const phaseTemplate of exerciseTemplate.phases) {
        const weight = progressWeight(phaseTemplate.weight, progress);
        const reps = varyReps(phaseTemplate.repetitions);

        const phaseData: Record<string, unknown> = {
          exercise_id: exercise.id,
          sets: phaseTemplate.sets,
          repetitions: reps,
          weight,
          exercise_type: phaseTemplate.exercise_type ?? "standard",
          rest_time_seconds: phaseTemplate.rest_time_seconds ?? null,
        };

        if (phaseTemplate.compound_reps) {
          phaseData.compound_reps = phaseTemplate.compound_reps;
        }
        if (phaseTemplate.rir_min != null) {
          phaseData.rir_min = phaseTemplate.rir_min;
        }
        if (phaseTemplate.rir_max != null) {
          phaseData.rir_max = phaseTemplate.rir_max;
        }
        if (phaseTemplate.weight_min != null) {
          phaseData.weight_min = progressWeight(phaseTemplate.weight_min, progress);
        }
        if (phaseTemplate.weight_max != null) {
          phaseData.weight_max = progressWeight(phaseTemplate.weight_max, progress);
        }
        if (phaseTemplate.notes) {
          phaseData.notes = phaseTemplate.notes;
        }

        const { data: phase, error: phErr } = await supabase
          .from("exercise_phases")
          .insert(phaseData)
          .select("id")
          .single();

        if (phErr || !phase) {
          console.error(`  Failed to insert phase: ${phErr?.message}`);
          continue;
        }
        phaseCount++;

        // Insert execution log so workout shows as completed
        const executedAt = new Date(date);
        executedAt.setHours(7 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60));

        const { error: logErr } = await supabase
          .from("workout_execution_logs")
          .insert({
            workout_id: workout.id,
            exercise_id: exercise.id,
            exercise_phase_id: phase.id,
            sets: phaseData.sets,
            repetitions: reps,
            weight,
            weights: phaseData.weights ?? null,
            compound_reps: phaseData.compound_reps ?? null,
            rest_time_seconds: phaseData.rest_time_seconds ?? null,
            execution_status: "completed",
            executed_at: executedAt.toISOString(),
          });

        if (logErr) {
          console.error(`  Failed to insert execution log: ${logErr.message}`);
        } else {
          logCount++;
        }
      }
    }

    // Progress indicator every 10 workouts
    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${totalDays} workouts inserted...`);
    }
  }

  // Insert repetition maximums — one entry per month
  console.log("Inserting repetition maximums...");
  let rmCount = 0;

  const months: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const rm of RM_PROGRESSIONS) {
    for (let mi = 0; mi < months.length; mi++) {
      const progress = mi / (months.length - 1 || 1);
      const weight =
        Math.round((rm.startWeight + (rm.endWeight - rm.startWeight) * progress) / 2.5) * 2.5;

      const { error: rmErr } = await supabase.from("repetition_maximums").insert({
        user_id: userId,
        exercise_name: rm.exercise_name,
        reps: rm.reps,
        weight,
        date: formatDate(months[mi]),
      });

      if (rmErr) {
        console.error(`  Failed to insert RM: ${rmErr.message}`);
        continue;
      }
      rmCount++;
    }
  }

  console.log("\nDone!");
  console.log(`  Workouts:        ${workoutCount}`);
  console.log(`  Exercises:       ${exerciseCount}`);
  console.log(`  Phases:          ${phaseCount}`);
  console.log(`  Execution logs:  ${logCount}`);
  console.log(`  RMs:             ${rmCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
