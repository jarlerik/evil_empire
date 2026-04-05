import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { Pressable } from '../../primitives/Pressable';
import { colors, radius } from '../../theme/tokens';

export interface NavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SidebarNavProps {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function SidebarNav({ items, activeKey, onSelect, collapsed, header, footer }: SidebarNavProps) {
  return (
    <View style={styles.container}>
      {header && <View style={styles.header}>{header}</View>}
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable key={item.key} onPress={() => onSelect(item.key)}>
            <View style={[styles.item, active && styles.activeItem]}>
              {item.icon && <View style={styles.icon}>{item.icon}</View>}
              {!collapsed && (
                <Text variant="body" color={active ? colors.primary : colors['text-secondary']}>
                  {item.label}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors['background-card'],
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: 16,
    width: 200,
  },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 16, marginTop: 'auto' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginHorizontal: 8,
  },
  activeItem: {
    backgroundColor: colors.primary,
  },
  icon: { marginRight: 10 },
});
