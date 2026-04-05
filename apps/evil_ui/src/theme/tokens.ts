export const colors = {
  background: '#0D0D0D',
  'background-card': '#1A1A1A',
  'background-elevated': '#222222',
  'background-input': '#262626',
  border: '#2A2A2A',
  'border-focus': '#c65d24',
  primary: '#c65d24',
  'primary-foreground': '#FFFFFF',
  'primary-muted': '#A04D1E',
  success: '#22C55E',
  'success-muted': '#166534',
  destructive: '#EF4444',
  'destructive-muted': '#991B1B',
  warning: '#F59E0B',
  text: '#FFFFFF',
  'text-secondary': '#9BA1A6',
  'text-muted': '#666666',
  'chart-line-1': '#c65d24',
  'chart-line-2': '#FFFFFF',
} as const;

export const typography = {
  display:    { size: 32, weight: '700' as const, lineHeight: 1.2 },
  'heading-lg': { size: 24, weight: '700' as const, lineHeight: 1.3 },
  heading:    { size: 20, weight: '600' as const, lineHeight: 1.3 },
  'heading-sm': { size: 16, weight: '600' as const, lineHeight: 1.4 },
  body:       { size: 14, weight: '400' as const, lineHeight: 1.5 },
  'body-sm':  { size: 12, weight: '400' as const, lineHeight: 1.5 },
  caption:    { size: 10, weight: '500' as const, lineHeight: 1.4 },
  mono:       { size: 13, weight: '400' as const, lineHeight: 1.5 },
} as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export type TacticalColors = typeof colors;
export type TacticalTypography = typeof typography;
export type TacticalSpacing = typeof spacing;
export type TacticalRadius = typeof radius;
