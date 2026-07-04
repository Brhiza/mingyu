import type { MeihuaCalculation, MeihuaExternalOmens } from '../../../../types/divination';
import { dizhi } from '../../../../divination/divination-data';
import {
  meihuaAnimalMap,
  meihuaColorMap,
  meihuaDirectionMap,
  meihuaObjectMap,
  meihuaOmenPriority,
  meihuaPersonMap,
  meihuaSoundMap,
} from '../../../../divination/meihua-omens';
import { MeihuaHelpers } from '../../../../divination/divination-helpers';
import { getDivinationTime } from '../../../../calendar/timeManager';

export type MappedExternalOmen = {
  source: (typeof meihuaOmenPriority)[number];
  label: string;
  trigramIndex: number;
  trigramName: string;
};

export interface MeihuaMethodResult {
  upperTrigramIndex: number;
  lowerTrigramIndex: number;
  movingYaoIndex: number;
  calculation: MeihuaCalculation;
}

type DivinationTime = ReturnType<typeof getDivinationTime>;
type DivinationGanzhi = DivinationTime['ganzhi'];
type DivinationLunar = DivinationTime['timeInfo']['lunar'];

export function resolveTimeMethod(
  ganzhi: DivinationGanzhi,
  lunar: DivinationLunar,
): MeihuaMethodResult {
  const yearZhi = ganzhi.year.substring(1, 2);
  const month = lunar.monthNumber;
  const day = lunar.dayNumber;
  const timeZhi = ganzhi.hour.substring(1, 2);
  const yearZhiIndex = dizhi.indexOf(yearZhi) + 1;
  const timeZhiIndex = dizhi.indexOf(timeZhi) + 1;
  const upperTrigramIndex = (yearZhiIndex + month + day) % 8 || 8;
  const lowerTrigramIndex = (yearZhiIndex + month + day + timeZhiIndex) % 8 || 8;
  const movingYaoIndex = (yearZhiIndex + month + day + timeZhiIndex) % 6 || 6;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '年月日时起卦法',
      methodKey: 'time',
      yearZhi,
      yearZhiIndex,
      month,
      day,
      timeZhi,
      timeZhiIndex,
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

export function resolveTimeTrigramMethod(
  ganzhi: DivinationGanzhi,
  lunar: DivinationLunar,
): MeihuaMethodResult {
  const result = resolveTimeMethod(ganzhi, lunar);
  return {
    ...result,
    calculation: {
      ...result.calculation,
      method: '年月日时起卦法（timeTrigram 兼容）',
      methodKey: 'timeTrigram',
      formula:
        '上卦=(年支序+月+日)%8；下卦=(年支序+月+日+时支序)%8；动爻=(年支序+月+日+时支序)%6。',
      compatibilityNote:
        'timeTrigram 为历史兼容入口，现按《梅花易数》年月日时起卦法计算，不再使用时辰地支方位自定义映射。',
    },
  };
}

export function resolveNumberMethod(number: number, timeBranch: string): MeihuaMethodResult {
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('数字起卦必须提供正整数');
  }
  const timeZhiIndex = dizhi.indexOf(timeBranch) + 1;
  if (timeZhiIndex <= 0) {
    throw new Error('数字起卦无法识别起卦时辰');
  }

  const upperTrigramIndex = number % 8 || 8;
  const totalWithTime = number + timeZhiIndex;
  const lowerTrigramIndex = totalWithTime % 8 || 8;
  const movingYaoIndex = totalWithTime % 6 || 6;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '数字起卦法',
      methodKey: 'number',
      number,
      timeZhi: timeBranch,
      timeZhiIndex,
      totalWithTime,
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

export function resolveRandomMethod(): MeihuaMethodResult {
  const upperTrigramIndex = Math.floor(Math.random() * 8) + 1;
  const lowerTrigramIndex = Math.floor(Math.random() * 8) + 1;
  const movingYaoIndex = Math.floor(Math.random() * 6) + 1;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '随机起卦法',
      methodKey: 'random',
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

function mapExternalOmens(externalOmens: MeihuaExternalOmens): MappedExternalOmen[] {
  const mapped: MappedExternalOmen[] = [];

  for (const source of meihuaOmenPriority) {
    const value = externalOmens[source];
    if (!value) {
      continue;
    }

    let mappedOmen:
      | {
          trigramIndex: number;
          trigramName: string;
        }
      | undefined;

    switch (source) {
      case 'direction':
        mappedOmen = meihuaDirectionMap[value as keyof typeof meihuaDirectionMap];
        break;
      case 'person':
        mappedOmen = meihuaPersonMap[value as keyof typeof meihuaPersonMap];
        break;
      case 'animal':
        mappedOmen = meihuaAnimalMap[value as keyof typeof meihuaAnimalMap];
        break;
      case 'object':
        mappedOmen = meihuaObjectMap[value as keyof typeof meihuaObjectMap];
        break;
      case 'sound':
        mappedOmen = meihuaSoundMap[value as keyof typeof meihuaSoundMap];
        break;
      case 'color':
        mappedOmen = meihuaColorMap[value as keyof typeof meihuaColorMap];
        break;
    }

    if (!mappedOmen) {
      continue;
    }
    mapped.push({
      source,
      label: value,
      trigramIndex: mappedOmen.trigramIndex,
      trigramName: mappedOmen.trigramName,
    });
  }

  return mapped;
}

export function resolveExternalMethod(
  externalOmens?: MeihuaExternalOmens,
  timeBranch?: string,
): MeihuaMethodResult {
  if (!externalOmens) {
    throw new Error('外应起卦必须提供外应信息');
  }

  const mappedOmens = mapExternalOmens(externalOmens);
  if (mappedOmens.length < 2) {
    throw new Error('外应起卦至少需要两项可映射的外应');
  }
  if (!Number.isInteger(externalOmens.count) || (externalOmens.count || 0) <= 0) {
    throw new Error('外应起卦必须提供数量');
  }

  const directionOmen = mappedOmens.find((omen) => omen.source === 'direction');
  const primaryOmen = mappedOmens.find((omen) => omen.source !== 'direction');
  const timeZhiIndex = timeBranch ? dizhi.indexOf(timeBranch) + 1 : 0;
  const useHouTianDuanFa = Boolean(directionOmen && primaryOmen && timeZhiIndex > 0);

  const upperOmen = useHouTianDuanFa ? primaryOmen! : mappedOmens[0];
  const lowerOmen = useHouTianDuanFa ? directionOmen! : mappedOmens[1];
  const upperTrigramIndex = upperOmen.trigramIndex;
  const lowerTrigramIndex = lowerOmen.trigramIndex;
  const totalWithTime = upperTrigramIndex + lowerTrigramIndex + timeZhiIndex;
  const movingYaoIndex = useHouTianDuanFa ? totalWithTime % 6 || 6 : externalOmens.count! % 6 || 6;
  const externalSummary = mappedOmens
    .map(
      (omen) =>
        `${MeihuaHelpers.getExternalOmenSourceLabel(omen.source)}：${omen.label}（${omen.trigramName}）`,
    )
    .concat(`数量：${externalOmens.count}`)
    .concat(useHouTianDuanFa ? `时辰：${timeBranch}（${timeZhiIndex}）` : [])
    .join('；');

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '外应起卦法',
      methodKey: 'external',
      externalOmens,
      externalSummary,
      externalRule: useHouTianDuanFa
        ? '后天端法：物象为上卦、方位为下卦，合物卦数、方位卦数与时数取动爻。'
        : '多外应顺序取卦：前两项外应分取上下卦，以数量取动爻。',
      externalUpperOmen: {
        source: upperOmen.source,
        label: upperOmen.label,
        trigram: upperOmen.trigramName,
        trigramIndex: upperOmen.trigramIndex,
      },
      externalLowerOmen: {
        source: lowerOmen.source,
        label: lowerOmen.label,
        trigram: lowerOmen.trigramName,
        trigramIndex: lowerOmen.trigramIndex,
      },
      externalMappedOmens: mappedOmens.map((omen) => ({
        source: omen.source,
        label: omen.label,
        trigram: omen.trigramName,
        trigramIndex: omen.trigramIndex,
      })),
      ...(useHouTianDuanFa
        ? {
            timeZhi: timeBranch,
            timeZhiIndex,
            totalWithTime,
          }
        : {}),
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}
