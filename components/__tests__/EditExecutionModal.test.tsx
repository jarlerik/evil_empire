import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { EditExecutionModal } from '../EditExecutionModal';
import { ExercisePhase } from '../../lib/formatExercisePhase';

// Mock parseSetInput
jest.mock('../../lib/parseSetInput', () => ({
	parseSetInput: jest.fn((input: string) => {
		// Simple mock implementation
		if (input.includes('invalid')) {
			return { isValid: false, errorMessage: 'Invalid format' };
		}
		const match = input.match(/(\d+)\s*x\s*(\d+)\s*@?\s*(\d+)?/i);
		if (match) {
			return {
				isValid: true,
				sets: parseInt(match[1]),
				reps: parseInt(match[2]),
				weight: match[3] ? parseInt(match[3]) : 0,
			};
		}
		return {
			isValid: true,
			sets: 3,
			reps: 5,
			weight: 100,
		};
	}),
}));

// Mock formatExercisePhase
jest.mock('../../lib/formatExercisePhase', () => ({
	formatExercisePhase: jest.fn((phase: ExercisePhase) => {
		return `${phase.sets} x ${phase.repetitions} @${phase.weight}kg`;
	}),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockPhase = (
	id: string,
	sets: number,
	reps: number,
	weight: number,
): ExercisePhase => ({
	id,
	exercise_id: 'ex-1',
	sets,
	repetitions: reps,
	weight,
	created_at: '2024-01-01',
});

describe('EditExecutionModal', () => {
	const defaultProps = {
		visible: true,
		onClose: jest.fn(),
		onSave: jest.fn().mockResolvedValue(undefined),
		onSkip: jest.fn(),
		exerciseName: 'Squat',
		exerciseId: 'ex-1',
		phases: [mockPhase('p1', 3, 5, 100)],
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('rendering', () => {
		it('should render exercise name in header', () => {
			const { getByText } = render(<EditExecutionModal {...defaultProps} />);

			expect(getByText('Squat')).toBeTruthy();
		});

		it('should render close button', () => {
			const { getByText } = render(<EditExecutionModal {...defaultProps} />);

			expect(getByText('x')).toBeTruthy();
		});

		it('should render planned label for each phase', () => {
			const { getAllByText } = render(<EditExecutionModal {...defaultProps} />);

			expect(getAllByText('Planned:').length).toBe(1);
		});

		it('should render actual label for each phase', () => {
			const { getAllByText } = render(<EditExecutionModal {...defaultProps} />);

			expect(getAllByText('Actual:').length).toBe(1);
		});

		it('should render Skip and Save buttons', () => {
			const { getByText } = render(<EditExecutionModal {...defaultProps} />);

			expect(getByText('Skip')).toBeTruthy();
			expect(getByText('Save')).toBeTruthy();
		});

		it('should render multiple phases', () => {
			const props = {
				...defaultProps,
				phases: [
					mockPhase('p1', 3, 5, 100),
					mockPhase('p2', 3, 3, 110),
				],
			};

			const { getAllByText } = render(<EditExecutionModal {...props} />);

			expect(getAllByText('Planned:').length).toBe(2);
			expect(getAllByText('Actual:').length).toBe(2);
		});
	});

	describe('form initialization', () => {
		it('should pre-populate inputs with formatted planned values', () => {
			const { getByDisplayValue } = render(
				<EditExecutionModal {...defaultProps} />,
			);

			expect(getByDisplayValue('3 x 5 @100kg')).toBeTruthy();
		});

		it('should show formatted planned values', () => {
			const { getByText } = render(<EditExecutionModal {...defaultProps} />);

			expect(getByText('3 x 5 @100kg')).toBeTruthy();
		});
	});

	describe('input handling', () => {
		it('should update input value when text changes', () => {
			const { getByDisplayValue } = render(
				<EditExecutionModal {...defaultProps} />,
			);

			const input = getByDisplayValue('3 x 5 @100kg');
			fireEvent.changeText(input, '3 x 6 @105kg');

			expect(getByDisplayValue('3 x 6 @105kg')).toBeTruthy();
		});

		it('should handle multiple phase inputs independently', () => {
			const props = {
				...defaultProps,
				phases: [
					mockPhase('p1', 3, 5, 100),
					mockPhase('p2', 3, 3, 110),
				],
			};

			const { getByDisplayValue } = render(<EditExecutionModal {...props} />);

			const input1 = getByDisplayValue('3 x 5 @100kg');
			fireEvent.changeText(input1, '3 x 4 @95kg');

			// First input should be updated
			expect(getByDisplayValue('3 x 4 @95kg')).toBeTruthy();
			// Second input should remain unchanged
			expect(getByDisplayValue('3 x 3 @110kg')).toBeTruthy();
		});
	});

	describe('validation', () => {
		it('should show error alert for invalid input format', async () => {
			const { getByText, getByDisplayValue } = render(
				<EditExecutionModal {...defaultProps} />,
			);

			const input = getByDisplayValue('3 x 5 @100kg');
			fireEvent.changeText(input, 'invalid input');

			fireEvent.press(getByText('Save'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith(
					'Error',
					expect.stringContaining('Invalid format'),
				);
			});
		});
	});

	describe('submission', () => {
		it('should call onSave with correct execution data', async () => {
			const onSave = jest.fn().mockResolvedValue(undefined);
			const { getByText } = render(
				<EditExecutionModal {...defaultProps} onSave={onSave} />,
			);

			fireEvent.press(getByText('Save'));

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith({
					exercise_id: 'ex-1',
					phases: expect.arrayContaining([
						expect.objectContaining({
							exercise_phase_id: 'p1',
							input: '3 x 5 @100kg',
							parsed: expect.objectContaining({
								isValid: true,
							}),
						}),
					]),
				});
			});
		});

		it('should handle save errors gracefully', async () => {
			const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));
			const { getByText } = render(
				<EditExecutionModal {...defaultProps} onSave={onSave} />,
			);

			fireEvent.press(getByText('Save'));

			await waitFor(() => {
				expect(Alert.alert).toHaveBeenCalledWith('Error', 'Error saving execution log');
			});
		});

		it('should save multiple phases', async () => {
			const onSave = jest.fn().mockResolvedValue(undefined);
			const props = {
				...defaultProps,
				phases: [
					mockPhase('p1', 3, 5, 100),
					mockPhase('p2', 3, 3, 110),
				],
				onSave,
			};

			const { getByText } = render(<EditExecutionModal {...props} />);

			fireEvent.press(getByText('Save'));

			await waitFor(() => {
				expect(onSave).toHaveBeenCalledWith({
					exercise_id: 'ex-1',
					phases: expect.arrayContaining([
						expect.objectContaining({ exercise_phase_id: 'p1' }),
						expect.objectContaining({ exercise_phase_id: 'p2' }),
					]),
				});
			});
		});
	});

	describe('skip functionality', () => {
		it('should call onSkip when skip button pressed', () => {
			const onSkip = jest.fn();
			const { getByText } = render(
				<EditExecutionModal {...defaultProps} onSkip={onSkip} />,
			);

			fireEvent.press(getByText('Skip'));

			expect(onSkip).toHaveBeenCalled();
		});
	});

	describe('loading state', () => {
		it('should show "Saving..." text when loading', async () => {
			const onSave = jest.fn().mockImplementation(() => new Promise(() => {}));
			const { getByText, findByText } = render(
				<EditExecutionModal {...defaultProps} onSave={onSave} />,
			);

			fireEvent.press(getByText('Save'));

			expect(await findByText('Saving...')).toBeTruthy();
		});
	});

	describe('modal behavior', () => {
		it('should call onClose when close button pressed', () => {
			const onClose = jest.fn();
			const { getByText } = render(
				<EditExecutionModal {...defaultProps} onClose={onClose} />,
			);

			fireEvent.press(getByText('x'));

			expect(onClose).toHaveBeenCalled();
		});

		it('should reinitialize inputs when modal reopens with new phases', () => {
			const { rerender, getByDisplayValue } = render(
				<EditExecutionModal {...defaultProps} visible={false} />,
			);

			// Rerender with visible true and different phase
			const newProps = {
				...defaultProps,
				visible: true,
				phases: [mockPhase('p2', 4, 6, 120)],
			};

			rerender(<EditExecutionModal {...newProps} />);

			expect(getByDisplayValue('4 x 6 @120kg')).toBeTruthy();
		});
	});

	describe('edge cases', () => {
		it('should handle empty phases array', () => {
			const props = {
				...defaultProps,
				phases: [],
			};

			const { queryByText } = render(<EditExecutionModal {...props} />);

			expect(queryByText('Planned:')).toBeNull();
		});

		it('should handle exercise name with special characters', () => {
			const props = {
				...defaultProps,
				exerciseName: 'Clean + Jerk (Power)',
			};

			const { getByText } = render(<EditExecutionModal {...props} />);

			expect(getByText('Clean + Jerk (Power)')).toBeTruthy();
		});
	});
});
