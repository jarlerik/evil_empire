import {
  type Bar,
  barBodySize,
  barRange,
  isBullish,
  isBearish,
  upperWick,
  lowerWick,
} from "../../utils/bar.js";

// Thresholds as ratios of bar range
const DOJI_BODY_RATIO = 0.1;
const SMALL_BODY_RATIO = 0.3;
const LARGE_BODY_RATIO = 0.7;
const LONG_WICK_RATIO = 0.6;

function bodyRatio(bar: Bar): number {
  const range = barRange(bar);
  return range === 0 ? 0 : barBodySize(bar) / range;
}

// Hammer: small body at top, long lower wick (bullish reversal)
export function isHammer(bar: Bar): boolean {
  const range = barRange(bar);
  if (range === 0) return false;
  return (
    bodyRatio(bar) < SMALL_BODY_RATIO &&
    lowerWick(bar) / range >= LONG_WICK_RATIO &&
    upperWick(bar) / range < 0.15
  );
}

// Inverted Hammer: small body at bottom, long upper wick (bullish reversal)
export function isInvertedHammer(bar: Bar): boolean {
  const range = barRange(bar);
  if (range === 0) return false;
  return (
    bodyRatio(bar) < SMALL_BODY_RATIO &&
    upperWick(bar) / range >= LONG_WICK_RATIO &&
    lowerWick(bar) / range < 0.15
  );
}

// Shooting Star: small body at bottom, long upper wick (bearish reversal)
// Same shape as inverted hammer but in uptrend context
export function isShootingStar(bar: Bar): boolean {
  return isInvertedHammer(bar) && isBearish(bar);
}

// Hanging Man: same shape as hammer but in uptrend (bearish)
export function isHangingMan(bar: Bar): boolean {
  return isHammer(bar) && isBearish(bar);
}

// Doji: open ≈ close
export function isDoji(bar: Bar): boolean {
  return bodyRatio(bar) < DOJI_BODY_RATIO;
}

// Dragonfly Doji: doji with long lower wick, no upper wick
export function isDragonflyDoji(bar: Bar): boolean {
  const range = barRange(bar);
  if (range === 0) return false;
  return (
    isDoji(bar) &&
    lowerWick(bar) / range >= LONG_WICK_RATIO &&
    upperWick(bar) / range < 0.1
  );
}

// Gravestone Doji: doji with long upper wick, no lower wick
export function isGravestoneDoji(bar: Bar): boolean {
  const range = barRange(bar);
  if (range === 0) return false;
  return (
    isDoji(bar) &&
    upperWick(bar) / range >= LONG_WICK_RATIO &&
    lowerWick(bar) / range < 0.1
  );
}

// Spinning Top: small body, wicks on both sides
export function isSpinningTop(bar: Bar): boolean {
  const range = barRange(bar);
  if (range === 0) return false;
  const br = bodyRatio(bar);
  return (
    br > DOJI_BODY_RATIO &&
    br < SMALL_BODY_RATIO &&
    upperWick(bar) / range > 0.2 &&
    lowerWick(bar) / range > 0.2
  );
}

// Marubozu: large body, no/minimal wicks (strong momentum)
export function isBullishMarubozu(bar: Bar): boolean {
  return isBullish(bar) && bodyRatio(bar) >= LARGE_BODY_RATIO;
}

export function isBearishMarubozu(bar: Bar): boolean {
  return isBearish(bar) && bodyRatio(bar) >= LARGE_BODY_RATIO;
}
