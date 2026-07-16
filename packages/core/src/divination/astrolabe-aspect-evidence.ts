export type AstrolabeAspectCloseness = '紧密' | '中等' | '宽松';

export function classifyAspectClosenessByRatio(ratio: number): AstrolabeAspectCloseness {
  if (!Number.isFinite(ratio) || ratio < 0) return '宽松';
  if (ratio <= 1 / 3) return '紧密';
  if (ratio <= 2 / 3) return '中等';
  return '宽松';
}

export function normalizedOrbRatioFromStrength(strength: number): number {
  const normalizedStrength = Math.max(0, Math.min(100, strength));
  return Number((1 - normalizedStrength / 100).toFixed(4));
}

export function classifyAspectClosenessFromStrength(strength: number): AstrolabeAspectCloseness {
  return classifyAspectClosenessByRatio(normalizedOrbRatioFromStrength(strength));
}
