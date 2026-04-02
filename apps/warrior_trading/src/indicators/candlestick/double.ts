import {
  type Bar,
  barBodySize,
  barRange,
  isBullish,
  isBearish,
  midpoint,
} from "../../utils/bar.js";

// Bullish Engulfing: bearish bar followed by larger bullish bar that engulfs it
export function isBullishEngulfing(prev: Bar, curr: Bar): boolean {
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open <= prev.close &&
    curr.close >= prev.open &&
    barBodySize(curr) > barBodySize(prev)
  );
}

// Bearish Engulfing: bullish bar followed by larger bearish bar
export function isBearishEngulfing(prev: Bar, curr: Bar): boolean {
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open >= prev.close &&
    curr.close <= prev.open &&
    barBodySize(curr) > barBodySize(prev)
  );
}

// Bullish Harami: large bearish bar followed by small bullish bar within its body
export function isBullishHarami(prev: Bar, curr: Bar): boolean {
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open >= prev.close &&
    curr.close <= prev.open &&
    barBodySize(curr) < barBodySize(prev) * 0.5
  );
}

// Bearish Harami: large bullish bar followed by small bearish bar within its body
export function isBearishHarami(prev: Bar, curr: Bar): boolean {
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open <= prev.close &&
    curr.close >= prev.open &&
    barBodySize(curr) < barBodySize(prev) * 0.5
  );
}

// Tweezer Bottom: two bars with same/similar lows (bullish reversal)
export function isTweezerBottom(prev: Bar, curr: Bar): boolean {
  const tolerance = barRange(prev) * 0.05;
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    Math.abs(prev.low - curr.low) <= tolerance
  );
}

// Tweezer Top: two bars with same/similar highs (bearish reversal)
export function isTweezerTop(prev: Bar, curr: Bar): boolean {
  const tolerance = barRange(prev) * 0.05;
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    Math.abs(prev.high - curr.high) <= tolerance
  );
}

// Piercing Line: bearish bar, then bullish bar opens below prev low, closes above prev midpoint
export function isPiercingLine(prev: Bar, curr: Bar): boolean {
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.low &&
    curr.close > midpoint(prev) &&
    curr.close < prev.open
  );
}

// Dark Cloud Cover: bullish bar, then bearish bar opens above prev high, closes below prev midpoint
export function isDarkCloudCover(prev: Bar, curr: Bar): boolean {
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.high &&
    curr.close < midpoint(prev) &&
    curr.close > prev.open
  );
}
