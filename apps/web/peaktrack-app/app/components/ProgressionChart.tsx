import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@evil-empire/ui';
import type { ColumnLayout, TileColor } from '@evil-empire/peaktrack-services';
import { PROGRESSION_NEUTRAL, PROGRESSION_PRIMARY } from './ProgressionChart.constants';

const PRIMARY = PROGRESSION_PRIMARY;
const NEUTRAL = PROGRESSION_NEUTRAL;
const TEXT = '#ffffff';
const TEXT_MUTED = '#666666';
const BORDER = '#1a1a1a';

const MIN_SESSION_WIDTH = 44;
const COLUMN_GAP = 8;
const TILE_SIZE = 12;
const TILE_GAP = 2;
const TREND_HEIGHT = 140;
const TREND_TOP_PADDING = 12;
const TREND_BOTTOM_PADDING = 12;
const SET_COLUMN_GAP = 2;

export interface ChartSession {
  key: string;
  columns: ColumnLayout[];
  volume: number | null;
  volumeDim?: boolean;
  headerWeightLabel?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  dotFilled?: boolean;
}

interface ProgressionChartProps {
  sessions: ChartSession[];
  weightUnit: string;
  legend?: { color: string; opacity?: number; label: string }[];
}

function tileBackground(color: TileColor): { backgroundColor: string; opacity: number } {
  switch (color) {
    case 'bright':
    case 'dark':
      return { backgroundColor: PRIMARY, opacity: 1 };
    case 'faded-bright':
    case 'faded-dark':
      return { backgroundColor: PRIMARY, opacity: 0.5 };
    case 'dim':
      return { backgroundColor: PRIMARY, opacity: 0.2 };
    case 'neutral':
    default:
      return { backgroundColor: NEUTRAL, opacity: 1 };
  }
}

function intrinsicSessionWidth(setCount: number): number {
  if (setCount <= 0) return MIN_SESSION_WIDTH;
  const stackWidth = setCount * TILE_SIZE + Math.max(0, setCount - 1) * SET_COLUMN_GAP;
  return Math.max(MIN_SESSION_WIDTH, stackWidth);
}

function maxStackHeightTiles(sessions: ChartSession[]): number {
  let max = 0;
  for (const s of sessions) {
    for (const col of s.columns) {
      if (col.tiles.length > max) max = col.tiles.length;
    }
  }
  return max;
}

export function ProgressionChart({ sessions, legend }: ProgressionChartProps) {
  const geometry = useMemo(() => {
    let uniformWidth = MIN_SESSION_WIDTH;
    for (const s of sessions) {
      const w = intrinsicSessionWidth(s.columns.length);
      if (w > uniformWidth) uniformWidth = w;
    }
    const centers: number[] = [];
    let x = 0;
    for (let i = 0; i < sessions.length; i += 1) {
      centers.push(x + uniformWidth / 2);
      x += uniformWidth + (i < sessions.length - 1 ? COLUMN_GAP : 0);
    }
    return { uniformWidth, centers, totalWidth: x };
  }, [sessions]);

  const maxVolume = useMemo(() => {
    let max = 0;
    for (const s of sessions) {
      const v = s.volume ?? 0;
      if (v > max) max = v;
    }
    return max;
  }, [sessions]);

  const stackHeight = maxStackHeightTiles(sessions) * (TILE_SIZE + TILE_GAP);
  const hasPerColumnWeight = sessions.some((s) => s.columns.some((c) => c.weightLabel));
  const labelExtraHeight = hasPerColumnWeight ? 16 : 0;

  const trendPoints = sessions
    .map((s, i) => {
      if (s.volume == null || maxVolume === 0) return null;
      const yNorm = 1 - s.volume / maxVolume;
      const y = TREND_TOP_PADDING + yNorm * (TREND_HEIGHT - TREND_TOP_PADDING - TREND_BOTTOM_PADDING);
      return {
        x: geometry.centers[i] ?? 0,
        y,
        filled: s.dotFilled ?? true,
      };
    })
    .filter((p): p is { x: number; y: number; filled: boolean } => p !== null);

  return (
    <View style={{ gap: 0 }}>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <View style={{ width: geometry.totalWidth, paddingHorizontal: 4, paddingVertical: 8 }}>
          {/* Trend line */}
          <View style={{ width: geometry.totalWidth, height: TREND_HEIGHT }}>
            {trendPoints.length > 1 ? (
              <svg width={geometry.totalWidth} height={TREND_HEIGHT}>
                <polyline
                  points={trendPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={PRIMARY}
                  strokeWidth={2}
                />
                {trendPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill={p.filled ? PRIMARY : NEUTRAL}
                    stroke={PRIMARY}
                    strokeWidth={1}
                  />
                ))}
              </svg>
            ) : null}
          </View>

          {/* Volume row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              marginBottom: 6,
              gap: COLUMN_GAP,
            }}
          >
            {sessions.map((s) => (
              <View
                key={s.key}
                style={{ width: geometry.uniformWidth, alignItems: 'center' }}
              >
                <Text
                  style={{
                    color: s.volumeDim ? TEXT_MUTED : TEXT,
                    fontSize: 11,
                    fontWeight: '600',
                  }}
                >
                  {s.volume != null ? s.volume : '—'}
                </Text>
              </View>
            ))}
          </View>

          {/* Tile stacks */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              height: stackHeight + labelExtraHeight,
              gap: COLUMN_GAP,
            }}
          >
            {sessions.map((s) => (
              <SessionStack
                key={s.key}
                columns={s.columns}
                width={geometry.uniformWidth}
                totalHeight={stackHeight + labelExtraHeight}
                tileStackHeight={stackHeight}
              />
            ))}
          </View>

          {/* Bottom labels */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 8,
              gap: COLUMN_GAP,
            }}
          >
            {sessions.map((s) => (
              <View
                key={s.key}
                style={{ width: geometry.uniformWidth, alignItems: 'center' }}
              >
                {s.headerWeightLabel ? (
                  <Text style={{ color: PRIMARY, fontSize: 10, marginBottom: 2 }}>
                    {s.headerWeightLabel}
                  </Text>
                ) : null}
                <Text style={{ color: TEXT, fontSize: 11, fontWeight: '600' }}>
                  {s.primaryLabel}
                </Text>
                {s.secondaryLabel ? (
                  <Text style={{ color: TEXT_MUTED, fontSize: 10, marginTop: 2 }}>
                    {s.secondaryLabel}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </div>

      {legend && legend.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            paddingHorizontal: 8,
            paddingVertical: 12,
            marginTop: 12,
            borderTopWidth: 1,
            borderTopColor: BORDER,
          }}
        >
          {legend.map((item) => (
            <View
              key={item.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: item.color,
                  opacity: item.opacity ?? 1,
                }}
              />
              <Text style={{ color: TEXT_MUTED, fontSize: 11 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface SessionStackProps {
  columns: ColumnLayout[];
  width: number;
  totalHeight: number;
  tileStackHeight: number;
}

function SessionStack({ columns, width, totalHeight, tileStackHeight }: SessionStackProps) {
  const intrinsic = intrinsicSessionWidth(columns.length);
  const leftPad = Math.max(0, Math.round((width - intrinsic) / 2));
  return (
    <View
      style={{
        width,
        height: totalHeight,
        paddingLeft: leftPad,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: SET_COLUMN_GAP,
      }}
    >
      {columns.map((col, idx) => (
        <View
          key={idx}
          style={{
            width: TILE_SIZE,
            height: tileStackHeight,
            flexDirection: 'column-reverse',
            alignItems: 'center',
            gap: TILE_GAP,
          }}
        >
          {col.tiles.map((tile, tIdx) => {
            const bg = tileBackground(tile);
            return (
              <View
                key={tIdx}
                style={{
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  backgroundColor: bg.backgroundColor,
                  opacity: bg.opacity,
                }}
              />
            );
          })}
          {col.weightLabel ? (
            <Text
              style={{
                position: 'absolute',
                bottom: -14,
                left: -12,
                right: -12,
                textAlign: 'center',
                color: TEXT_MUTED,
                fontSize: 9,
              }}
              numberOfLines={1}
            >
              {col.weightLabel}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

