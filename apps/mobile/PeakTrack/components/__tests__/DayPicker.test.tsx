import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DayPicker, DayOfWeek } from '@evil-empire/ui';

describe('DayPicker', () => {
	it('renders all seven day chips by default', () => {
		const { getByLabelText } = render(
			<DayPicker value={[]} onChange={() => {}} />,
		);
		for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
			expect(getByLabelText(label)).toBeTruthy();
		}
	});

	it('marks selected chips as checked', () => {
		const { getByLabelText } = render(
			<DayPicker value={[1, 4]} onChange={() => {}} />,
		);
		expect(getByLabelText('Mon').props.accessibilityState.checked).toBe(true);
		expect(getByLabelText('Thu').props.accessibilityState.checked).toBe(true);
		expect(getByLabelText('Tue').props.accessibilityState.checked).toBe(false);
	});

	it('emits ascending-sorted selection on add', () => {
		const onChange = jest.fn<void, [DayOfWeek[]]>();
		const { getByLabelText } = render(
			<DayPicker value={[4]} onChange={onChange} />,
		);
		fireEvent.press(getByLabelText('Mon'));
		expect(onChange).toHaveBeenCalledWith([1, 4]);
	});

	it('removes a day on second tap', () => {
		const onChange = jest.fn<void, [DayOfWeek[]]>();
		const { getByLabelText } = render(
			<DayPicker value={[1, 4]} onChange={onChange} />,
		);
		fireEvent.press(getByLabelText('Mon'));
		expect(onChange).toHaveBeenCalledWith([4]);
	});

	it('prevents emptying the selection when allowDeselect is false', () => {
		const onChange = jest.fn<void, [DayOfWeek[]]>();
		const { getByLabelText } = render(
			<DayPicker value={[4]} onChange={onChange} allowDeselect={false} />,
		);
		fireEvent.press(getByLabelText('Thu'));
		expect(onChange).not.toHaveBeenCalled();
	});

	it('ignores taps when disabled', () => {
		const onChange = jest.fn<void, [DayOfWeek[]]>();
		const { getByLabelText } = render(
			<DayPicker value={[]} onChange={onChange} disabled />,
		);
		fireEvent.press(getByLabelText('Mon'));
		expect(onChange).not.toHaveBeenCalled();
	});

	it('renders a label when provided', () => {
		const { getByText } = render(
			<DayPicker value={[]} onChange={() => {}} label="Session days" />,
		);
		expect(getByText('Session days')).toBeTruthy();
	});

	it('accepts custom day labels', () => {
		const { getByLabelText } = render(
			<DayPicker
				value={[]}
				onChange={() => {}}
				dayLabels={['M', 'T', 'W', 'T', 'F', 'S', 'S']}
			/>,
		);
		expect(getByLabelText('M')).toBeTruthy();
	});
});
