import { renderHook, waitFor } from '@testing-library/react-native';
import { useRmLookup } from '../useRmLookup';

// Mock supabase
const mockMaybeSingle = jest.fn();
const mockLimit = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockIlike = jest.fn(() => ({ eq: mockEq }));
const mockSelect = jest.fn(() => ({ eq: mockEq, ilike: mockIlike }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../../lib/supabase', () => ({
	supabase: {
		from: (table: string) => mockFrom(table),
	},
}));

describe('useRmLookup', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockMaybeSingle.mockReset();
		mockEq.mockReturnValue({ order: mockOrder, ilike: mockIlike });
		mockIlike.mockReturnValue({ eq: mockEq });
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
			mockMaybeSingle.mockResolvedValue({ data: { weight: 150 }, error: null });

			const { result } = renderHook(() => useRmLookup());

			const rmResult = await result.current.lookupRm('user-1', 'Squat');

			expect(rmResult.found).toBe(true);
			expect(rmResult.weight).toBe(150);
			expect(rmResult.error).toBeUndefined();
		});

		it('should return not found when no RM exists', async () => {
			mockMaybeSingle.mockResolvedValue({ data: null, error: null });

			const { result } = renderHook(() => useRmLookup());

			const rmResult = await result.current.lookupRm('user-1', 'Squat');

			expect(rmResult.found).toBe(false);
			expect(rmResult.weight).toBe(0);
			expect(rmResult.error).toContain('No 1RM found');
		});

		it('should handle database errors', async () => {
			mockMaybeSingle.mockResolvedValue({
				data: null,
				error: { message: 'Database error' },
			});

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
				}
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weight).toBe(100);
		});

		it('should calculate weight from percentage when RM lookup needed', async () => {
			mockMaybeSingle.mockResolvedValue({ data: { weight: 100 }, error: null });

			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Squat',
				{
					weight: 0,
					needsRmLookup: true,
					weightPercentage: 80,
				}
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weight).toBe(80);
		});

		it('should calculate weight range from percentage range', async () => {
			mockMaybeSingle.mockResolvedValue({ data: { weight: 100 }, error: null });

			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Squat',
				{
					weight: 0,
					needsRmLookup: true,
					weightMinPercentage: 80,
					weightMaxPercentage: 85,
				}
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
				}
			);

			expect(calcResult.success).toBe(true);
			expect(calcResult.weights.weightMin).toBe(85);
			expect(calcResult.weights.weightMax).toBe(90);
			expect(calcResult.weights.weight).toBe(85);
		});

		it('should fail when RM lookup fails', async () => {
			mockMaybeSingle.mockResolvedValue({ data: null, error: null });

			const { result } = renderHook(() => useRmLookup());

			const calcResult = await result.current.calculateWeightsFromParsedData(
				'user-1',
				'Unknown Exercise',
				{
					weight: 0,
					needsRmLookup: true,
					weightPercentage: 80,
				}
			);

			expect(calcResult.success).toBe(false);
			expect(calcResult.error).toContain('No 1RM found');
		});
	});
});
