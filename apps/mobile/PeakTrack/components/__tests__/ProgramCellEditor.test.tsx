import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { ProgramRepetitionMaximum } from '@evil-empire/types';
import { ProgramCellEditor } from '../ProgramCellEditor';

function rm(name: string, weight: number): ProgramRepetitionMaximum {
	return {
		id: `rm-${name}`,
		program_id: 'prog-1',
		user_id: 'user-1',
		exercise_name: name,
		weight,
		tested_at: null,
		source: 'manual',
	};
}

describe('ProgramCellEditor', () => {
	it('renders title "Add exercise" when initial is null', () => {
		const { getByText } = render(
			<ProgramCellEditor
				visible={true}
				initial={null}
				programRms={[]}
				programStatus="draft"
				onCancel={() => {}}
				onSave={() => {}}
			/>,
		);
		expect(getByText('Add exercise')).toBeTruthy();
	});

	it('disables Save when input cannot be parsed', () => {
		const onSave = jest.fn();
		const { getByText, getByPlaceholderText } = render(
			<ProgramCellEditor
				visible={true}
				initial={null}
				programRms={[]}
				programStatus="draft"
				onCancel={() => {}}
				onSave={onSave}
			/>,
		);
		fireEvent.changeText(getByPlaceholderText('e.g. Back squat'), 'Back squat');
		fireEvent.changeText(getByPlaceholderText('e.g. 6 x 2 @80%'), 'definitely not a set');
		fireEvent.press(getByText('Save'));
		expect(onSave).not.toHaveBeenCalled();
	});

	it('calls onSave with trimmed values when input is valid', () => {
		const onSave = jest.fn();
		const { getByText, getByPlaceholderText } = render(
			<ProgramCellEditor
				visible={true}
				initial={null}
				programRms={[rm('Back squat', 180)]}
				programStatus="draft"
				onCancel={() => {}}
				onSave={onSave}
			/>,
		);
		fireEvent.changeText(getByPlaceholderText('e.g. Back squat'), '  Back squat  ');
		fireEvent.changeText(getByPlaceholderText('e.g. 6 x 2 @80%'), ' 6 x 2 @80% ');
		fireEvent.press(getByText('Save'));
		expect(onSave).toHaveBeenCalledWith({
			name: 'Back squat',
			raw_input: '6 x 2 @80%',
			notes: '',
		});
	});

	it('blocks save on active program when a percentage name has no snapshot', () => {
		const onSave = jest.fn();
		const { getByText, getByPlaceholderText } = render(
			<ProgramCellEditor
				visible={true}
				initial={null}
				programRms={[]}
				programStatus="active"
				onCancel={() => {}}
				onSave={onSave}
			/>,
		);
		fireEvent.changeText(getByPlaceholderText('e.g. Back squat'), 'New lift');
		fireEvent.changeText(getByPlaceholderText('e.g. 6 x 2 @80%'), '6 x 2 @80%');
		fireEvent.press(getByText('Save'));
		expect(onSave).not.toHaveBeenCalled();
	});
});
