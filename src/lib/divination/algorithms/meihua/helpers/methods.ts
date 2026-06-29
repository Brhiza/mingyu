import type { MeihuaCalculation, MeihuaExternalOmens } from '../../../../../types/divination';
import { dizhi } from '../../../../../config/divination-data';
import {
  meihuaAnimalMap,
  meihuaColorMap,
  meihuaDirectionMap,
  meihuaObjectMap,
  meihuaOmenPriority,
  meihuaPersonMap,
  meihuaSoundMap,
} from '../../../../../config/meihua-omens';
import { MeihuaHelpers } from '../../../../../utils/divination-helpers';
import { getDivinationTime } from '../../../../../utils/timeManager';

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
 * 端法后天起卦法（《梅花易数》端法后天占验）：
 * 按邵雍《梅花易数》端法后天占验篇，以外应方向为卜卦依据，
 * 以方取象：乾南、坤北、离东、坎西、震东北、兑东南、巽西南、艮西北。
 * 用八卦方位取代先天数，直接将外界感知转化为卦象。
 *
 * 此方法与外应起卦法不同：外应法将外应映射为先天八卦数，
 * 端法后天起卦直接以方位定卦，并以时辰地支序数定动爻。
 *
 * 返回八卦索引：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
 */
export function resolveLaterHeavenMethod(timeBranch: string): MeihuaMethodResult {
  // 后天方位八卦映射（以观测者为中心）：
  // 南=乾(1)、东南=兑(2)、东=离(3)、东北=震(4)、
  // 西南=巽(5)、西=坎(6)、西北=艮(7)、北=坤(8)
  // 此处是定例：若用户从东方来→离(3)，南方来→乾(1)
  // 使用时辰对应的地支方位来定上下卦

  // 地支与后天八卦方位映射（邵雍定例）
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
    // fallback: 使用时辰序数
    const timeIndex = dizhi.indexOf(timeBranch) + 1;
    return {
      upperTrigramIndex: ((timeIndex % 8) || 8),
      lowerTrigramIndex: (((timeIndex * 3) % 8) || 8),
      movingYaoIndex: (timeIndex % 6) || 6,
      calculation: {
        method: '端法后天起卦法',
        methodKey: 'laterHeaven',
        timeBranch,
        upperTrigramIndex: ((timeIndex % 8) || 8),
        lowerTrigramIndex: (((timeIndex * 3) % 8) || 8),
        movingYaoIndex: (timeIndex % 6) || 6,
      },
    };
  }

  const movingYaoIndex = (dizhi.indexOf(timeBranch) + 1) % 6 || 6;

  return {
    upperTrigramIndex: mapping.upper,
    lowerTrigramIndex: mapping.lower,
    movingYaoIndex,
    calculation: {
      method: '端法后天起卦法',
      methodKey: 'laterHeaven',
      timeBranch,
      upperTrigramIndex: mapping.upper,
      lowerTrigramIndex: mapping.lower,
      movingYaoIndex,
    },
  };
}

export function resolveNumberMethod(number: number): MeihuaMethodResult {
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('数字起卦必须提供正整数');
  }

  const upperTrigramIndex = number % 8 || 8;
  const lowerTrigramIndex = Math.floor(number / 8) % 8 || 8;
  const movingYaoIndex = number % 6 || 6;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '数字起卦法',
      methodKey: 'number',
      number,
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

export function resolveExternalMethod(externalOmens?: MeihuaExternalOmens): MeihuaMethodResult {
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

  const upperTrigramIndex = mappedOmens[0].trigramIndex;
  const lowerTrigramIndex = mappedOmens[1].trigramIndex;
  const movingYaoIndex = externalOmens.count! % 6 || 6;
  const externalSummary = mappedOmens
    .map(
      (omen) =>
        `${MeihuaHelpers.getExternalOmenSourceLabel(omen.source)}：${omen.label}（${omen.trigramName}）`,
    )
    .concat(`数量：${externalOmens.count}`)
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
      externalMappedOmens: mappedOmens.map((omen) => ({
        source: omen.source,
        label: omen.label,
        trigram: omen.trigramName,
        trigramIndex: omen.trigramIndex,
      })),
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}
