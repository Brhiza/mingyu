import type { PalaceFact } from '../../types/analysis';
import type { ChartInput } from '../../types/chart';
import type { IztroAstrolabe } from '../../types/iztro';
import { LunarDay, SolarDay } from 'tyme4ts';
import { buildHoroscopeFromInput, shiftLunarYear } from './runtime-helpers';

export type DecadalTimelineOption = {
  kind: 'childhood' | 'decadal';
  label: string;
  startAge: number;
  endAge: number;
  dateStr: string;
  endDateStr?: string;
  palaceIndex?: number;
  palaceName?: string;
  source: 'payload-compatibility' | 'iztro-horoscope';
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
    ? Array.from(
        { length: childhoodRange[1] - childhoodRange[0] + 1 },
        (_, index): DecadalTimelineOption => {
          const age = childhoodRange[0] + index;
          return {
            kind: 'childhood',
            label: '童限',
            startAge: age,
            endAge: age,
            dateStr: shiftLunarYear(birthSolarDate, age - 1),
            source: 'payload-compatibility',
          };
        },
      )
    : [];

  const decadalOptions = regularRanges.map((range) => ({
    kind: 'decadal' as const,
    label: '大限',
    startAge: range.startAge,
    endAge: range.endAge,
    // 虚岁按农历年递增，须按农历年位移；公历直移会让春节前出生者落入相邻流年干支
    dateStr: shiftLunarYear(birthSolarDate, range.startAge - 1),
    source: 'payload-compatibility' as const,
  }));

  return [...childhoodOptions, ...decadalOptions];
}

function formatSolarDay(day: ReturnType<typeof SolarDay.fromYmd>) {
  return `${day.getYear()}-${String(day.getMonth()).padStart(2, '0')}-${String(day.getDay()).padStart(2, '0')}`;
}

function shiftSolarDay(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return formatSolarDay(SolarDay.fromYmd(year, month, day).next(days));
}

function normalizeAstrolabeSolarDate(dateStr: string) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr);
  if (!match) {
    throw new Error('iztro 出生公历日期格式无效。');
  }
  return formatSolarDay(SolarDay.fromYmd(Number(match[1]), Number(match[2]), Number(match[3])));
}

async function findVerifiedHoroscope(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
  nominalAge: number,
) {
  const birthSolarDate = normalizeAstrolabeSolarDate(astrolabe.solarDate);
  const anniversary = shiftLunarYear(birthSolarDate, nominalAge - 1);
  const buildAtOffset = async (offset: number) => {
    const dateStr = shiftSolarDay(anniversary, offset);
    const horoscope = await buildHoroscopeFromInput(
      astrolabe,
      input,
      dateStr,
      input.birthTimeIndex,
    );
    return { dateStr, horoscope };
  };

  if ((input.ageDivide ?? 'normal') !== 'birthday') {
    if (nominalAge === 1) {
      const horoscope = await buildHoroscopeFromInput(
        astrolabe,
        input,
        birthSolarDate,
        input.birthTimeIndex,
      );
      if (horoscope.age.nominalAge !== nominalAge) {
        throw new Error('iztro 无法验证出生日期的虚岁。');
      }
      return { dateStr: birthSolarDate, horoscope };
    }
    const [year, month, day] = anniversary.split('-').map(Number);
    const anniversaryLunarYear = SolarDay.fromYmd(year, month, day).getLunarDay().getYear();
    const firstDay = LunarDay.fromYmd(anniversaryLunarYear, 1, 1).getSolarDay();
    const dateStr = formatSolarDay(firstDay);
    const horoscope = await buildHoroscopeFromInput(
      astrolabe,
      input,
      dateStr,
      input.birthTimeIndex,
    );
    if (horoscope.age.nominalAge !== nominalAge) {
      throw new Error(`iztro 无法验证虚岁 ${nominalAge} 的农历年分界。`);
    }
    return { dateStr, horoscope };
  }

  // iztro 2.5.8 的 birthday 分界在后续年份存在同月日比较缺陷，
  // 这里不猜边界，改为在一个农历月跨度内寻找其实际返回目标虚岁的首日。
  let low = 0;
  let high = 62;
  const highResult = await buildAtOffset(high);
  if (highResult.horoscope.age.nominalAge < nominalAge) {
    throw new Error(`iztro 无法在合理日期范围内定位虚岁 ${nominalAge}。`);
  }
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const result = await buildAtOffset(middle);
    if (result.horoscope.age.nominalAge >= nominalAge) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  const result = await buildAtOffset(low);
  if (result.horoscope.age.nominalAge !== nominalAge) {
    throw new Error(`iztro 无法验证虚岁 ${nominalAge} 的代表日期。`);
  }
  return result;
}

function collectIztroDecadalRanges(astrolabe: IztroAstrolabe) {
  const ranges = astrolabe.palaces.map((palace) => {
    const [startAge, endAge] = palace.decadal.range;
    if (
      !Number.isInteger(startAge) ||
      !Number.isInteger(endAge) ||
      startAge < 1 ||
      endAge < startAge
    ) {
      throw new Error(`iztro ${palace.name}大限年龄范围无效。`);
    }
    return { startAge, endAge, palaceIndex: palace.index, palaceName: palace.name };
  });
  const uniqueKeys = new Set(ranges.map((range) => `${range.startAge}-${range.endAge}`));
  if (ranges.length !== 12 || uniqueKeys.size !== 12) {
    throw new Error('iztro 必须返回十二个互不重复的大限年龄范围。');
  }
  return ranges.sort((left, right) => left.startAge - right.startAge);
}

export async function buildVerifiedDecadalTimelineOptions(
  astrolabe: IztroAstrolabe,
  input: ChartInput,
): Promise<DecadalTimelineOption[]> {
  const ranges = collectIztroDecadalRanges(astrolabe);
  const firstRange = ranges[0];
  if (!firstRange) {
    throw new Error('iztro 未返回可用的大限范围。');
  }

  const options: DecadalTimelineOption[] = [];
  for (let age = 1; age < firstRange.startAge; age += 1) {
    const { dateStr, horoscope } = await findVerifiedHoroscope(astrolabe, input, age);
    const palace = astrolabe.palace(horoscope.decadal.index);
    if (horoscope.age.nominalAge !== age || horoscope.decadal.name !== '童限' || !palace) {
      throw new Error(`iztro 无法验证虚岁 ${age} 的童限宫位。`);
    }
    options.push({
      kind: 'childhood',
      label: '童限',
      startAge: age,
      endAge: age,
      dateStr,
      palaceIndex: palace.index,
      palaceName: palace.name,
      source: 'iztro-horoscope',
    });
  }

  for (const range of ranges) {
    const { dateStr, horoscope } = await findVerifiedHoroscope(astrolabe, input, range.startAge);
    if (
      horoscope.age.nominalAge !== range.startAge ||
      horoscope.decadal.name !== '大限' ||
      horoscope.decadal.index !== range.palaceIndex
    ) {
      throw new Error(
        `iztro 无法验证 ${range.startAge}-${range.endAge} 岁大限与${range.palaceName}的对应关系。`,
      );
    }
    options.push({
      kind: 'decadal',
      label: '大限',
      startAge: range.startAge,
      endAge: range.endAge,
      dateStr,
      palaceIndex: range.palaceIndex,
      palaceName: range.palaceName,
      source: 'iztro-horoscope',
    });
  }

  const nextAge = options.at(-1)?.endAge;
  if (!nextAge) {
    throw new Error('iztro 未生成可用的童限或大限时间线。');
  }
  const finalBoundary = await findVerifiedHoroscope(astrolabe, input, nextAge + 1);
  return options.map((option, index) => ({
    ...option,
    endDateStr: shiftSolarDay(options[index + 1]?.dateStr ?? finalBoundary.dateStr, -1),
  }));
}

export function findCurrentDecadalOption(
  options: DecadalTimelineOption[],
  nominalAge: number,
): DecadalTimelineOption | null {
  if (!Number.isInteger(nominalAge) || nominalAge < 1) return null;
  return (
    options.find((option) => nominalAge >= option.startAge && nominalAge <= option.endAge) ?? null
  );
}

export function formatDecadalAgeRange(option: { startAge: number; endAge: number }) {
  return option.startAge === option.endAge
    ? String(option.startAge)
    : `${option.startAge}-${option.endAge}`;
}
