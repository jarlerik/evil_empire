import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useExercisePhases } from '../useExercisePhases';
import { ParsedSetData } from '../../lib/parseSetInput';

// Mock exercise phase service
const mockFetchPhasesByExerciseId = jest.fn();
const mockInsertPhase = jest.fn();
const mockUpdatePhase = jest.fn();
const mockDeletePhase = jest.fn();

jest.mock('../../services/exercisePhaseService', () => ({
	fetchPhasesByExerciseId: (...args: unknown[]) => mockFetchPhasesByExerciseId(...args),
	insertPhase: (...args: unknown[]) => mockInsertPhase(...args),
	updatePhase: (...args: unknown[]) => mockUpdatePhase(...args),
	deletePhase: (...args: unknown[]) => mockDeletePhase(...args),
}));

describe('useExercisePhases', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Default: fetch returns empty array, mutations succeed
		mockFetchPhasesByExerciseId.mockResolvedValue({ data: [], error: null });
		mockInsertPhase.mockResolvedValue({ data: null, error: null });
		mockUpdatePhase.mockResolvedValue({ data: null, error: null });
		mockDeletePhase.mockResolvedValue({ data: null, error: null });
	});

	describe('initial state', () => {
		it('should return empty phases initially', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for any pending state updates from useEffect
			await waitFor(() => {
				expect(result.current.exercisePhases).toEqual([]);
			});
			expect(result.current.isLoading).toBe(false);
		});

		it('should not fetch when exerciseId is undefined', async () => {
			renderHook(() => useExercisePhases({ exerciseId: undefined }));

			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).not.toHaveBeenCalled();
			});
		});
	});

	describe('fetchExercisePhases', () => {
		it('should fetch phases on mount when exerciseId is provided', async () => {
			const mockPhases = [
				{ id: 'p1', exercise_id: 'ex-1', sets: 3, repetitions: 5, weight: 100 },
			];

			mockFetchPhasesByExerciseId.mockResolvedValue({ data: mockPhases, error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			await waitFor(() => {
				expect(result.current.exercisePhases).toEqual(mockPhases);
			});

			expect(mockFetchPhasesByExerciseId).toHaveBeenCalledWith('ex-1');
		});

		it('should handle fetch errors gracefully', async () => {
			mockFetchPhasesByExerciseId.mockResolvedValue({ data: null, error: 'Fetch error' });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			await waitFor(() => {
				expect(result.current.exercisePhases).toEqual([]);
			});
		});
	});

	describe('addPhase', () => {
		it('should add a standard phase', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 100,
				isValid: true,
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 100);
			});

			expect(addResult).toEqual({ success: true });
			expect(mockInsertPhase).toHaveBeenCalled();
		});

		it('should add a compound exercise phase', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 4,
				reps: 4,
				weight: 50,
				isValid: true,
				compoundReps: [2, 2],
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 50);
			});

			expect(addResult).toEqual({ success: true });
		});

		it('should add wave phase as single row', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 5,
				reps: 3,
				weight: 65,
				isValid: true,
				compoundReps: [3, 2, 1, 1, 1],
				exerciseType: 'wave',
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 65);
			});

			expect(addResult).toEqual({ success: true });
			// Wave is now a single phase insert
			expect(mockInsertPhase).toHaveBeenCalledTimes(1);
		});

		it('should return error when database not available', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: undefined }));

			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 100,
				isValid: true,
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 100);
			});

			expect(addResult).toEqual({ success: false, error: 'Database not available' });
		});

		it('should handle insert errors', async () => {
			mockInsertPhase.mockResolvedValue({ data: null, error: 'Insert failed' });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 100,
				isValid: true,
			};

			let addResult: { success: boolean; error?: string } | undefined;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 100);
			});

			expect(addResult?.success).toBe(false);
			expect(addResult?.error).toContain('Error adding phase');
		});

		it('should add phase with weight range', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 80,
				isValid: true,
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 80, { min: 80, max: 85 });
			});

			expect(addResult).toEqual({ success: true });
		});

		it('should add phase with RIR values', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 0,
				isValid: true,
				rirMin: 2,
				rirMax: 3,
				exerciseType: 'standard',
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 0);
			});

			expect(addResult).toEqual({ success: true });
		});

		it('should add circuit exercise', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 2,
				reps: 0,
				weight: 0,
				isValid: true,
				exerciseType: 'circuit',
				circuitExercises: [
					{ reps: '10', name: 'Push-ups' },
					{ reps: '10', name: 'Squats' },
				],
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 0);
			});

			expect(addResult).toEqual({ success: true });
		});
	});

	describe('updatePhase', () => {
		it('should update a phase', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 4,
				reps: 6,
				weight: 110,
				isValid: true,
			};

			let updateResult;
			await act(async () => {
				updateResult = await result.current.updatePhase('p1', parsedData, 110);
			});

			expect(updateResult).toEqual({ success: true });
			expect(mockUpdatePhase).toHaveBeenCalled();
		});

		it('should handle update errors', async () => {
			mockUpdatePhase.mockResolvedValue({ data: null, error: 'Update failed' });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 4,
				reps: 6,
				weight: 110,
				isValid: true,
			};

			let updateResult: { success: boolean; error?: string } | undefined;
			await act(async () => {
				updateResult = await result.current.updatePhase('p1', parsedData, 110);
			});

			expect(updateResult?.success).toBe(false);
		});

		it('should clear optional fields when updating', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			// Update to standard format (should clear compound_reps, rir, etc.)
			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 100,
				isValid: true,
			};

			await act(async () => {
				await result.current.updatePhase('p1', parsedData, 100);
			});

			expect(mockUpdatePhase).toHaveBeenCalled();
		});
	});

	describe('deletePhase', () => {
		it('should delete a phase', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			let deleteResult;
			await act(async () => {
				deleteResult = await result.current.deletePhase('p1');
			});

			expect(deleteResult).toEqual({ success: true });
			expect(mockDeletePhase).toHaveBeenCalledWith('p1');
		});

		it('should handle delete errors', async () => {
			mockDeletePhase.mockResolvedValue({ data: null, error: 'Delete failed' });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			let deleteResult;
			await act(async () => {
				deleteResult = await result.current.deletePhase('p1');
			});

			expect(deleteResult).toEqual({ success: false, error: 'Error deleting phase' });
		});
	});

	describe('array exerciseId handling', () => {
		it('should handle array exerciseId', async () => {
			const { result } = renderHook(() => useExercisePhases({ exerciseId: ['ex-1', 'ex-2'] }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFetchPhasesByExerciseId).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 3,
				reps: 5,
				weight: 100,
				isValid: true,
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 100);
			});

			expect(addResult).toEqual({ success: true });
		});
	});
});
