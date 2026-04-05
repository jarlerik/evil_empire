import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors, radius } from '../../theme/tokens';

export interface TerminalLine {
  id: string;
  text: string;
  color?: string;
}

export interface TerminalBlockProps {
  lines: TerminalLine[];
  maxHeight?: number;
}

export function TerminalBlock({ lines, maxHeight = 200 }: TerminalBlockProps) {
  return (
    <View style={styles.container}>
      <ScrollView style={{ maxHeight }}>
        {lines.map((line) => (
          <Text
            key={line.id}
            variant="mono"
            color={line.color ?? colors['text-secondary']}
            style={styles.line}
          >
            {line.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors['background-elevated'],
    borderRadius: radius.md,
    padding: 12,
  },
  line: {
    paddingVertical: 2,
  },
});
