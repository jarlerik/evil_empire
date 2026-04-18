import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Program, ProgramSessionForDate } from '@evil-empire/types';
import {
	fetchProgramsByUserId,
	fetchProgramSessionsForDateRange,
	materializeProgramSession as materializeRpc,
	MaterializeExerciseInput,
} from '@evil-empire/peaktrack-services';
import { useAuth } from './AuthContext';
import { resolveSessionsInRange } from '../lib/programScheduling';

interface ProgramsContextType {
	programs: Program[];
	loading: boolean;
	reloadPrograms: () => Promise<void>;
	fetchSessionsForRange: (startDate: Date, endDate: Date) => Promise<ProgramSessionForDate[]>;
	materializeSession: (input: {
		session_id: string;
		target_date: string;
		name: string;
		exercises: MaterializeExerciseInput[];
	}) => Promise<{ workout_id: string | null; error: string | null }>;
	invalidateSessionCache: () => void;
}

const ProgramsContext = createContext<ProgramsContextType | undefined>(undefined);

export function ProgramsProvider({ children }: { children: React.ReactNode }) {
	const { user } = useAuth();
	const [programs, setPrograms] = useState<Program[]>([]);
	const [loading, setLoading] = useState(true);

	// Simple per-date-range cache keyed by "start|end" yyyy-MM-dd strings.
	// Any mutation clears the entire cache — small and predictable.
	const sessionCacheRef = useRef<Map<string, ProgramSessionForDate[]>>(new Map());

	const reloadPrograms = useCallback(async () => {
		if (!user) {
			setPrograms([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const { data, error } = await fetchProgramsByUserId(user.id);
		if (!error && data) {
			setPrograms(data);
		}
		sessionCacheRef.current.clear();
		setLoading(false);
	}, [user]);

	useEffect(() => {
		if (user) {
			reloadPrograms();
		} else {
			setPrograms([]);
			sessionCacheRef.current.clear();
			setLoading(false);
		}
	}, [user, reloadPrograms]);

	const invalidateSessionCache = useCallback(() => {
		sessionCacheRef.current.clear();
	}, []);

	const fetchSessionsForRange = useCallback(
		async (startDate: Date, endDate: Date): Promise<ProgramSessionForDate[]> => {
			if (!user) {
				return [];
			}
			const key = `${format(startDate, 'yyyy-MM-dd')}|${format(endDate, 'yyyy-MM-dd')}`;
			const cached = sessionCacheRef.current.get(key);
			if (cached) {
				return cached;
			}
			const { data, error } = await fetchProgramSessionsForDateRange(
				user.id,
				startDate,
				endDate,
				{
					resolveSessionsInRange,
					formatDate: d => format(d, 'yyyy-MM-dd'),
				},
			);
			if (error || !data) {
				return [];
			}
			sessionCacheRef.current.set(key, data);
			return data;
		},
		[user],
	);

	const materializeSession = useCallback(
		async (input: {
			session_id: string;
			target_date: string;
			name: string;
			exercises: MaterializeExerciseInput[];
		}) => {
			const { data, error } = await materializeRpc(input);
			if (!error) {
				sessionCacheRef.current.clear();
			}
			return {
				workout_id: data?.workout_id ?? null,
				error: error ?? null,
			};
		},
		[],
	);

	return (
		<ProgramsContext.Provider
			value={{
				programs,
				loading,
				reloadPrograms,
				fetchSessionsForRange,
				materializeSession,
				invalidateSessionCache,
			}}
		>
			{children}
		</ProgramsContext.Provider>
	);
}

export function usePrograms() {
	const ctx = useContext(ProgramsContext);
	if (!ctx) {
		throw new Error('usePrograms must be used within a ProgramsProvider');
	}
	return ctx;
}
