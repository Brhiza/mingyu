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

export function resolveTimeMethod(
  ganzhi: ReturnType<typeof getDivinationTime>['ganzhi'],
  lunar: ReturnType<typeof getDivinationTime>['timeInfo']['lunar'],
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

/**
 * 时辰纳卦法（依时辰地支方位配先天八卦起卦）
 *
 * 以时辰地支对应的自然方位（子北、卯东、午南、酉西），
 * 按先天八卦方位图（乾南、坤北、离东、坎西等）将方位映射为卦象，
 * 再以时辰地支序数取动爻。
 *
 * 注意：本方法与传统《梅花易数》"端法后天占验"不同。
 * 端法后天强调以外应方向定卦，需真实观测到的外应（人物、方位、声音等），
 * 按后天八卦方位（离南、坎北、震东、兑西）起卦。
 * 此处仅以时辰地支推算方向，属简化启发法，并非邵雍原著之端法后天。
 *
 * 八卦索引：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
 */
export function resolveTimeTrigramMethod(timeBranch: string): MeihuaMethodResult {
  // 先天方位八卦映射（以观测者为中心，依先天八卦方位）：
  // 南=乾(1)、东南=兑(2)、东=离(3)、东北=震(4)、
  // 西南=巽(5)、西=坎(6)、西北=艮(7)、北=坤(8)

  // 地支与先天八卦方位映射
  const BRANCH_TO_TRIGRAM: Record<string, { upper: number; lower: number }> = {
    子: { upper: 8, lower: 3 }, // 子(北)→坤(上)离(下)
    丑: { upper: 7, lower: 4 }, // 丑(东北)→艮(上)震(下)
    寅: { upper: 4, lower: 7 }, // 寅(东北)→震(上)艮(下)
    卯: { upper: 3, lower: 8 }, // 卯(东)→离(上)坤(下)
    辰: { upper: 5, lower: 2 }, // 辰(东南)→巽(上)兑(下)
    巳: { upper: 2, lower: 5 }, // 巳(东南)→兑(上)巽(下)
    午: { upper: 1, lower: 6 }, // 午(南)→乾(上)坎(下)
    未: { upper: 6, lower: 1 }, // 未(西南)→坎(上)乾(下)
    申: { upper: 6, lower: 1 }, // 申(西南)→坎(上)乾(下)
    酉: { upper: 6, lower: 8 }, // 酉(西)→坎(上)坤(下)
    戌: { upper: 7, lower: 7 }, // 戌(西北)→艮(上)艮(下)
    亥: { upper: 8, lower: 6 }, // 亥(西北偏北)→坤(上)坎(下)
  };

  const mapping = BRANCH_TO_TRIGRAM[timeBranch];
  if (!mapping) {
    const timeIndex = dizhi.indexOf(timeBranch) + 1;
    return {
      upperTrigramIndex: timeIndex % 8 || 8,
      lowerTrigramIndex: (timeIndex * 3) % 8 || 8,
      movingYaoIndex: timeIndex % 6 || 6,
      calculation: {
        method: '时辰纳卦法',
        methodKey: 'timeTrigram',
        timeBranch,
        upperTrigramIndex: timeIndex % 8 || 8,
        lowerTrigramIndex: (timeIndex * 3) % 8 || 8,
        movingYaoIndex: timeIndex % 6 || 6,
      },
    };
  }

  const movingYaoIndex = (dizhi.indexOf(timeBranch) + 1) % 6 || 6;

  return {
    upperTrigramIndex: mapping.upper,
    lowerTrigramIndex: mapping.lower,
    movingYaoIndex,
    calculation: {
      method: '时辰纳卦法',
      methodKey: 'timeTrigram',
      timeBranch,
      upperTrigramIndex: mapping.upper,
      lowerTrigramIndex: mapping.lower,
      movingYaoIndex,
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
  const movingYaoIndex = useHouTianDuanFa
    ? totalWithTime % 6 || 6
    : externalOmens.count! % 6 || 6;
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
