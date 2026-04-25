import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text, colors } from '@evil-empire/ui';
import { useUserSettings } from '../contexts/UserSettingsContext';

export const Route = createFileRoute('/_app/help/input-format')({
  component: InputFormatHelp,
});

interface Section {
  title: string;
  description: string;
  examples: string[];
  note: string;
}

function buildSections(u: 'kg' | 'lbs'): Section[] {
  return [
    {
      title: 'Basic Format',
      description: `Standard format for sets, reps, and weight. Weight unit is required (${u}, %, or RIR).`,
      examples: [`4 x 6@80${u}`, '4 x 6@80%', '4 x 6@1RIR'],
      note: `Format: sets x reps @weight (${u}), sets x reps @percentage (%), or sets x reps @RIR. The unit (${u}, %, or RIR) is required.`,
    },
    {
      title: 'Compound Exercises',
      description: 'For exercises with multiple rep parts, such as complex movements. Weight unit is required.',
      examples: [`4 x 2 + 2@50${u}`, '4 x 2 + 2@60%', `3 x 1 + 3@75${u}`, `4 x 1 + 2 + 2 + 2@40${u}`],
      note: `Format: sets x reps1 + reps2 (+ reps3...) @weight (${u}) or @percentage (%). The total reps are calculated automatically.`,
    },
    {
      title: 'Multiple Weights',
      description: `Specify different weights for each set. Unit (${u} or %) must be at the end.`,
      examples: [`3 x 1@55 60 65${u}`, '3 x 1@60 70 75%', `4 x 5@100 110 120 130${u}`],
      note: `Format: sets x reps @weight1 weight2 weight3...${u}. The number of weights must match the number of sets.`,
    },
    {
      title: 'Wave Exercises',
      description: 'Decreasing reps across sets with the same weight pattern.',
      examples: [`3-2-1-3-2-1 50 55 60 55 65 70${u}`, '3-2-1-2-2-1 60 70 80 65 75 85%'],
      note: `Format: reps1-reps2-reps3... weight (${u} or %). Each number represents reps for one set. Creates multiple phases automatically.`,
    },
    {
      title: 'Percentage-Based Weight',
      description: 'Use a percentage of your 1RM. Requires a 1RM to be set in Rep maxes. The % unit is required.',
      examples: ['4 x 5@80%', '3 x 1 + 1 + 1@60%'],
      note: 'Format: sets x reps@percentage (%). The app will look up your 1RM for the exercise and calculate the weight. Works with compound exercises too.',
    },
    {
      title: 'Percentage Range',
      description: 'Use a range of percentages of your 1RM.',
      examples: ['4 x 5@80-85%', '3 x 5@85-89%'],
      note: 'Format: sets x reps@min%-max%. The minimum percentage must be less than or equal to the maximum.',
    },
    {
      title: 'Weight Range',
      description: `Specify a range of absolute weights. The ${u} unit is required.`,
      examples: [`4 x 5@85-89${u}`, `3 x 3@50-55${u}`],
      note: `Format: sets x reps@min-max${u}. The minimum weight must be less than or equal to the maximum.`,
    },
    {
      title: 'Circuit Format',
      description: 'Multiple exercises performed in sequence.',
      examples: [
        '2 x 10/10 banded side step, 10 banded skated walk forward...',
        '3 sets of 10 push-ups, 15 squats',
      ],
      note: 'Format: sets x exercise1, exercise2... Each exercise can include reps (e.g., "10/10" or "10") followed by the exercise name.',
    },
    {
      title: 'RM Build',
      description: 'Build up to a target repetition maximum.',
      examples: ['Build to 8RM', 'build to 5rm'],
      note: 'Format: Build to XRM (case insensitive). Used for progressive loading to find your repetition maximum.',
    },
    {
      title: 'RIR (Reps in Reserve)',
      description: 'Specify target reps in reserve. Can be used as a unit after weight or as a standalone format.',
      examples: ['4 x 6@1RIR', '4 x 6 1RIR', '4 x 8 2-3RIR'],
      note: 'Format: sets x reps@RIR (as unit) or sets x reps RIR (standalone). Range supported (e.g., "2-3RIR").',
    },
    {
      title: 'Rest Time',
      description: 'Add rest time between sets. Rest time unit is mandatory.',
      examples: [`4 x 3@50${u} 120s`, '4 x 3@50% 2min', '3 x 5 @80% 90s', `4 x 3 @50${u} 2m`],
      note: 'Format: ...rest time. Add rest time at the end using "s"/"sec" for seconds, or "m"/"min" for minutes.',
    },
    {
      title: 'Combining Formats',
      description: 'Many formats can be combined together.',
      examples: ['4 x 1 + 2 + 2 + 2@60% 120s', '2x 10, 2-3RIR 180s', '3-2-1-1-1 65 90s'],
      note: 'Compound exercises with percentages, RIR with rest time, wave exercises with rest time, etc.',
    },
  ];
}

function InputFormatHelp() {
  const navigate = useNavigate();
  const router = useRouter();
  const { settings } = useUserSettings();
  const u = settings?.weight_unit ?? 'kg';
  const sections = buildSections(u);

  const handleBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
    } else {
      navigate({ to: '/' });
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button title="‹ Back" variant="ghost" size="sm" onPress={handleBack} />
        <Text variant="display">Exercise input syntax</Text>
      </View>

      {sections.map((s) => (
        <Card key={s.title} variant="bordered" style={{ gap: 8 }}>
          <Text variant="heading-sm">{s.title}</Text>
          <Text variant="body-sm">{s.description}</Text>
          <View
            style={{
              backgroundColor: colors['background-elevated'],
              borderRadius: 6,
              padding: 12,
              gap: 4,
            }}
          >
            {s.examples.map((ex) => (
              <Text key={ex} variant="mono" color={colors.primary}>
                {ex}
              </Text>
            ))}
          </View>
          <Text variant="caption">{s.note}</Text>
        </Card>
      ))}

      <Card variant="bordered" style={{ gap: 6 }}>
        <Text variant="heading-sm">Tips</Text>
        <Text variant="body-sm">
          • Weight unit is always required: {u}, %, or RIR{'\n'}
          • Extra spaces are automatically handled{'\n'}
          • Case doesn't matter ("{u.toUpperCase()}", "{u}" all work){'\n'}
          • Decimal weights are supported (e.g., 75.5{u}){'\n'}
          • For multiple weights, the unit goes at the end (e.g., "3 x 1@55 60 65{u}"){'\n'}
          • For percentage-based formats, set a 1RM in Rep maxes first
        </Text>
      </Card>
    </ScrollView>
  );
}
