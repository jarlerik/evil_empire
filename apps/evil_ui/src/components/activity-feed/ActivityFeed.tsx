import { View, FlatList, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors } from '../../theme/tokens';

export interface ActivityItem {
  id: string;
  timestamp: string;
  message: string;
  highlightedText?: string;
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  maxHeight?: number;
}

export function ActivityFeed({ items, maxHeight }: ActivityFeedProps) {
  return (
    <View style={[styles.container, maxHeight ? { maxHeight } : undefined]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text variant="caption" color={colors['text-muted']} style={styles.timestamp}>
              {item.timestamp}
            </Text>
            <Text variant="body-sm" color={colors['text-secondary']}>
              {item.highlightedText ? (
                renderHighlighted(item.message, item.highlightedText)
              ) : (
                item.message
              )}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function renderHighlighted(message: string, highlight: string) {
  const parts = message.split(new RegExp(`(${highlight})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === highlight.toLowerCase() ? (
      <Text key={i} variant="body-sm" color={colors.primary}>{part}</Text>
    ) : (
      part
    )
  );
}

const styles = StyleSheet.create({
  container: {},
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  timestamp: { marginBottom: 2 },
});
