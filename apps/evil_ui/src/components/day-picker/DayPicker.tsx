import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors, radius } from '../../theme/tokens';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DayPickerProps {
  /** Selected ISO day-of-week values (1 = Mon … 7 = Sun). */
  value: DayOfWeek[];
  /** Called with the next selection whenever the user taps a chip. */
  onChange: (next: DayOfWeek[]) => void;
  /** Optional text rendered above the row of chips. */
  label?: string;
  /** Disables interaction and dims the chips. */
  disabled?: boolean;
  /** Override chip labels. Must be an array of 7 strings, Mon-first. */
  dayLabels?: readonly [string, string, string, string, string, string, string];
  /**
   * When `true`, a tap on a selected chip removes it. Defaults to `true`.
   * Set to `false` when the caller needs to enforce "at least one day"
   * semantics — the component will simply ignore taps that would empty the
   * selection.
   */
  allowDeselect?: boolean;
  /** Accessibility label for the group as a whole. Defaults to the `label`. */
  accessibilityLabel?: string;
}

const DEFAULT_LABELS: readonly [string, string, string, string, string, string, string] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

const DAYS: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * A compact row of day-of-week toggle chips.
 *
 * Emits a de-duplicated, ascending `DayOfWeek[]` on every change so callers
 * can trust ordering (e.g. session[0] → first selected day, session[1] →
 * second, …). ISO convention: Monday = 1, Sunday = 7.
 */
export function DayPicker({
  value,
  onChange,
  label,
  disabled,
  dayLabels = DEFAULT_LABELS,
  allowDeselect = true,
  accessibilityLabel,
}: DayPickerProps) {
  const selected = new Set<DayOfWeek>(value);

  const toggle = useCallback(
    (day: DayOfWeek) => {
      if (disabled) {
        return;
      }
      const next = new Set(selected);
      if (next.has(day)) {
        if (!allowDeselect && next.size === 1) {
          return;
        }
        next.delete(day);
      } else {
        next.add(day);
      }
      onChange(Array.from(next).sort((a, b) => a - b) as DayOfWeek[]);
    },
    [allowDeselect, disabled, onChange, selected],
  );

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {label ? (
        <Text variant="heading-sm" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={styles.row}>
        {DAYS.map((day, idx) => {
          const isSelected = selected.has(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggle(day)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled }}
              accessibilityLabel={dayLabels[idx]}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <Text
                variant="body-sm"
                color={isSelected ? colors['primary-foreground'] : colors['text-secondary']}
                style={styles.chipText}
              >
                {dayLabels[idx]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    minWidth: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  chipText: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
