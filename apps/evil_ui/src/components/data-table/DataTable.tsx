import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { Pressable } from '../../primitives/Pressable';
import { colors } from '../../theme/tokens';

export interface DataTableColumn<T> {
  key: string;
  title: string;
  width?: number;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowPress?: (item: T) => void;
}

export function DataTable<T>({ columns, data, keyExtractor, onRowPress }: DataTableProps<T>) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {columns.map((col) => (
          <View key={col.key} style={[styles.cell, col.width ? { width: col.width } : { flex: 1 }]}>
            <Text variant="caption" color={colors['text-muted']}>{col.title}</Text>
          </View>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => {
          const row = (
            <View style={styles.row}>
              {columns.map((col) => (
                <View key={col.key} style={[styles.cell, col.width ? { width: col.width } : { flex: 1 }]}>
                  {col.render ? col.render(item) : (
                    <Text variant="body-sm" color={colors.text}>
                      {String((item as Record<string, unknown>)[col.key] ?? '')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          );
          if (onRowPress) {
            return <Pressable onPress={() => onRowPress(item)}>{row}</Pressable>;
          }
          return row;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: {
    paddingHorizontal: 8,
  },
});
