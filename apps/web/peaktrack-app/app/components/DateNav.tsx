import { addDays, format, parseISO, subDays } from 'date-fns';
import { View } from 'react-native';
import { Button, Text } from '@evil-empire/ui';

interface DateNavProps {
  date: string;
  onChange: (date: string) => void;
}

export function DateNav({ date, onChange }: DateNavProps) {
  const parsed = parseISO(date);
  const goPrev = () => onChange(format(subDays(parsed, 1), 'yyyy-MM-dd'));
  const goNext = () => onChange(format(addDays(parsed, 1), 'yyyy-MM-dd'));
  const goToday = () => onChange(format(new Date(), 'yyyy-MM-dd'));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Button title="‹" variant="outline" size="sm" onPress={goPrev} />
      <View style={{ minWidth: 220, alignItems: 'center' }}>
        <Text variant="heading">{format(parsed, 'EEEE')}</Text>
        <Text variant="caption">{format(parsed, 'LLLL d, yyyy')}</Text>
      </View>
      <Button title="›" variant="outline" size="sm" onPress={goNext} />
      <Button title="Today" variant="ghost" size="sm" onPress={goToday} />
    </View>
  );
}
