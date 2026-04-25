import React from 'react';
import { render } from '@testing-library/react-native';
import { VolumeStatCardRow } from '../VolumeStatCardRow';
import type { VolumePoint } from '../../lib/volumeStats';

const NOW = new Date(2026, 3, 25); // 2026-04-25

describe('VolumeStatCardRow', () => {
	it('renders 7d and 30d labels with the unit suffix', () => {
		const { getByText, getAllByText } = render(
			<VolumeStatCardRow points={[]} unit="kg" now={NOW} />,
		);
		expect(getByText('Volume · 7d')).toBeTruthy();
		expect(getByText('Volume · 30d')).toBeTruthy();
		expect(getAllByText('0 kg').length).toBe(2);
	});

	it('uses lbs when the user prefers it', () => {
		const points: VolumePoint[] = [{ date: '2026-04-24', volume: 1500 }];
		const { getAllByText } = render(
			<VolumeStatCardRow points={points} unit="lbs" now={NOW} />,
		);
		expect(getAllByText('1,500 lbs').length).toBeGreaterThan(0);
	});

	it('renders an em dash trend when there is no previous-window baseline', () => {
		const points: VolumePoint[] = [{ date: '2026-04-24', volume: 100 }];
		const { getAllByText } = render(
			<VolumeStatCardRow points={points} unit="kg" now={NOW} />,
		);
		expect(getAllByText('—').length).toBe(2);
	});

	it('renders a positive trend when current > previous', () => {
		const points: VolumePoint[] = [
			{ date: '2026-04-24', volume: 120 }, // current 7d
			{ date: '2026-04-15', volume: 100 }, // previous 7d
		];
		const { getByText } = render(
			<VolumeStatCardRow points={points} unit="kg" now={NOW} />,
		);
		expect(getByText('+20%')).toBeTruthy();
	});
});
