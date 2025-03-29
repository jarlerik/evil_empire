import { it, expect } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { ThemedText } from '../ThemedText';

it('renders correctly', () => {
	const { getByText } = render(<ThemedText>Test</ThemedText>);
	expect(getByText('Test')).toBeTruthy();
});
