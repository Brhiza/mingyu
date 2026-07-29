import type { Pillars } from './baziTypes';

export type PatternExposedStemPosition = 'year' | 'month' | 'hour';

export interface PatternExposedStemFact {
  position: PatternExposedStemPosition;
  columnIndex: number;
  label: string;
  stem: string;
  tenGod: string;
}

export type PatternGetTenGodFn = (gan: string, dayMaster: string) => string;

const EXPOSED_STEM_POSITIONS: Array<{
  position: PatternExposedStemPosition;
  columnIndex: number;
  label: string;
}> = [
  { position: 'year', columnIndex: 0, label: '年干' },
  { position: 'month', columnIndex: 1, label: '月干' },
  { position: 'hour', columnIndex: 3, label: '时干' },
];

export function collectPatternExposedStemFacts(
  pillars: Pillars,
  getTenGod: PatternGetTenGodFn,
): PatternExposedStemFact[] {
  const dayMaster = pillars.day.gan;
  return EXPOSED_STEM_POSITIONS.map(({ position, columnIndex, label }) => {
    const stem = pillars[position].gan;
    return {
      position,
      columnIndex,
      label,
      stem,
      tenGod: getTenGod(stem, dayMaster),
    };
  });
}

export function areAdjacentPatternStemColumns(
  left: PatternExposedStemFact,
  right: PatternExposedStemFact,
): boolean {
  return Math.abs(left.columnIndex - right.columnIndex) === 1;
}
