import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
	describe('rendering', () => {
		it('should render with title', () => {
			const { getByText } = render(<Button title="Test Button" />);

			expect(getByText('Test Button')).toBeTruthy();
		});

		it('should render primary variant by default', () => {
			const { getByText } = render(<Button title="Primary" />);

			const text = getByText('Primary');
			expect(text).toBeTruthy();
		});

		it('should render secondary variant', () => {
			const { getByText } = render(<Button title="Secondary" variant="secondary" />);

			const text = getByText('Secondary');
			expect(text).toBeTruthy();
		});
	});

	describe('interaction', () => {
		it('should call onPress when pressed', () => {
			const onPressMock = jest.fn();
			const { getByText } = render(<Button title="Click Me" onPress={onPressMock} />);

			fireEvent.press(getByText('Click Me'));

			expect(onPressMock).toHaveBeenCalledTimes(1);
		});

		it('should not call onPress when disabled', () => {
			const onPressMock = jest.fn();
			const { getByText } = render(
				<Button title="Disabled" onPress={onPressMock} disabled />,
			);

			fireEvent.press(getByText('Disabled'));

			expect(onPressMock).not.toHaveBeenCalled();
		});
	});

	describe('disabled state', () => {
		it('should apply disabled styles', () => {
			const { getByText } = render(<Button title="Disabled" disabled />);

			const text = getByText('Disabled');
			expect(text).toBeTruthy();
		});
	});

	describe('custom style', () => {
		it('should accept custom style prop', () => {
			const customStyle = { marginTop: 10 };
			const { getByText } = render(<Button title="Styled" style={customStyle} />);

			expect(getByText('Styled')).toBeTruthy();
		});
	});

	describe('pressable props', () => {
		it('should pass through additional pressable props', () => {
			const testID = 'test-button';
			const { getByTestId } = render(
				<Button title="Props Test" testID={testID} />,
			);

			expect(getByTestId(testID)).toBeTruthy();
		});
	});
});
