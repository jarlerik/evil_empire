import { View } from 'react-native';
import { Button, Card, Pressable, Text } from '@evil-empire/ui';
import type { RmMatch } from '../lib/rm-lookup';
import { Modal } from './Modal';

interface RmSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (match: RmMatch) => void;
  onAddNew: () => void;
  matches: RmMatch[];
  exerciseName: string;
  unit?: 'kg' | 'lbs';
}

export function RmSelectModal({
  open,
  onClose,
  onSelect,
  onAddNew,
  matches,
  exerciseName,
  unit = 'kg',
}: RmSelectModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Select 1RM">
      <View style={{ gap: 16 }}>
        <Text variant="heading">Pick a 1RM</Text>
        <Text variant="caption">
          No exact match for "{exerciseName}". These look similar:
        </Text>
        <View style={{ gap: 8 }}>
          {matches.map((m) => (
            <Pressable key={`${m.exerciseName}-${m.weight}`} onPress={() => onSelect(m)}>
              <Card variant="bordered" style={{ padding: 12 }}>
                <Text variant="body">{m.exerciseName}</Text>
                <Text variant="caption">
                  {m.weight}
                  {unit}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add new RM" variant="primary" onPress={onAddNew} />
        </View>
      </View>
    </Modal>
  );
}
