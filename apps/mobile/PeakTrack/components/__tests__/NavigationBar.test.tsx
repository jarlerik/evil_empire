import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { NavigationBar } from '../NavigationBar';

jest.mock('expo-router', () => ({
	router: { push: jest.fn() },
	usePathname: jest.fn(),
}));

const insets = { top: 0, right: 0, bottom: 0, left: 0, frame: { x: 0, y: 0, width: 0, height: 0 } };
const wrapper = ({ children }: { children: React.ReactNode }) => (
	<SafeAreaProvider initialMetrics={{ insets, frame: { x: 0, y: 0, width: 375, height: 812 } }}>
		{children}
	</SafeAreaProvider>
);

const usePathnameMock = usePathname as jest.Mock;
const pushMock = router.push as jest.Mock;

describe('NavigationBar', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		usePathnameMock.mockReturnValue('/');
	});

	it('should render navigation items', async () => {
		const { getByText } = render(<NavigationBar />, { wrapper });

		await waitFor(() => {
			expect(getByText('Home')).toBeTruthy();
			expect(getByText('History')).toBeTruthy();
			expect(getByText('Programs')).toBeTruthy();
		});
	});

	it('should navigate to programs when pressed', async () => {
		const { getByText } = render(<NavigationBar />, { wrapper });

		await waitFor(() => {
			expect(getByText('Programs')).toBeTruthy();
		});

		fireEvent.press(getByText('Programs'));

		expect(pushMock).toHaveBeenCalledWith('/programs');
	});
});
