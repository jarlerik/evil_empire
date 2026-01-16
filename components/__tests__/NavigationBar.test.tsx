import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import { NavigationBar } from '../NavigationBar';

jest.mock('expo-router', () => ({
	router: { push: jest.fn() },
	usePathname: jest.fn(),
}));

const usePathnameMock = usePathname as jest.Mock;
const pushMock = router.push as jest.Mock;

describe('NavigationBar', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		usePathnameMock.mockReturnValue('/');
	});

	it('should render navigation items', () => {
		const { getByText } = render(<NavigationBar />);

		expect(getByText('Home')).toBeTruthy();
		expect(getByText('History')).toBeTruthy();
		expect(getByText('Settings')).toBeTruthy();
	});

	it('should navigate to settings when pressed', () => {
		const { getByText } = render(<NavigationBar />);

		fireEvent.press(getByText('Settings'));

		expect(pushMock).toHaveBeenCalledWith('/settings');
	});
});
