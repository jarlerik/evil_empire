import { useMemo } from 'react';
import { View } from 'react-native';
import { Text, TerminalBlock, type TerminalLine, colors } from '@evil-empire/ui';
import { Link } from '@tanstack/react-router';
import { parseProgramText } from '@evil-empire/peaktrack-services';

interface ProgramPlanEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Disables the textarea while a save is in flight. */
  disabled?: boolean;
}

const PLACEHOLDER = `## 3 x week

6 x 2 @80%
4 x 5 @70%
3 x 5 @75%

5 x 2 @85%
4 x 5 @72%
3 x 5 @78%`;

/**
 * Free-text program plan editor with a live `parseProgramText` preview.
 *
 * The textarea is a plain DOM `<textarea>` rather than evil_ui's `Input`
 * because RN/RN-Web's `TextInput` strips newlines on paste in some browsers
 * and we want a monospace block large enough to fit a multi-week plan.
 */
export function ProgramPlanEditor({ value, onChange, disabled }: ProgramPlanEditorProps) {
  const parsed = useMemo(() => parseProgramText(value), [value]);

  const previewLines: TerminalLine[] = useMemo(() => {
    const lines: TerminalLine[] = [];
    if (parsed.weeks.length === 0) {
      lines.push({
        id: 'empty',
        text: '// Paste a plan above to see the parsed sessions here.',
        color: colors['text-secondary'],
      });
      return lines;
    }
    if (parsed.sessionsPerWeek != null) {
      lines.push({
        id: 'header',
        text: `// ${parsed.sessionsPerWeek} session${parsed.sessionsPerWeek === 1 ? '' : 's'}/week`,
        color: colors['text-secondary'],
      });
    }
    for (const week of parsed.weeks) {
      lines.push({
        id: `w${week.weekNumber}`,
        text: `Week ${week.weekNumber}`,
        color: colors.primary,
      });
      week.sessions.forEach((sess, idx) => {
        const label = sess.name ? `${sess.name}: ${sess.rawInput}` : sess.rawInput;
        lines.push({
          id: `w${week.weekNumber}-s${idx}`,
          text: `  ${label}`,
        });
      });
    }
    return lines;
  }, [parsed]);

  const summary =
    parsed.weeks.length === 0
      ? null
      : `${parsed.weeks.length} week${parsed.weeks.length === 1 ? '' : 's'}` +
        (parsed.sessionsPerWeek ? ` · ${parsed.sessionsPerWeek}/week` : '');

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="heading-sm">Plan</Text>
        <Link
          to="/help/input-format"
          style={{ color: colors.primary, fontSize: 12, textDecoration: 'none' }}
        >
          Syntax help
        </Link>
      </View>
      <Text variant="caption">
        Each line is a session, e.g. "6 x 2 @80%". Blank line separates weeks. First line may be "## N x week".
      </Text>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        style={{
          width: '100%',
          minHeight: 260,
          padding: 12,
          background: colors['background-elevated'],
          color: colors.text,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          fontFamily: 'Menlo, Consolas, monospace',
          fontSize: 13,
          lineHeight: 1.5,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      {summary ? <Text variant="caption">{summary}</Text> : null}

      {parsed.errors.length > 0 ? (
        <View style={{ gap: 4 }}>
          {parsed.errors.map((e, i) => (
            <Text key={i} variant="caption" color={colors.destructive}>
              • {e}
            </Text>
          ))}
        </View>
      ) : null}

      {parsed.warnings.length > 0 ? (
        <View style={{ gap: 4 }}>
          {parsed.warnings.map((w, i) => (
            <Text key={i} variant="caption" color="#eab308">
              • {w}
            </Text>
          ))}
        </View>
      ) : null}

      <Text variant="heading-sm">Preview</Text>
      <TerminalBlock lines={previewLines} maxHeight={260} />
    </View>
  );
}
