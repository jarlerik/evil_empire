import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors } from '../../theme/tokens';

export interface HeaderProps {
  breadcrumbs: string[];
  timestamp?: string;
  actions?: React.ReactNode;
}

export function Header({ breadcrumbs, timestamp, actions }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.breadcrumbs}>
        {breadcrumbs.map((crumb, i) => (
          <View key={i} style={styles.crumbRow}>
            {i > 0 && <Text variant="body" color={colors['text-muted']}> / </Text>}
            <Text
              variant="body"
              color={i === breadcrumbs.length - 1 ? colors.text : colors['text-muted']}
            >
              {crumb}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.right}>
        {timestamp && (
          <Text variant="body-sm" color={colors['text-muted']} style={styles.timestamp}>
            LAST UPDATE: {timestamp}
          </Text>
        )}
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors['background-card'],
  },
  breadcrumbs: { flexDirection: 'row', alignItems: 'center' },
  crumbRow: { flexDirection: 'row' },
  right: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { marginRight: 12 },
});
