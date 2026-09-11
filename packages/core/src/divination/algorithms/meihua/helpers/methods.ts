import type {
  MeihuaCalculation,
  MeihuaDirection,
  MeihuaObjectType,
  MeihuaSettings,
} from '../../../../types/divination';
import { dizhi } from '../../../../divination/divination-data';
import { getDivinationTime } from '../../../../calendar/timeManager';
import type { RandomOptions, RandomTrace } from '../../../../shared/random';
import { createRandomContext, randomInt } from '../../../../shared/random';

export interface MeihuaMethodResult {
  upperTrigramIndex: number;
  lowerTrigramIndex: number;
  movingYaoIndex: number;
  calculation: MeihuaCalculation;
  randomTrace?: RandomTrace;
}

type DivinationTime = ReturnType<typeof getDivinationTime>;
type DivinationGanzhi = DivinationTime['ganzhi'];
type DivinationLunar = DivinationTime['timeInfo']['lunar'];

function getLunarYearBranch(lunar: DivinationLunar) {
  const lunarYearText = lunar.yearInChinese.replace(/^农历/, '');
  const yearBranch = lunarYearText.charAt(1);
  if (!dizhi.includes(yearBranch)) {
    throw new Error(`梅花易数无法识别农历年支 "${lunar.yearInChinese}"。`);
  }
  return yearBranch;
}

function assertIntegerRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}必须是 ${min}-${max} 之间的整数。`);
  }
}

function getHourBranch(ganzhi: DivinationGanzhi): string {
  const timeZhi = ganzhi.hour.substring(1, 2);
  if (!dizhi.includes(timeZhi)) {
    throw new Error(`梅花易数无法识别时支 "${ganzhi.hour}"。`);
  }
  return timeZhi;
}

const DIRECTION_TRIGRAM_INDEX: Record<MeihuaDirection, number> = {
  northwest: 1,
  west: 2,
  south: 3,
  east: 4,
  southeast: 5,
  north: 6,
  northeast: 7,
  southwest: 8,
};

const OBJECT_TRIGRAM_INDEX: Record<MeihuaObjectType, number> = {
  heaven: 1,
  lake: 2,
  fire: 3,
  thunder: 4,
  wind: 5,
  water: 6,
  mountain: 7,
  earth: 8,
};

function positiveSafeInteger(value: number | undefined, label: string): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
    throw new Error(`${label}必须提供安全范围内的正整数`);
  }
  return value as number;
}

export function resolveTimeMethod(
  ganzhi: DivinationGanzhi,
  lunar: DivinationLunar,
): MeihuaMethodResult {
  const yearZhi = getLunarYearBranch(lunar);
  const month = lunar.monthNumber;
  const day = lunar.dayNumber;
  assertIntegerRange(month, '农历月份', 1, 12);
  assertIntegerRange(day, '农历日期', 1, 30);
  const timeZhi = getHourBranch(ganzhi);
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
  positiveSafeInteger(number, '数字起卦');
  const timeZhiIndex = dizhi.indexOf(timeBranch) + 1;
  if (timeZhiIndex <= 0) {
    throw new Error('数字起卦无法识别起卦时辰');
  }

  const upperTrigramIndex = number % 8 || 8;
  const totalWithTime = number + timeZhiIndex;
  if (!Number.isSafeInteger(totalWithTime)) {
    throw new Error('数字与时辰序数之和必须在安全整数范围内');
  }
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

export function resolveSoundMethod(soundCount: number, timeBranch: string): MeihuaMethodResult {
  positiveSafeInteger(soundCount, '声音数');
  const timeZhiIndex = dizhi.indexOf(timeBranch) + 1;
  if (timeZhiIndex <= 0) {
    throw new Error('声音起卦无法识别起卦时辰');
  }

  const upperTrigramIndex = soundCount % 8 || 8;
  const totalWithTime = soundCount + timeZhiIndex;
  if (!Number.isSafeInteger(totalWithTime)) {
    throw new Error('声音数与时辰序数之和必须在安全整数范围内');
  }
  const lowerTrigramIndex = totalWithTime % 8 || 8;
  const movingYaoIndex = totalWithTime % 6 || 6;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '声音起卦法',
      methodKey: 'sound',
      soundCount,
      timeZhi: timeBranch,
      timeZhiIndex,
      totalWithTime,
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

function sum(values: number[], label: string): number {
  return values.reduce((total, value) => {
    const next = total + value;
    if (!Number.isSafeInteger(next)) {
      throw new Error(`${label}超出安全整数范围`);
    }
    return next;
  }, 0);
}

export function resolveCharacterMethod(settings: MeihuaSettings): MeihuaMethodResult {
  const rawText = settings.characterText;
  const characterText = rawText === undefined ? undefined : rawText.trim();
  const textCharacters = characterText === undefined ? undefined : Array.from(characterText);
  if (textCharacters && textCharacters.length === 0) {
    throw new Error('字数起卦的文字不能为空');
  }

  const characterCount = positiveSafeInteger(
    settings.characterCount ?? textCharacters?.length ?? settings.characterStrokeCounts?.length,
    '字数起卦的字符数',
  );
  if (characterCount > 100) {
    throw new Error('字数起卦的字符数必须不超过100');
  }
  if (textCharacters && textCharacters.length !== characterCount) {
    throw new Error('字数起卦的 characterCount 必须与 characterText 的字符数一致');
  }

  const tones = settings.characterTones;
  if (tones !== undefined) {
    if (tones.length !== characterCount) {
      throw new Error('字数起卦的声调数必须与字符数一致');
    }
    if (characterCount < 4 || characterCount > 10) {
      throw new Error('字数起卦仅支持4-10字输入传统平上去入声数');
    }
    tones.forEach((tone, index) =>
      assertIntegerRange(tone, `第${index + 1}字传统平上去入声数`, 1, 4),
    );
  }

  const strokeCounts = settings.characterStrokeCounts;
  if (strokeCounts !== undefined) {
    if (strokeCounts.length !== characterCount) {
      throw new Error('字数起卦的逐字笔画数必须与字符数一致');
    }
    if (characterCount < 2 || characterCount > 3) {
      throw new Error('字数起卦仅支持2-3字输入逐字笔画数');
    }
    strokeCounts.forEach((strokes, index) =>
      positiveSafeInteger(strokes, `第${index + 1}字笔画数`),
    );
  }

  let upperNumber: number;
  let lowerNumber: number;
  let characterRule: string;
  if (characterCount === 1) {
    if (tones !== undefined) {
      throw new Error('单字起卦应提供左右分笔数，不使用传统平上去入声数');
    }
    if (strokeCounts !== undefined) {
      throw new Error('单字起卦应提供左右分笔数，不使用逐字笔画数');
    }
    const leftStrokes = positiveSafeInteger(settings.characterLeftStrokes, '单字左侧笔画数');
    const rightStrokes = positiveSafeInteger(settings.characterRightStrokes, '单字右侧笔画数');
    upperNumber = leftStrokes;
    lowerNumber = rightStrokes;
    characterRule = '单字按左右分笔取上下卦';
  } else if (characterCount <= 3) {
    const upperCount = Math.floor(characterCount / 2);
    if (tones !== undefined) {
      throw new Error('2-3字起卦按逐字笔画数取数，不使用传统平上去入声数');
    }
    if (strokeCounts === undefined) {
      throw new Error('2-3字起卦必须提供 characterStrokeCounts 逐字笔画数');
    }
    upperNumber = sum(strokeCounts.slice(0, upperCount), '字数起卦的上卦取数');
    lowerNumber = sum(strokeCounts.slice(upperCount), '字数起卦的下卦取数');
    characterRule = '2-3字按各字笔画数分半取上下卦';
  } else if (characterCount <= 10) {
    if (strokeCounts !== undefined) {
      throw new Error('4-10字起卦按传统平上去入声数取数，不使用逐字笔画数');
    }
    if (tones === undefined) {
      throw new Error('4-10字起卦必须提供 characterTones 传统平上去入声数');
    }
    const upperCount = Math.floor(characterCount / 2);
    upperNumber = sum(tones.slice(0, upperCount), '字数起卦的上卦取数');
    lowerNumber = sum(tones.slice(upperCount), '字数起卦的下卦取数');
    characterRule =
      '4-10字按传统平、上、去、入声类分别取1、2、3、4数，再分半取上下卦（不等同于普通话一至四声）';
  } else {
    if (tones !== undefined || strokeCounts !== undefined) {
      throw new Error('11-100字起卦只按字数分半取数，不使用声数或逐字笔画数');
    }
    const upperCount = Math.floor(characterCount / 2);
    const lowerCount = characterCount - upperCount;
    upperNumber = upperCount;
    lowerNumber = lowerCount;
    characterRule = '11-100字按字数分半取上下卦';
  }

  const upperTrigramIndex = upperNumber % 8 || 8;
  const lowerTrigramIndex = lowerNumber % 8 || 8;
  const totalNumber = sum([upperNumber, lowerNumber], '字数起卦的总取数');
  const movingYaoIndex = totalNumber % 6 || 6;
  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '字数起卦法',
      methodKey: 'character',
      ...(characterText ? { characterText } : {}),
      characterCount,
      ...(tones ? { characterTones: [...tones] } : {}),
      ...(strokeCounts ? { characterStrokeCounts: [...strokeCounts] } : {}),
      ...(characterCount === 1
        ? {
            characterLeftStrokes: upperNumber,
            characterRightStrokes: lowerNumber,
          }
        : {}),
      characterUpperNumber: upperNumber,
      characterLowerNumber: lowerNumber,
      characterRule,
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

export function resolveDirectionMethod(
  direction: MeihuaDirection,
  objectType: MeihuaObjectType,
  timeBranch: string,
): MeihuaMethodResult {
  const directionTrigramIndex = DIRECTION_TRIGRAM_INDEX[direction];
  const objectTrigramIndex = OBJECT_TRIGRAM_INDEX[objectType];
  if (!directionTrigramIndex || !objectTrigramIndex) {
    throw new Error('方位起卦必须提供有效的后天八卦方位和所见物类');
  }
  const timeZhiIndex = dizhi.indexOf(timeBranch) + 1;
  if (timeZhiIndex <= 0) {
    throw new Error('方位起卦无法识别起卦时辰');
  }
  const totalWithTime = objectTrigramIndex + directionTrigramIndex + timeZhiIndex;
  const movingYaoIndex = totalWithTime % 6 || 6;
  return {
    upperTrigramIndex: objectTrigramIndex,
    lowerTrigramIndex: directionTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '方位取象起卦法',
      methodKey: 'direction',
      direction,
      objectType,
      objectTrigramIndex,
      directionTrigramIndex,
      timeZhi: timeBranch,
      timeZhiIndex,
      totalWithTime,
      upperTrigramIndex: objectTrigramIndex,
      lowerTrigramIndex: directionTrigramIndex,
      movingYaoIndex,
    },
  };
}

export function resolveRandomMethod(options?: RandomOptions): MeihuaMethodResult {
  const context = createRandomContext(options);
  const rng = context.random;
  const upperTrigramIndex = randomInt(8, rng) + 1;
  const lowerTrigramIndex = randomInt(8, rng) + 1;
  const movingYaoIndex = randomInt(6, rng) + 1;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    randomTrace: context.getTrace(),
    calculation: {
      method: '随机起卦法',
      methodKey: 'random',
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}
