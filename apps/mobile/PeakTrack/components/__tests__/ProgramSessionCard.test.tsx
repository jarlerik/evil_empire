import React from 'react';
import { render } from '@testing-library/react-native';
import type { ProgramSessionForDate } from '@evil-empire/types';
import { ProgramSessionCard } from '../ProgramSessionCard';

jest.mock('expo-router', () => ({
	router: { push: jest.fn() },
}));

jest.mock('../../contexts/ProgramsContext', () => ({
	usePrograms: () => ({
		materializeSession: jest.fn(),
	}),
}));

function makeItem(overrides: Partial<ProgramSessionForDate> = {}): ProgramSessionForDate {
	return {
		program: {
			id: 'prog-1',
			user_id: 'user-1',
			name: 'Russian squat',
			description: null,
			duration_weeks: 9,
			start_iso_year: 2026,
			start_iso_week: 16,
			status: 'active',
		},
		session: {
			id: 'sess-1',
			program_id: 'prog-1',
			user_id: 'user-1',
			week_offset: 2,
			day_of_week: 1,
			name: null,
		},
		exercises: [
			{
				id: 'ex-1',
				program_session_id: 'sess-1',
				user_id: 'user-1',
				order_index: 0,
				name: 'Back squat',
				raw_input: '6 x 2 @80%',
				notes: null,
			},
		],
		rms: [
			{
				id: 'rm-1',
				program_id: 'prog-1',
				user_id: 'user-1',
				exercise_name: 'Back squat',
				weight: 180,
				tested_at: null,
				source: 'manual',
			},
		],
		date: '2026-04-27',
		materializedWorkoutId: null,
		...overrides,
	};
}

describe('ProgramSessionCard', () => {
	it('renders session title with program name and week number', () => {
		const item = makeItem();
		const { getByText } = render(<ProgramSessionCard item={item} />);
		expect(getByText('Russian squat - W3 D1')).toBeTruthy();
	});

	it('renders resolved weights when snapshots are present', () => {
		const item = makeItem();
		const { getByText } = render(<ProgramSessionCard item={item} />);
		// 180 * 0.8 = 144
		expect(getByText('6 × 2 @ 144kg')).toBeTruthy();
		expect(getByText('6 x 2 @80%')).toBeTruthy(); // secondary raw spec
	});

	it('surfaces a missing-snapshot banner when a snapshot is absent', () => {
		const item = makeItem({ rms: [] });
		const { getByText } = render(<ProgramSessionCard item={item} />);
		expect(getByText(/Missing 1RM for Back squat/i)).toBeTruthy();
	});

	it('uses per-session name when set, falls back to program name otherwise', () => {
		const item = makeItem({
			session: {
				id: 'sess-1',
				program_id: 'prog-1',
				user_id: 'user-1',
				week_offset: 2,
				day_of_week: 1,
				name: 'Heavy squats',
			},
		});
		const { getByText } = render(<ProgramSessionCard item={item} />);
		expect(getByText('Heavy squats - W3 D1')).toBeTruthy();
	});
});
