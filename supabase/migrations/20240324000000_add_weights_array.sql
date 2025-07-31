-- Add weights array column to exercise_phases table
ALTER TABLE exercise_phases 
ADD COLUMN weights DECIMAL(10,2)[];

-- Add comment to explain the column
COMMENT ON COLUMN exercise_phases.weights IS 'Array of weights for each set (e.g., [50, 60, 70] for 3 sets with different weights)'; 