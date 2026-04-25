import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Text } from '@evil-empire/ui';
import { format } from 'date-fns';
import type { RepetitionMaximum } from '@evil-empire/peaktrack-services';
import { Modal } from './Modal';

export interface RmFormData {
  exerciseName: string;
  reps: number;
  weight: number;
  date: string;
}

interface RmFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: RmFormData) => Promise<void> | void;
  editingRm?: RepetitionMaximum | null;
  defaultExerciseName?: string;
  isLoading?: boolean;
  unit?: 'kg' | 'lbs';
  infoText?: string;
}

export function RmFormModal({
  open,
  onClose,
  onSave,
  editingRm,
  defaultExerciseName,
  isLoading,
  unit = 'kg',
  infoText,
}: RmFormModalProps) {
  const [exerciseName, setExerciseName] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingRm) {
      setExerciseName(editingRm.exercise_name);
      setReps(String(editingRm.reps));
      setWeight(String(editingRm.weight));
      setDate(editingRm.date);
    } else {
      setExerciseName(defaultExerciseName ?? '');
      setReps(defaultExerciseName ? '1' : '');
      setWeight('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [open, editingRm, defaultExerciseName]);

  const handleSave = async () => {
    if (!exerciseName.trim() || !reps || !weight || !date) {
      setError('Please fill in all fields');
      return;
    }
    const repsNum = parseInt(reps, 10);
    const weightNum = parseFloat(weight);
    if (Number.isNaN(repsNum) || repsNum <= 0) {
      setError('Reps must be a positive number');
      return;
    }
    if (Number.isNaN(weightNum) || weightNum <= 0) {
      setError('Weight must be a positive number');
      return;
    }
    setError('');
    await onSave({
      exerciseName: exerciseName.trim(),
      reps: repsNum,
      weight: weightNum,
      date,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={editingRm ? 'Edit RM' : 'Add RM'}>
      <View style={{ gap: 16 }}>
        <Text variant="heading">{editingRm ? 'Edit RM' : 'Add RM'}</Text>
        {infoText ? <Text variant="caption">{infoText}</Text> : null}
        <Input
          label="Exercise"
          value={exerciseName}
          onChangeText={setExerciseName}
          placeholder="e.g., Squat"
          autoCapitalize="words"
        />
        <Input
          label="Reps"
          value={reps}
          onChangeText={setReps}
          placeholder="1"
          keyboardType="numeric"
          inputMode="numeric"
        />
        <Input
          label={`Weight (${unit})`}
          value={weight}
          onChangeText={setWeight}
          placeholder="100"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <Input
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="yyyy-MM-dd"
          error={error || undefined}
        />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={isLoading} />
          <Button
            title={editingRm ? 'Update' : 'Add'}
            variant="primary"
            loading={isLoading}
            onPress={handleSave}
          />
        </View>
      </View>
    </Modal>
  );
}
