# Running Supabase Migrations

This guide explains how to run database migrations for your new Supabase project.

## Prerequisites

Before running migrations, ensure you have:
1. Created a new Supabase project
2. Updated your `.env` file with the new project credentials:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Method 1: Using Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

### Step 3: Link Your Project

```bash
supabase link --project-ref <your-project-ref>
```

You can find your project reference ID in the Supabase dashboard:
- Go to your project settings
- Look for "Reference ID" in the project information

### Step 4: Run Migrations

```bash
# Push all migrations to the remote database
supabase db push
```

Or use the provided script:

```bash
chmod +x scripts/run-migrations.sh
./scripts/run-migrations.sh
```

## Method 2: Using Supabase Dashboard (Easiest for One-Time Setup)

### Step 1: Generate Combined Migration File

Run the script to combine all migrations:

```bash
chmod +x scripts/combine-migrations.sh
./scripts/combine-migrations.sh
```

This creates `supabase/combined-migration.sql` with all migrations in order.

### Step 2: Run in Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/combined-migration.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

## Migration Files

The migrations are located in `supabase/migrations/` and should be run in this order:

1. `20240321000000_create_exercise_phases.sql` - Creates exercise_phases table
2. `20240322000000_enable_rls_workouts.sql` - Enables RLS on workouts and exercises
3. `20240323000000_add_compound_reps.sql` - Adds compound_reps column
4. `20240324000000_add_weights_array.sql` - Adds weights array column
5. `20240326000000_remove_wave_reps.sql` - Removes deprecated wave_reps column

## Important Notes

⚠️ **Before running migrations**, ensure that your base tables (`workouts`, `exercises`) already exist in your database. If they don't, you'll need to create them first.

If you encounter errors about missing tables, you may need to:
1. Create the base schema first (workouts, exercises tables)
2. Then run these migrations

## Verifying Migrations

After running migrations, you can verify they were applied:

1. In Supabase Dashboard → **Table Editor**, check that `exercise_phases` table exists
2. In **SQL Editor**, run:
   ```sql
   SELECT * FROM exercise_phases LIMIT 1;
   ```

## Troubleshooting

### Error: "relation does not exist"
- Make sure base tables (`workouts`, `exercises`) exist before running migrations
- Check that you're connected to the correct database

### Error: "permission denied"
- Ensure you're using the correct project credentials
- Check that your Supabase project has the necessary permissions

### Migration conflicts
- If migrations have already been partially applied, you may need to manually fix conflicts
- Consider resetting the database if it's a development environment

