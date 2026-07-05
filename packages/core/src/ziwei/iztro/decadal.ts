import type { PalaceFact } from '../../types/analysis';
import { shiftLunarYear } from './runtime-helpers';

export type DecadalTimelineOption = {
  kind: 'childhood' | 'decadal';
  label: string;
  startAge: number;
  endAge: number;
  dateStr: string;
};

function collectRegularDecadalRanges(palaces: PalaceFact[]) {
  const uniqueRanges = new Map<string, { startAge: number; endAge: number }>();

  palaces.forEach((palace) => {
    const [startAge, endAge] = palace.decadal_range;
    uniqueRanges.set(`${startAge}-${endAge}`, { startAge, endAge });
  });

  return Array.from(uniqueRanges.values()).sort((left, right) => left.startAge - right.startAge);
}

export function getChildhoodAgeRange(palaces: PalaceFact[]): [number, number] | null {
  const firstRegularRange = collectRegularDecadalRanges(palaces)[0];

  if (!firstRegularRange || firstRegularRange.startAge <= 1) {
    return null;
  }

  return [1, firstRegularRange.startAge - 1];
}

export function buildDecadalTimelineOptions(
  palaces: PalaceFact[],
  birthSolarDate: string,
): DecadalTimelineOption[] {
  const regularRanges = collectRegularDecadalRanges(palaces);
  const childhoodRange = getChildhoodAgeRange(palaces);
  const childhoodOptions = childhoodRange
    ? [
        {
          kind: 'childhood' as const,
          label: '童限',
          startAge: childhoodRange[0],
          endAge: childhoodRange[1],
          dateStr: birthSolarDate,
        },
      ]
    : [];

  const decadalOptions = regularRanges.map((range) => ({
    kind: 'decadal' as const,
    label: '大限',
    startAge: range.startAge,
    endAge: range.endAge,
    // 虚岁按农历年递增，须按农历年位移；公历直移会让春节前出生者落入相邻流年干支
    dateStr: shiftLunarYear(birthSolarDate, range.startAge - 1),
  }));

  return [...childhoodOptions, ...decadalOptions];
}

export function findCurrentDecadalOption(
  options: DecadalTimelineOption[],
  nominalAge: number,
): DecadalTimelineOption | null {
  return (
    options.find((option) => nominalAge >= option.startAge && nominalAge <= option.endAge) ??
    options[0] ??
    null
  );
}

export function formatDecadalAgeRange(option: { startAge: number; endAge: number }) {
  return `${option.startAge}-${option.endAge}`;
}
