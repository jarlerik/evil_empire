import { View } from 'react-native';
import { Button, Card, Text } from '@evil-empire/ui';
import { formatExercisePhase, type ExercisePhase } from '@evil-empire/parsers';

interface PhaseRowProps {
  phase: ExercisePhase;
  unit: 'kg' | 'lbs';
  onEdit?: () => void;
  onDelete?: () => void;
  isEditing?: boolean;
}

export function PhaseRow({ phase, unit, onEdit, onDelete, isEditing }: PhaseRowProps) {
  return (
    <Card
      variant="bordered"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...(isEditing ? { borderColor: '#fff' } : {}),
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body">{formatExercisePhase(phase, unit)}</Text>
        {phase.notes ? <Text variant="caption">{phase.notes}</Text> : null}
      </View>
      {onEdit ? <Button title="Edit" variant="ghost" size="sm" onPress={onEdit} /> : null}
      {onDelete ? <Button title="×" variant="ghost" size="sm" onPress={onDelete} /> : null}
    </Card>
  );
}
