import { type Bar, isBullish, isBearish, barBodySize } from "../../utils/bar.js";
import { isDoji } from "./single.js";

// Morning Star: bearish → small body/doji → bullish (bullish reversal)
export function isMorningStar(first: Bar, second: Bar, third: Bar): boolean {
  const firstBody = barBodySize(first);
  const secondBody = barBodySize(second);
  const thirdBody = barBodySize(third);

  return (
    isBearish(first) &&
    firstBody > 0 &&
    secondBody < firstBody * 0.3 &&
    isBullish(third) &&
    thirdBody > firstBody * 0.5 &&
    third.close > (first.open + first.close) / 2
  );
}

// Evening Star: bullish → small body/doji → bearish (bearish reversal)
export function isEveningStar(first: Bar, second: Bar, third: Bar): boolean {
  const firstBody = barBodySize(first);
  const secondBody = barBodySize(second);
  const thirdBody = barBodySize(third);

  return (
    isBullish(first) &&
    firstBody > 0 &&
    secondBody < firstBody * 0.3 &&
    isBearish(third) &&
    thirdBody > firstBody * 0.5 &&
    third.close < (first.open + first.close) / 2
  );
}

// Three White Soldiers: three consecutive bullish bars, each closing higher
export function isThreeWhiteSoldiers(
  first: Bar,
  second: Bar,
  third: Bar
): boolean {
  return (
    isBullish(first) &&
    isBullish(second) &&
    isBullish(third) &&
    second.open > first.open &&
    second.close > first.close &&
    third.open > second.open &&
    third.close > second.close &&
    // Each bar should have a decent body (not dojis)
    !isDoji(first) &&
    !isDoji(second) &&
    !isDoji(third)
  );
}

// Three Black Crows: three consecutive bearish bars, each closing lower
export function isThreeBlackCrows(
  first: Bar,
  second: Bar,
  third: Bar
): boolean {
  return (
    isBearish(first) &&
    isBearish(second) &&
    isBearish(third) &&
    second.open < first.open &&
    second.close < first.close &&
    third.open < second.open &&
    third.close < second.close &&
    !isDoji(first) &&
    !isDoji(second) &&
    !isDoji(third)
  );
}
