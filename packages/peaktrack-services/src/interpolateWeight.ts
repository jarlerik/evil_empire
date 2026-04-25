export function interpolateWeight(weightMin: number, weightMax: number, currentSet: number, totalSets: number): number {
	if (totalSets <= 1) return weightMax;
	return Math.round(weightMin + (weightMax - weightMin) * (currentSet - 1) / (totalSets - 1));
}
