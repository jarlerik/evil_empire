export interface ParsedSetData {
	sets: number;
	reps: number;
	weight: number;
	weights?: number[]; // For multiple weights (e.g., [50, 60, 70])
	wavePhases?: Array<{sets: number, reps: number, weight: number}>; // For wave exercises
	isValid: boolean;
	errorMessage?: string; // Error message when parsing fails
	compoundReps?: number[]; // For compound exercises like "2 + 2"
	exerciseType?: 'standard' | 'circuit' | 'superset' | 'rm_build'; // Type of exercise
	notes?: string; // Free-form text for special instructions
	targetRm?: number; // Target repetition maximum for "Build to XRM" format
	rirMin?: number; // Minimum Reps in Reserve
	rirMax?: number; // Maximum Reps in Reserve (for ranges like "2-3RIR")
	circuitExercises?: Array<{reps: string, name: string}>; // Array of exercise descriptions for circuits/supersets
	weightPercentage?: number; // Percentage value (e.g., 80 for 80%)
	needsRmLookup?: boolean; // Flag indicating RM lookup is needed
	weightMin?: number; // Minimum weight for ranges (e.g., 80 for "80-85%" or 85 for "85-89kg")
	weightMax?: number; // Maximum weight for ranges (e.g., 85 for "80-85%" or 89 for "85-89kg")
	weightMinPercentage?: number; // Minimum percentage for percentage ranges (e.g., 80 for "80-85%")
	weightMaxPercentage?: number; // Maximum percentage for percentage ranges (e.g., 85 for "80-85%")
	restTimeSeconds?: number; // Rest time between sets in seconds (e.g., 120 for 2 minutes)
}

/**
 * Parses rest time from the end of input string
 * Supports formats: "120s", "2m" (requires unit to avoid conflicts with multiple weights)
 * @param input - The input string that may contain rest time at the end
 * @returns Object with restTimeSeconds and remainingInput without rest time
 */
function parseRestTime(input: string): { restTimeSeconds?: number; remainingInput: string } {
	// Pattern to match rest time at the end: requires space before number and a unit (s, m, etc.)
	// Examples: "120s", "2m", "120 s", "2 m", "2min"
	// Unit is mandatory to avoid conflicts with multiple weights format like "3 x 1 @50 60 70"
	const restTimePattern = /\s+(\d+)\s*(s|m|sec|min|seconds?|minutes?)\s*$/i;
	const match = input.match(restTimePattern);
	
	if (match) {
		const value = parseInt(match[1], 10);
		const unit = match[2]?.toLowerCase() || '';
		
		let restTimeSeconds: number;
		if (unit === 'm' || unit === 'min' || unit === 'minute' || unit === 'minutes') {
			restTimeSeconds = value * 60; // Convert minutes to seconds
		} else {
			restTimeSeconds = value; // Seconds
		}
		
		// Remove the rest time part from input
		const remainingInput = input.substring(0, match.index).trim();
		return { restTimeSeconds, remainingInput };
	}
	
	return { remainingInput: input };
}

/**
 * Parses a string input in the format "sets x reps @weight" or "sets x reps @weightkg"
 * Also supports compound exercises like "sets x reps1 + reps2 @weight"
 * @param input - The input string to parse (e.g., "4 x 3 @50kg" or "4 x 2 + 2@50kg" or "4 x 3 @50kg 120s")
 * @returns ParsedSetData object with parsed values and validity status
 */
export function parseSetInput(input: string): ParsedSetData {
	// Handle empty or whitespace-only input
	if (!input || !input.trim()) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Please enter a valid format (e.g., "3 x 5 @50kg")'
		};
	}

	// Parse rest time from the end of input
	const { restTimeSeconds, remainingInput } = parseRestTime(input.trim());
	
	// Remove any extra spaces and convert to lowercase for easier parsing
	const cleanInput = remainingInput.toLowerCase();
	
	// Pattern 0a: Compound format with percentage "sets x reps1 + reps2 (+ reps3 ...) @percentage%"
	// Also support RIR: "sets x reps1 + reps2 (+ reps3 ...) @RIRRIR"
	const compoundPercentagePattern = /^([1-9]\d*)\s*x\s*((?:[1-9]\d*)(?:\s*\+\s*[1-9]\d*)+)\s*@\s*(\d+(?:\.\d+)?)\s*(%|rir)$/i;
	const compoundPercentageMatch = cleanInput.match(compoundPercentagePattern);
	
	if (compoundPercentageMatch) {
		const sets = parseInt(compoundPercentageMatch[1]);
		const repsSequence = compoundPercentageMatch[2];
		const value = parseFloat(compoundPercentageMatch[3]);
		const unit = compoundPercentageMatch[4]?.toLowerCase() || '';
		
		const repsParts = repsSequence
			.split('+')
			.map(r => r.trim())
			.map(r => parseInt(r, 10))
			.filter(r => !isNaN(r) && r > 0);
		
		if (repsParts.length >= 2) {
			const totalReps = repsParts.reduce((sum, r) => sum + r, 0);
			
			if (unit === '%') {
				// Validate percentage is between 0 and 100
				if (value <= 0 || value > 100) {
					return {
						sets: 0,
						reps: 0,
						weight: 0,
						isValid: false,
						errorMessage: 'Percentage must be between 0 and 100'
					};
				}
				
				return {
					sets,
					reps: totalReps, // Total reps for display
					weight: 0, // Will be calculated after RM lookup
					isValid: true,
					weightPercentage: value,
					needsRmLookup: true,
					compoundReps: repsParts,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			} else if (unit === 'rir') {
				// RIR format for compound exercises
				return {
					sets,
					reps: totalReps, // Total reps for display
					weight: 0,
					isValid: true,
					exerciseType: 'standard',
					compoundReps: repsParts,
					rirMin: value,
					rirMax: value,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			}
		}
	}
	
	// Pattern 0b: Percentage range format "sets x reps@80-85%" - check this BEFORE simple percentage
	const percentageRangePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%$/i;
	const percentageRangeMatch = cleanInput.match(percentageRangePattern);
	
	if (percentageRangeMatch) {
		const sets = parseInt(percentageRangeMatch[1]);
		const reps = parseInt(percentageRangeMatch[2]);
		const minPercentage = parseFloat(percentageRangeMatch[3]);
		const maxPercentage = parseFloat(percentageRangeMatch[4]);
		
		// Validate percentages are between 0 and 100
		if (minPercentage <= 0 || minPercentage > 100 || maxPercentage <= 0 || maxPercentage > 100) {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Percentage must be between 0 and 100'
			};
		}
		
		// Validate min <= max
		if (minPercentage > maxPercentage) {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Minimum percentage must be less than or equal to maximum percentage'
			};
		}
		
		return {
			sets,
			reps,
			weight: 0, // Will be calculated after RM lookup
			isValid: true,
			weightMinPercentage: minPercentage,
			weightMaxPercentage: maxPercentage,
			needsRmLookup: true,
			...(restTimeSeconds !== undefined && { restTimeSeconds })
		};
	}
	
	// Pattern 0c: Simple percentage or RIR format "sets x reps@80%" or "sets x reps @1RIR" - check this AFTER compound percentage and percentage range
	const percentageOrRirPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*(%|rir)$/i;
	const percentageOrRirMatch = cleanInput.match(percentageOrRirPattern);
	
	if (percentageOrRirMatch) {
		const sets = parseInt(percentageOrRirMatch[1]);
		const reps = parseInt(percentageOrRirMatch[2]);
		const value = parseFloat(percentageOrRirMatch[3]);
		const unit = percentageOrRirMatch[4]?.toLowerCase() || '';
		
		if (unit === '%') {
			// Validate percentage is between 0 and 100
			if (value <= 0 || value > 100) {
				return {
					sets: 0,
					reps: 0,
					weight: 0,
					isValid: false,
					errorMessage: 'Percentage must be between 0 and 100'
				};
			}
			
			return {
				sets,
				reps,
				weight: 0, // Will be calculated after RM lookup
				isValid: true,
				weightPercentage: value,
				needsRmLookup: true,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			};
		} else if (unit === 'rir') {
			// RIR format
			return {
				sets,
				reps,
				weight: 0,
				isValid: true,
				exerciseType: 'standard',
				rirMin: value,
				rirMax: value,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			};
		}
	}
	
	// Pattern 1a: Absolute weight range format "sets x reps@85-89kg" - check this BEFORE simple format
	// Now requires kg unit
	const weightRangePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*kg$/i;
	const weightRangeMatch = cleanInput.match(weightRangePattern);
	
	if (weightRangeMatch) {
		const sets = parseInt(weightRangeMatch[1]);
		const reps = parseInt(weightRangeMatch[2]);
		const minWeight = parseFloat(weightRangeMatch[3]);
		const maxWeight = parseFloat(weightRangeMatch[4]);
		
		// Validate weights are positive
		if (minWeight <= 0 || maxWeight <= 0) {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Weight must be positive'
			};
		}
		
		// Validate min <= max
		if (minWeight > maxWeight) {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Minimum weight must be less than or equal to maximum weight'
			};
		}
		
		return {
			sets,
			reps,
			weight: minWeight, // Use min for backward compatibility
			isValid: true,
			weightMin: minWeight,
			weightMax: maxWeight,
			...(restTimeSeconds !== undefined && { restTimeSeconds })
		};
	}
	
	// Pattern 8: Standard format with RIR - "2x 10 @50kg, 2-3RIR" or "2x 10 @50kg 2-3RIR"
	// Check this BEFORE Pattern 1 because it's more specific (requires "rir" at the end)
	// Comma is optional - supports both "4 x 6 @50kg, 1RIR" and "4 x 6 @50kg 1RIR"
	// Note: This pattern is for weight + RIR, not @weightRIR (which is handled by Pattern 0c)
	const standardWithRirPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*kg(?:,\s*|\s+)(\d+)(?:-(\d+))?\s*rir$/i;
	const standardWithRirMatch = cleanInput.match(standardWithRirPattern);
	
	if (standardWithRirMatch) {
		const sets = parseInt(standardWithRirMatch[1]);
		const reps = parseInt(standardWithRirMatch[2]);
		const weight = parseFloat(standardWithRirMatch[3]);
		const rirMin = parseInt(standardWithRirMatch[4]);
		const rirMax = standardWithRirMatch[5] ? parseInt(standardWithRirMatch[5]) : undefined;
		
		return {
			sets,
			reps,
			weight,
			isValid: true,
			exerciseType: 'standard',
			rirMin,
			rirMax: rirMax || rirMin,
			...(restTimeSeconds !== undefined && { restTimeSeconds })
		};
	}
	
	// Pattern 1: Simple format "sets x reps @weightkg" - now requires kg unit
	// Skip if input contains "rir" (handled by Pattern 8, Pattern 7, or Pattern 0c)
	if (!cleanInput.includes('rir')) {
		// First check if there are multiple numbers after @ - if so, it's likely multiple weights
		const afterAtCheck = cleanInput.substring(cleanInput.indexOf('@') + 1).trim();
		const numbersAfterAt = afterAtCheck.match(/\d+(?:\.\d+)?/g);
		const hasMultipleNumbers = numbersAfterAt && numbersAfterAt.length > 1;
		const hasKgInMiddle = /kg\s+\d/i.test(afterAtCheck);
		const hasKgAtEnd = /\d+\s*kg\s*$/i.test(afterAtCheck);
		
		// Only skip simple pattern if there are multiple numbers AND no "kg" (which indicates multiple weights)
		// Cases like "4 x 3 @50kg" should still match simple pattern
		if (!hasMultipleNumbers || hasKgInMiddle || hasKgAtEnd) {
			// Standard simple pattern - now requires "kg" unit
			// Allow optional trailing content (rest time is handled separately by parseRestTime)
			const simplePattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*kg(?:\s+.*)?$/i;
			const simpleMatch = cleanInput.match(/^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*(\d+(?:\.\d+)?)\s*kg/i);
			
			if (simpleMatch) {
				const sets = parseInt(simpleMatch[1]);
				const reps = parseInt(simpleMatch[2]);
				const weight = parseFloat(simpleMatch[3]);
				
				// Check if there's any trailing content that wasn't parsed as rest time
				// If there is, it's invalid (rest time requires unit)
				const afterKg = cleanInput.substring(cleanInput.indexOf('kg') + 2).trim();
				if (afterKg && !restTimeSeconds) {
					// There's trailing content but no valid rest time parsed
					return {
						sets: 0,
						reps: 0,
						weight: 0,
						isValid: false,
						errorMessage: 'Invalid format. Rest time requires a unit (s, m, sec, min, etc.). Use "4 x 3 @50kg 120s" or "4 x 3 @50kg 2m"'
					};
				}
				
				return {
					sets,
					reps,
					weight,
					isValid: true,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			}
		}
	}
	
	// Pattern 1b: Multiple weights format "sets x reps @weight1 weight2 weight3...kg" or "...%"
	// This pattern should only match if there are multiple space-separated numbers after @
	// and unit (kg or %) can only appear at the very end
	// Skip if input contains "rir" (handled by Pattern 8, Pattern 7, or Pattern 0c)
	if (!cleanInput.includes('rir')) {
		const multipleWeightsPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)\s*@\s*((?:\d+(?:\.\d+)?\s+)+)(?:\d+(?:\.\d+)?)\s*(kg|%)\s*$/i;
		const multipleWeightsMatch = cleanInput.match(multipleWeightsPattern);
		
		if (multipleWeightsMatch) {
			const sets = parseInt(multipleWeightsMatch[1]);
			const reps = parseInt(multipleWeightsMatch[2]);
			const unit = multipleWeightsMatch[4]?.toLowerCase() || '';
			
			// Extract all numbers after @ (before unit)
			const afterAt = cleanInput.substring(cleanInput.indexOf('@') + 1).trim();
			const beforeUnit = afterAt.replace(/\s*(kg|%)\s*$/i, '').trim();
			
			// Split by whitespace and parse
			const weightStrings = beforeUnit.split(/\s+/);
			const weights = weightStrings.map(w => parseFloat(w));
			
			// Check for empty values (NaN from empty strings or invalid numbers)
			const hasEmptyValues = weightStrings.some(w => w.trim() === '' || isNaN(parseFloat(w)));
			if (hasEmptyValues) {
				return {
					sets: 0,
					reps: 0,
					weight: 0,
					isValid: false,
					errorMessage: 'Invalid weight values. Please use numbers only.'
				};
			}
			
			// Filter out invalid weights and check if we have multiple
			const validWeights = weights.filter(w => !isNaN(w) && w > 0);
			
			// Only process as multiple weights if there are actually multiple weights
			if (validWeights.length > 1) {
				// Validate that number of weights matches number of sets
				if (validWeights.length === sets && validWeights.every(w => !isNaN(w) && w > 0)) {
					if (unit === 'kg') {
						return {
							sets,
							reps,
							weight: validWeights[0], // Keep for backward compatibility
							weights: validWeights,
							isValid: true,
							...(restTimeSeconds !== undefined && { restTimeSeconds })
						};
					} else if (unit === '%') {
						// Validate percentages are between 0 and 100
						if (validWeights.some(w => w <= 0 || w > 100)) {
							return {
								sets: 0,
								reps: 0,
								weight: 0,
								isValid: false,
								errorMessage: 'Percentage must be between 0 and 100'
							};
						}
						// For percentage multiple weights, we'll use the first one as weightPercentage
						// and store all in weights array (though this might need special handling)
						return {
							sets,
							reps,
							weight: 0, // Will be calculated after RM lookup
							weights: validWeights, // Store all percentages
							isValid: true,
							weightPercentage: validWeights[0], // Use first for backward compatibility
							needsRmLookup: true,
							...(restTimeSeconds !== undefined && { restTimeSeconds })
						};
					}
				} else if (validWeights.length !== sets) {
					return {
						sets: 0,
						reps: 0,
						weight: 0,
						isValid: false,
						errorMessage: `Expected ${sets} weights for ${sets} sets, but got ${validWeights.length}`
					};
				} else {
					return {
						sets: 0,
						reps: 0,
						weight: 0,
						isValid: false,
						errorMessage: 'Invalid weight values. Please use numbers only.'
					};
				}
			}
		}
		// If only one weight, let it fall through to simple pattern
	}
	
	// Pattern 2: Compound format with 2+ rep parts "sets x reps1 + reps2 (+ reps3 ...) @weightkg"
	// Now requires kg unit (percentage and RIR are handled by Pattern 0a)
	const compoundPattern = /^([1-9]\d*)\s*x\s*((?:[1-9]\d*)(?:\s*\+\s*[1-9]\d*)+)\s*@\s*(\d+(?:\.\d+)?)\s*kg$/i;
	const compoundMatch = cleanInput.match(compoundPattern);
	
	if (compoundMatch) {
		const sets = parseInt(compoundMatch[1]);
		const repsSequence = compoundMatch[2];
		const weight = parseFloat(compoundMatch[3]);
		
		const repsParts = repsSequence
			.split('+')
			.map(r => r.trim())
			.map(r => parseInt(r, 10))
			.filter(r => !isNaN(r) && r > 0);
		
		if (repsParts.length >= 2) {
			const totalReps = repsParts.reduce((sum, r) => sum + r, 0);
			return {
				sets,
				reps: totalReps, // Total reps for display
				weight,
				isValid: true,
				compoundReps: repsParts,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			};
		}
		
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid compound format. Use "sets x a + b + ... @weight"'
		};
	}
	
	// Pattern 3: Wave format "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")
	// Now requires unit (kg or %)
	const wavePattern = /^((?:\d+\s*\-?\s*)+)\s+(\d+(?:\.\d+)?)\s*(kg|%)$/i;
	const waveMatch = cleanInput.match(wavePattern);
	
	if (waveMatch) {
		const repsStr = waveMatch[1];
		const value = parseFloat(waveMatch[2]);
		const unit = waveMatch[3]?.toLowerCase() || '';
		
		// Validate value is positive
		if (value <= 0) {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")'
			};
		}
		
		// Parse wave reps (split by hyphens)
		const waveReps = repsStr.split('-').map(r => parseInt(r.trim()));
		
		// Validate that all reps are valid numbers
		if (waveReps.every(r => !isNaN(r) && r > 0)) {
			if (unit === 'kg') {
				// Create individual phases for each set in the wave
				const wavePhases = waveReps.map((reps) => ({
					sets: 1,
					reps,
					weight: value // All phases get the same weight
				}));
				
				return {
					sets: waveReps.length,
					reps: waveReps[0], // First rep count for backward compatibility
					weight: value,
					wavePhases,
					isValid: true,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			} else if (unit === '%') {
				// Validate percentage is between 0 and 100
				if (value <= 0 || value > 100) {
					return {
						sets: 0,
						reps: 0,
						weight: 0,
						isValid: false,
						errorMessage: 'Percentage must be between 0 and 100'
					};
				}
				
				// Create individual phases for each set in the wave
				const wavePhases = waveReps.map((reps) => ({
					sets: 1,
					reps,
					weight: 0 // Will be calculated after RM lookup
				}));
				
				return {
					sets: waveReps.length,
					reps: waveReps[0], // First rep count for backward compatibility
					weight: 0, // Will be calculated after RM lookup
					wavePhases,
					isValid: true,
					weightPercentage: value,
					needsRmLookup: true,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			}
		} else {
			return {
				sets: 0,
				reps: 0,
				weight: 0,
				isValid: false,
				errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg")'
			};
		}
	}
	
	// Pattern 4: Circuit format with "sets of" - "2 sets of 10/10 banded side step, 10 banded skated walk forward..."
	// Skip if input contains "rir" (handled by Pattern 7 or Pattern 8)
	if (!cleanInput.includes('rir')) {
		const circuitSetsOfPattern = /^([1-9]\d*)\s+sets?\s+of\s+(.+)$/i;
		const circuitSetsOfMatch = remainingInput.match(circuitSetsOfPattern);
		
		if (circuitSetsOfMatch) {
			const sets = parseInt(circuitSetsOfMatch[1]);
			const exercisesStr = circuitSetsOfMatch[2];
			
			// Parse comma-separated exercises
			const exercises = exercisesStr.split(',').map(ex => ex.trim()).filter(ex => ex.length > 0);
			const circuitExercises: Array<{reps: string, name: string}> = [];
			
			for (const exercise of exercises) {
				// Match pattern: "10/10 exercise name" or "10 exercise name"
				const exerciseMatch = exercise.match(/^(\d+(?:\/\d+)?)\s+(.+)$/);
				if (exerciseMatch) {
					circuitExercises.push({
						reps: exerciseMatch[1],
						name: exerciseMatch[2]
					});
				} else {
					// If no match, treat entire string as exercise name with no reps
					circuitExercises.push({
						reps: '',
						name: exercise
					});
				}
			}
			
			if (circuitExercises.length > 0) {
				return {
					sets,
					reps: 0, // Circuits don't have a single rep count
					weight: 0, // Circuits typically don't have weights
					isValid: true,
					exerciseType: 'circuit',
					circuitExercises,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			}
		}
	}
	
	// Pattern 5: Circuit format with "x" - "2 x 10/10 banded side step, 10 banded skated walk forward..."
	// Skip if input contains "rir" (handled by Pattern 7 or Pattern 8)
	if (!cleanInput.includes('rir')) {
		const circuitXPattern = /^([1-9]\d*)\s+x\s+(.+)$/i;
		const circuitXMatch = remainingInput.match(circuitXPattern);
		
		if (circuitXMatch) {
			const sets = parseInt(circuitXMatch[1]);
			const exercisesStr = circuitXMatch[2];
			
			// Check if this looks like a circuit (has commas and text) vs standard format (has @ and numbers)
			// Standard format would be "2 x 10 @50" which we already handled
			// Also exclude patterns that look like "4 x 3 50kg" (missing @) - these should be invalid
			const looksLikeMissingAt = /^\d+\s*\d*kg?$/i.test(exercisesStr.trim());
			if (looksLikeMissingAt) {
				// This looks like "sets x reps weight" without @, should be invalid
				// Let it fall through to error handling
			} else if (exercisesStr.includes(',') || (!exercisesStr.includes('@') && /[a-zA-Z]/.test(exercisesStr))) {
			// Parse comma-separated exercises
			const exercises = exercisesStr.split(',').map(ex => ex.trim()).filter(ex => ex.length > 0);
			const circuitExercises: Array<{reps: string, name: string}> = [];
			
			for (const exercise of exercises) {
				// Match pattern: "10/10 exercise name" or "10 exercise name"
				const exerciseMatch = exercise.match(/^(\d+(?:\/\d+)?)\s+(.+)$/);
				if (exerciseMatch) {
					circuitExercises.push({
						reps: exerciseMatch[1],
						name: exerciseMatch[2]
					});
				} else {
					// If no match, treat entire string as exercise name with no reps
					circuitExercises.push({
						reps: '',
						name: exercise
					});
				}
			}
			
			if (circuitExercises.length > 0) {
				return {
					sets,
					reps: 0, // Circuits don't have a single rep count
					weight: 0, // Circuits typically don't have weights
					isValid: true,
					exerciseType: 'circuit',
					circuitExercises,
					...(restTimeSeconds !== undefined && { restTimeSeconds })
				};
			}
		}
		}
	}
	
	// Pattern 6: RM Build format - "Build to 8RM" or "build to 8rm"
	const rmBuildPattern = /^build\s+to\s+(\d+)\s*rm$/i;
	const rmBuildMatch = cleanInput.match(rmBuildPattern);
	
	if (rmBuildMatch) {
		const targetRm = parseInt(rmBuildMatch[1]);
		
		if (targetRm > 0) {
			return {
				sets: 0, // RM builds don't have fixed sets
				reps: 0, // RM builds don't have fixed reps
				weight: 0, // Weight is built up to
				isValid: true,
				exerciseType: 'rm_build',
				targetRm,
				...(restTimeSeconds !== undefined && { restTimeSeconds })
			};
		}
	}
	
	// Pattern 7: RIR format - "2x 10, 2-3RIR" or "2x 10, 2RIR" or "2x 10 2-3RIR" or "2x 10 2RIR"
	// This can be combined with standard sets format (without weight)
	// Comma is optional - supports both "4 x 6, 1RIR" and "4 x 6 1RIR"
	// Note: RIR with weight is handled by Pattern 8 or Pattern 0c (@weightRIR)
	const rirPattern = /^([1-9]\d*)\s*x\s*([1-9]\d*)(?:,\s*|\s+)(\d+)(?:-(\d+))?\s*rir$/i;
	const rirMatch = cleanInput.match(rirPattern);
	
	if (rirMatch) {
		const sets = parseInt(rirMatch[1]);
		const reps = parseInt(rirMatch[2]);
		const rirMin = parseInt(rirMatch[3]);
		const rirMax = rirMatch[4] ? parseInt(rirMatch[4]) : undefined;
		
		return {
			sets,
			reps,
			weight: 0, // RIR format doesn't specify weight
			isValid: true,
			exerciseType: 'standard',
			rirMin,
			rirMax: rirMax || rirMin, // If no max, use min as max
			...(restTimeSeconds !== undefined && { restTimeSeconds })
		};
	}
	
	// Check for multiple weights-like patterns that failed validation (check this first)
	const multipleWeightsLikePattern = /^\d+\s*x\s*\d+\s*@\s*[\d\s]+/i;
	if (multipleWeightsLikePattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid weight values. Please use numbers only.'
		};
	}
	
	// Check for wave-like patterns that failed validation
	const waveLikePattern = /^[\d\-\s]+[\d\.]+/i;
	if (waveLikePattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg"). Unit is required.'
		};
	}
	
	// Check for wave-like patterns with non-numeric characters
	const waveWithNonNumericPattern = /^[\d\-\s]*[a-zA-Z][\d\-\s]*[\d\.]+/i;
	if (waveWithNonNumericPattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg"). Unit is required.'
		};
	}
	
	// Check for any pattern that looks like wave but failed validation
	const anyWaveLikePattern = /^[\d\-\s]*[a-zA-Z][\d\-\s]*\d+/i;
	if (anyWaveLikePattern.test(cleanInput)) {
		return {
			sets: 0,
			reps: 0,
			weight: 0,
			isValid: false,
			errorMessage: 'Invalid wave format. Use "reps1-reps2-reps3... weightkg" or "weight%" (e.g., "3-2-1-1-1 65kg"). Unit is required.'
		};
	}
	
	// If we get here, none of the patterns matched
	return {
		sets: 0,
		reps: 0,
		weight: 0,
		isValid: false,
		errorMessage: 'Invalid format. Weight unit is required (kg, %, or RIR). Use "sets x reps @weightkg" (e.g., "3 x 5 @50kg"), "sets x reps @80%" or "sets x reps @80-85%" for percentage-based weights, "sets x reps @1RIR" for RIR-based weights, "sets x reps @85-89kg" for weight ranges, "sets x reps @weight1 weight2...kg" or "...%" for multiple weights, "reps1-reps2-reps3... weightkg" or "weight%" for wave exercises, "2 x 10/10 exercise1, 10 exercise2..." for circuits, "Build to 8RM" for RM builds, "2x 10, 2-3RIR" for RIR notation, or add rest time at the end like "4 x 3 @50kg 120s" or "4 x 3 @50kg 2m" (rest time requires unit: s or m)'
	};
}

/**
 * Converts an ExercisePhase back to the input format for editing
 * @param phase - The exercise phase to convert
 * @returns A string in the input format (e.g., "3 x 5 @50kg", "3 x 2 + 2 @50kg", "3 x 1 @50 60 70", "2 x 10/10 banded side step, 10 banded skated walk forward...", "Build to 8RM", "2x 10, 2-3RIR", "4 x 3 @50kg 120s")
 */
export function reverseParsePhase(phase: {
	sets: number;
	repetitions: number;
	weight: number;
	weights?: number[];
	compound_reps?: number[];
	exercise_type?: string;
	target_rm?: number;
	rir_min?: number;
	rir_max?: number;
	circuit_exercises?: Array<{reps: string, name: string}> | string; // Can be JSONB string from DB
	weight_min?: number;
	weight_max?: number;
	weight_min_percentage?: number;
	weight_max_percentage?: number;
	rest_time_seconds?: number;
}): string {
	// Helper function to append rest time
	const appendRestTime = (str: string): string => {
		if (phase.rest_time_seconds !== undefined && phase.rest_time_seconds !== null) {
			return `${str} ${phase.rest_time_seconds}s`;
		}
		return str;
	};
	
	// Handle RM build format
	if (phase.exercise_type === 'rm_build' && phase.target_rm) {
		return appendRestTime(`Build to ${phase.target_rm}RM`);
	}
	
	// Handle circuit format
	if (phase.exercise_type === 'circuit' && phase.circuit_exercises) {
		let circuitExercises: Array<{reps: string, name: string}> = [];
		
		// Handle JSONB string from database
		if (typeof phase.circuit_exercises === 'string') {
			try {
				circuitExercises = JSON.parse(phase.circuit_exercises);
			} catch (e) {
				// If parsing fails, return a fallback
				return appendRestTime(`${phase.sets} sets of ${phase.circuit_exercises}`);
			}
		} else {
			circuitExercises = phase.circuit_exercises;
		}
		
		if (circuitExercises.length > 0) {
			const exercisesStr = circuitExercises.map(ex => {
				if (ex.reps && ex.name) {
					return `${ex.reps} ${ex.name}`;
				} else if (ex.name) {
					return ex.name;
				} else {
					return '';
				}
			}).filter(s => s.length > 0).join(', ');
			
			return appendRestTime(`${phase.sets} x ${exercisesStr}`);
		}
	}
	
	// Handle RIR format (with or without weight)
	if (phase.rir_min !== undefined && phase.rir_min !== null) {
		const rirStr = phase.rir_max && phase.rir_max !== phase.rir_min 
			? `${phase.rir_min}-${phase.rir_max}RIR`
			: `${phase.rir_min}RIR`;
		
		// If there's a weight, include it
		if (phase.weight > 0) {
			return appendRestTime(`${phase.sets} x ${phase.repetitions} @${phase.weight}kg, ${rirStr}`);
		} else {
			return appendRestTime(`${phase.sets} x ${phase.repetitions}, ${rirStr}`);
		}
	}
	
	// Handle weight ranges (absolute) - percentage ranges are converted to absolute values when stored
	if (phase.weight_min !== undefined && phase.weight_max !== undefined && phase.weight_min !== null && phase.weight_max !== null) {
		if (phase.compound_reps && phase.compound_reps.length >= 2) {
			const repsStr = phase.compound_reps.join(' + ');
			return appendRestTime(`${phase.sets} x ${repsStr} @${phase.weight_min}-${phase.weight_max}kg`);
		}
		return appendRestTime(`${phase.sets} x ${phase.repetitions} @${phase.weight_min}-${phase.weight_max}kg`);
	}
	
	// Handle compound exercises
	if (phase.compound_reps && phase.compound_reps.length >= 2) {
		const repsStr = phase.compound_reps.join(' + ');
		return appendRestTime(`${phase.sets} x ${repsStr} @${phase.weight}kg`);
	}
	
	// Handle multiple weights
	if (phase.weights && phase.weights.length > 1) {
		const weightsStr = phase.weights.map(w => w.toString()).join(' ');
		return appendRestTime(`${phase.sets} x ${phase.repetitions} @${weightsStr}`);
	}
	
	// Handle simple format
	return appendRestTime(`${phase.sets} x ${phase.repetitions} @${phase.weight}kg`);
} 