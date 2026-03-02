import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RmFormModal } from '../RmFormModal';

// Mock date-fns format
jest.mock('date-fns', () => ({
	format: jest.fn(() => '2024-01-15'),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('RmFormModal', () => {
	const defaultProps = {
		visible: true,
		onClose: jest.fn(),
		onSave: jest.fn().mockResolvedValue(undefined),
		editingRm: null,
		isLoading: false,
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('rendering', () => {
		it('should render "Add RM" title when not editing', () => {
			const { getByText } = render(<RmFormModal {...defaultProps} />);

			expect(getByText('Add RM')).toBeTruthy();
		});

		it('should render "Edit RM" title when editing', () => {
			const editingRm = {
				id: 'rm-1',
				user_id: 'user-1',
				exercise_name: 'Squat',
				reps: 1,
				weight: 150,
				date: '2024-01-10',
				created_at: '2024-01-10',
				updated_at: '2024-01-10',
			};

			const { getByText } = render(
				<RmFormModal {...defaultProps} editingRm={editingRm} />,
			);

			expect(getByText('Edit RM')).toBeTruthy();
		});

		it('should display all form fields', () => {
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			expect(getByText('Exercise Name')).toBeTruthy();
			expect(getByText('Reps')).toBeTruthy();
			expect(getByText('Weight (kg)')).toBeTruthy();
			expect(getByText('Date')).toBeTruthy();
			expect(getByPlaceholderText('e.g., Squat')).toBeTruthy();
			expect(getByPlaceholderText('e.g., 1')).toBeTruthy();
			expect(getByPlaceholderText('e.g., 150')).toBeTruthy();
		});

		it('should show close button', () => {
			const { getByText } = render(<RmFormModal {...defaultProps} />);

			expect(getByText('×')).toBeTruthy();
		});

		it('should show "Add" button when creating new RM', () => {
			const { getByText } = render(<RmFormModal {...defaultProps} />);

			expect(getByText('Add')).toBeTruthy();
		});

		it('should show "Update" button when editing', () => {
			const editingRm = {
				id: 'rm-1',
				user_id: 'user-1',
				exercise_name: 'Squat',
				reps: 1,
				weight: 150,
				date: '2024-01-10',
				created_at: '2024-01-10',
				updated_at: '2024-01-10',
			};

			const { getByText } = render(
				<RmFormModal {...defaultProps} editingRm={editingRm} />,
			);

			expect(getByText('Update')).toBeTruthy();
		});

		it('should show "Saving..." when loading', () => {
			const { getByText } = render(
				<RmFormModal {...defaultProps} isLoading={true} />,
			);

			expect(getByText('Saving...')).toBeTruthy();
		});
	});

	describe('form pre-population', () => {
		it('should have empty fields when adding new RM', () => {
			const { getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			const exerciseInput = getByPlaceholderText('e.g., Squat');
			const repsInput = getByPlaceholderText('e.g., 1');
			const weightInput = getByPlaceholderText('e.g., 150');

			expect(exerciseInput.props.value).toBe('');
			expect(repsInput.props.value).toBe('');
			expect(weightInput.props.value).toBe('');
		});

		it('should pre-populate fields when editing existing RM', () => {
			const editingRm = {
				id: 'rm-1',
				user_id: 'user-1',
				exercise_name: 'Bench Press',
				reps: 3,
				weight: 100,
				date: '2024-01-10',
				created_at: '2024-01-10',
				updated_at: '2024-01-10',
			};

			const { getByDisplayValue } = render(
				<RmFormModal {...defaultProps} editingRm={editingRm} />,
			);

			expect(getByDisplayValue('Bench Press')).toBeTruthy();
			expect(getByDisplayValue('3')).toBeTruthy();
			expect(getByDisplayValue('100')).toBeTruthy();
			expect(getByDisplayValue('2024-01-10')).toBeTruthy();
		});
	});

	describe('validation', () => {
		it('should show error when exercise name is empty', async () => {
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			// Fill other fields but leave exercise name empty
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '1');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '100');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all fields');
			});
		});

		it('should show error for invalid reps (zero)', async () => {
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Squat');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '0');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '100');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith('Error', 'Reps must be a positive number');
			});
		});

		it('should show error for invalid reps (negative)', async () => {
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Squat');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '-5');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '100');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith('Error', 'Reps must be a positive number');
			});
		});

		it('should show error for invalid weight (zero)', async () => {
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Squat');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '1');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '0');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith('Error', 'Weight must be a positive number');
			});
		});

		it('should show error for non-numeric reps', async () => {
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Squat');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), 'abc');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '100');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith('Error', 'Reps must be a positive number');
			});
		});
	});

	describe('form submission', () => {
		it('should call onSave with correct data when form is valid', async () => {
			const onSave = jest.fn().mockResolvedValue(undefined);
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} onSave={onSave} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Deadlift');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '1');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '200');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith({
					exerciseName: 'Deadlift',
					reps: 1,
					weight: 200,
					date: '2024-01-15',
				});
			});
		});

		it('should trim exercise name before saving', async () => {
			const onSave = jest.fn().mockResolvedValue(undefined);
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} onSave={onSave} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), '  Squat  ');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '1');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '100');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith(
					expect.objectContaining({
						exerciseName: 'Squat',
					}),
				);
			});
		});

		it('should handle decimal weight values', async () => {
			const onSave = jest.fn().mockResolvedValue(undefined);
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} onSave={onSave} />,
			);

			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Squat');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '1');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '102.5');

			fireEvent.press(getByText('Add'));

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith(
					expect.objectContaining({
						weight: 102.5,
					}),
				);
			});
		});
	});

	describe('modal behavior', () => {
		it('should call onClose when close button pressed', () => {
			const onClose = jest.fn();
			const { getByText } = render(
				<RmFormModal {...defaultProps} onClose={onClose} />,
			);

			fireEvent.press(getByText('×'));

			expect(onClose).toHaveBeenCalled();
		});

		it('should reset form fields when modal closes', () => {
			const { getByPlaceholderText, getByText, rerender } = render(
				<RmFormModal {...defaultProps} />,
			);

			// Fill in some data
			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Test Exercise');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '5');

			// Close the modal
			fireEvent.press(getByText('×'));

			// Rerender with visible false then true
			rerender(<RmFormModal {...defaultProps} visible={false} />);
			rerender(<RmFormModal {...defaultProps} visible={true} />);

			// Fields should be reset
			const exerciseInput = getByPlaceholderText('e.g., Squat');
			expect(exerciseInput.props.value).toBe('');
		});

		it('should not render modal content when not visible', () => {
			const { queryByText } = render(
				<RmFormModal {...defaultProps} visible={false} />,
			);

			// When modal is not visible, content is not rendered
			expect(queryByText('Add RM')).toBeNull();
		});
	});

	describe('loading state', () => {
		it('should disable save button when loading', () => {
			const onSave = jest.fn();
			const { getByText, getByPlaceholderText } = render(
				<RmFormModal {...defaultProps} isLoading={true} onSave={onSave} />,
			);

			// Fill in valid data
			fireEvent.changeText(getByPlaceholderText('e.g., Squat'), 'Squat');
			fireEvent.changeText(getByPlaceholderText('e.g., 1'), '1');
			fireEvent.changeText(getByPlaceholderText('e.g., 150'), '100');

			// Try to press the disabled button
			fireEvent.press(getByText('Saving...'));

			// onSave should not be called because button is disabled
			expect(onSave).not.toHaveBeenCalled();
		});
	});

	describe('editing mode', () => {
		it('should update form when editingRm changes', () => {
			const editingRm1 = {
				id: 'rm-1',
				user_id: 'user-1',
				exercise_name: 'Squat',
				reps: 1,
				weight: 150,
				date: '2024-01-10',
				created_at: '2024-01-10',
				updated_at: '2024-01-10',
			};

			const editingRm2 = {
				id: 'rm-2',
				user_id: 'user-1',
				exercise_name: 'Deadlift',
				reps: 3,
				weight: 200,
				date: '2024-01-12',
				created_at: '2024-01-12',
				updated_at: '2024-01-12',
			};

			const { rerender, getByDisplayValue } = render(
				<RmFormModal {...defaultProps} editingRm={editingRm1} />,
			);

			expect(getByDisplayValue('Squat')).toBeTruthy();
			expect(getByDisplayValue('150')).toBeTruthy();

			rerender(<RmFormModal {...defaultProps} editingRm={editingRm2} />);

			expect(getByDisplayValue('Deadlift')).toBeTruthy();
			expect(getByDisplayValue('200')).toBeTruthy();
		});
	});
});
