import { renderHook } from '@testing-library/react-native';
import { useRmLookup } from '../useRmLookup';

// Mock repetition maximum service
const mockLookupExactRm = jest.fn();
const mockFetchAllRmsByReps = jest.fn();

jest.mock('@evil-empire/peaktrack-services', () => ({
	lookupExactRm: (...args: unknown[]) => mockLookupExactRm(...args),
	fetchAllRmsByReps: (...args: unknown[]) => mockFetchAllRmsByReps(...args),
}));

describe('useRmLookup', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockLookupExactRm.mockResolvedValue({ data: null, error: null });
		mockFetchAllRmsByReps.mockResolvedValue({ data: [], error: null });
	});

	describe('calculateWeightFromPercentage', () => {
		it('should calculate weight from percentage correctly', () => {
			const { result } = renderHook(() => useRmLookup());

			expect(result.current.calculateWeightFromPercentage(100, 80)).toBe(80);
			expect(result.current.calculateWeightFromPercentage(100, 50)).toBe(50);
			expect(result.current.calculateWeightFromPercentage(150, 60)).toBe(90);
		});

		it('should round to nearest integer', () => {
			const { result } = renderHook(() => useRmLookup());

			expect(result.current.calculateWeightFromPercentage(100, 33)).toBe(33);
			expect(result.current.calculateWeightFromPercentage(100, 33.3)).toBe(33);
			expect(result.current.calculateWeightFromPercentage(100, 66.6)).toBe(67);
		});
	});

	describe('lookupRm', () => {
		it('should return weight when RM found', async () => {
			mockLookupExactRm.mockResolvedValue({ data: { weight: 150 }, error: null });

			const { result } = renderHook(() => useRmLookup());

			const rmResult = await result.current.lookupRm('user-1', 'Squat');

			expect(rmResult.found).toBe(true);
			expect(rmResult.weight).toBe(150);
			expect(rmResult.error).toBeUndefined();
		});

		it('should return not found when no RM exists', async () => {
			mockLookupExactRm.mockResolvedValue({ data: null, error: null });

			const { result } = renderHook(() => useRmLookup());

			const rmResult = await result.current.lookupRm('user-1', 'Squat');

			expect(rmResult.found).toBe(false);
			expect(rmResult.weight).toBe(0);
			expect(rmResult.error).toContain('No 1RM found');
		});

		it('should handle database errors', async () => {
			mockLookupExactRm.mockResolvedValue({ data: null, error: 'Database error' });

			const { result } = renderHook(() => useRmLookup());

			const rmResult = await result.current.lookupRm('user-1', 'Squat');

			expect(rmResult.found).toBe(false);
			expect(rmResult.weight).toBe(0);
		});
	});

	describe('calculateWeightsFromParsedData', () => {
		it('should return weight directly when no RM lookup needed', async () => {
			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Squat',
				{
					weight: 100,
					needsRmLookup: false,
				},
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weight).toBe(100);
		});

		it('should calculate weight from percentage when RM lookup needed', async () => {
			mockLookupExactRm.mockResolvedValue({ data: { weight: 100 }, error: null });

			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Squat',
				{
					weight: 0,
					needsRmLookup: true,
					weightPercentage: 80,
				},
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weight).toBe(80);
		});

		it('should calculate weight range from percentage range', async () => {
			mockLookupExactRm.mockResolvedValue({ data: { weight: 100 }, error: null });

			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Squat',
				{
					weight: 0,
					needsRmLookup: true,
					weightMinPercentage: 80,
					weightMaxPercentage: 85,
				},
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weightMin).toBe(80);
			expect(calcResult.weights.weightMax).toBe(85);
			expect(calcResult.weights.weight).toBe(80); // Uses min for backward compatibility
		});

		it('should handle absolute weight ranges', async () => {
			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Squat',
				{
					weight: 0,
					needsRmLookup: false,
					weightMin: 85,
					weightMax: 90,
				},
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weightMin).toBe(85);
			expect(calcResult.weights.weightMax).toBe(90);
			expect(calcResult.weights.weight).toBe(85);
		});

		it('should fail when RM lookup fails', async () => {
			mockLookupExactRm.mockResolvedValue({ data: null, error: null });

			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Unknown Exercise',
				{
					weight: 0,
					needsRmLookup: true,
					weightPercentage: 80,
				},
			);

			expect(calcResult.success).toBe(false);
			expect(calcResult.error).toContain('No 1RM found');
		});
	});
});
