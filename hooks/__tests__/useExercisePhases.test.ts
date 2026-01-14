import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useExercisePhases } from '../useExercisePhases';
import { ParsedSetData } from '../../lib/parseSetInput';

// Mock supabase
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
	supabase: {
		from: (table: string) => mockFrom(table),
	},
}));

describe('useExercisePhases', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock chain
		mockOrder.mockReturnValue({ data: [], error: null });
		mockEq.mockReturnValue({ order: mockOrder, data: null, error: null });
		mockSelect.mockReturnValue({ eq: mockEq });
		mockInsert.mockReturnValue({ error: null });
		mockUpdate.mockReturnValue({ eq: mockEq });
		mockDelete.mockReturnValue({ eq: mockEq });
		mockFrom.mockReturnValue({
			select: mockSelect,
			insert: mockInsert,
			update: mockUpdate,
			delete: mockDelete,
		});
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
				expect(mockFrom).not.toHaveBeenCalled();
			});
		});
	});

	describe('fetchExercisePhases', () => {
		it('should fetch phases on mount when exerciseId is provided', async () => {
			const mockPhases = [
				{ id: 'p1', exercise_id: 'ex-1', sets: 3, repetitions: 5, weight: 100 },
			];

			mockOrder.mockReturnValue({ data: mockPhases, error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			await waitFor(() => {
				expect(result.current.exercisePhases).toEqual(mockPhases);
			});

			expect(mockFrom).toHaveBeenCalledWith('exercise_phases');
		});

		it('should handle fetch errors gracefully', async () => {
			mockOrder.mockReturnValue({ data: null, error: { message: 'Fetch error' } });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			await waitFor(() => {
				expect(result.current.exercisePhases).toEqual([]);
			});
		});
	});

	describe('addPhase', () => {
		it('should add a standard phase', async () => {
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
			expect(mockInsert).toHaveBeenCalled();
		});

		it('should add a compound exercise phase', async () => {
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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

		it('should add wave phases separately', async () => {
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
			});

			const parsedData: ParsedSetData = {
				sets: 5,
				reps: 3,
				weight: 65,
				isValid: true,
				wavePhases: [
					{ sets: 1, reps: 3, weight: 65 },
					{ sets: 1, reps: 2, weight: 65 },
					{ sets: 1, reps: 1, weight: 65 },
					{ sets: 1, reps: 1, weight: 65 },
					{ sets: 1, reps: 1, weight: 65 },
				],
			};

			let addResult;
			await act(async () => {
				addResult = await result.current.addPhase(parsedData, 65);
			});

			expect(addResult).toEqual({ success: true });
			// Should have been called for each wave phase
			expect(mockInsert).toHaveBeenCalledTimes(5);
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
			mockInsert.mockReturnValue({ error: { message: 'Insert failed' } });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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

			expect(addResult?.success).toBe(false);
			expect(addResult?.error).toContain('Error adding phase');
		});

		it('should add phase with weight range', async () => {
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
			// Create separate mock for update eq
			const mockUpdateEq = jest.fn().mockReturnValue({ error: null });
			mockUpdate.mockReturnValue({ eq: mockUpdateEq });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
			expect(mockUpdate).toHaveBeenCalled();
		});

		it('should handle update errors', async () => {
			// Create separate mock for update eq that returns an error
			const mockUpdateEq = jest.fn().mockReturnValue({ error: { message: 'Update failed' } });
			mockUpdate.mockReturnValue({ eq: mockUpdateEq });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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

			expect(updateResult?.success).toBe(false);
		});

		it('should clear optional fields when updating', async () => {
			// Create separate mock for update eq
			const mockUpdateEq = jest.fn().mockReturnValue({ error: null });
			mockUpdate.mockReturnValue({ eq: mockUpdateEq });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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

			expect(mockUpdate).toHaveBeenCalled();
		});
	});

	describe('deletePhase', () => {
		it('should delete a phase', async () => {
			// Create separate mock for delete eq
			const mockDeleteEq = jest.fn().mockReturnValue({ error: null });
			mockDelete.mockReturnValue({ eq: mockDeleteEq });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
			});

			let deleteResult;
			await act(async () => {
				deleteResult = await result.current.deletePhase('p1');
			});

			expect(deleteResult).toEqual({ success: true });
			expect(mockDelete).toHaveBeenCalled();
		});

		it('should handle delete errors', async () => {
			// Create separate mock for delete eq that returns an error
			const mockDeleteEq = jest.fn().mockReturnValue({ error: { message: 'Delete failed' } });
			mockDelete.mockReturnValue({ eq: mockDeleteEq });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: 'ex-1' }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
			mockInsert.mockReturnValue({ error: null });
			mockOrder.mockReturnValue({ data: [], error: null });

			const { result } = renderHook(() => useExercisePhases({ exerciseId: ['ex-1', 'ex-2'] }));

			// Wait for initial fetch to complete
			await waitFor(() => {
				expect(mockFrom).toHaveBeenCalled();
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
