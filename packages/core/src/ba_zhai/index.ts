/**
 * @file 八宅风水（BaZhai）
 * @description 以命卦（东四/西四命）与宅卦配合，排八宅大游年四吉四凶方。
 * 复用 bazi.calculateMingGua 与 direction 模块，返回结构化结果与提示词。
 * @古籍依据 《八宅明镜》《阳宅十书》
 */
import { calculateMingGua } from '../bazi/mingGua';
import { daysInGregorianMonth } from '../calendar/date-validation';
import { getGanZhiFromDate } from '../ganzhi';
import {
  getHouseTrigram,
  getEightMansion,
  getEastWestGroup,
  getBaZhaiPalace,
  type BaZhaiPalace,
} from '../direction';

export interface BaZhaiInput {
  /** 出生公历年份（用于推命卦；已按立春换年处理） */
  birthYear?: number;
  /** 出生公历月日，用于准确处理立春换年。 */
  birthMonth?: number;
  birthDay?: number;
  /** 性别 */
  gender?: 'male' | 'female';
  /** 也可直接给定命卦（坎坤震巽乾兑艮离） */
  mingGua?: string;
  /** 坐山（二十四山，如「子」），用于推宅卦 */
  sitMountain?: string;
}

export interface BaZhaiResult {
  mingGua: string;
  effectiveBirthYear: number | null;
  birthYearBoundaryNote: string;
  mingGroup: '东四命' | '西四命';
  houseGua: string | null;
  houseGroup: '东四命' | '西四命' | null;
  /** 命卦大游年盘 */
  mingPalace: BaZhaiPalace[];
  /** 宅卦大游年盘（若有坐山） */
  housePalace: BaZhaiPalace[] | null;
  /** 命宅配合 */
  match: '相合' | '相冲' | '未知';
  matchAdvice: string;
  luckyDirections: BaZhaiPalace[];
  unluckyDirections: BaZhaiPalace[];
  prompt: string;
}

function resolveEffectiveBirthYear(input: BaZhaiInput): {
  year: number;
  note: string;
} {
  if (!Number.isSafeInteger(input.birthYear) || input.birthYear! < 1 || input.birthYear! > 9999) {
    throw new Error('出生年份必须是 1-9999 之间的整数。');
  }
  const year = input.birthYear!;
  const hasMonth = input.birthMonth !== undefined;
  const hasDay = input.birthDay !== undefined;
  if (hasMonth !== hasDay) throw new Error('八宅立春换年需同时提供出生月和出生日。');
  if (!hasMonth || !hasDay) {
    return {
      year,
      note: '只提供了出生年份；若出生在当年立春前，命卦应按上一年复核。',
    };
  }
  const month = input.birthMonth!;
  const day = input.birthDay!;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('出生月份需在 1-12 之间。');
  }
  const maxDay = daysInGregorianMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    throw new Error(`出生日期需在 1-${maxDay} 之间。`);
  }
  const birthGanZhiYear = getGanZhiFromDate(new Date(year, month - 1, day, 12, 0, 0)).year;
  const currentGanZhiYear = getGanZhiFromDate(new Date(year, 6, 1, 12, 0, 0)).year;
  const effectiveYear = birthGanZhiYear === currentGanZhiYear ? year : year - 1;
  return {
    year: effectiveYear,
    note:
      effectiveYear === year
        ? `出生日期已过 ${year} 年立春，命卦按 ${year} 年计算。`
        : `出生日期在 ${year} 年立春前，命卦按 ${effectiveYear} 年计算。`,
  };
}

function resolveMingGua(input: BaZhaiInput): {
  gua: string;
  effectiveBirthYear: number | null;
  note: string;
} {
  if (input.mingGua) {
    return { gua: input.mingGua, effectiveBirthYear: null, note: '本次直接使用已给定的命卦。' };
  }
  if (input.birthYear != null && input.gender) {
    const resolved = resolveEffectiveBirthYear(input);
    return {
      gua: calculateMingGua(resolved.year, input.gender).gua,
      effectiveBirthYear: resolved.year,
      note: resolved.note,
    };
  }
  throw new Error('需提供 birthYear+gender 或直接给定 mingGua。');
}

function buildPrompt(r: Omit<BaZhaiResult, 'prompt'>): string {
  const lines: string[] = [];
  lines.push('【八宅风水排盘】');
  lines.push(`命卦：${r.mingGua}（${r.mingGroup}）`);
  lines.push(`立春年界：${r.birthYearBoundaryNote}`);
  if (r.houseGua) {
    lines.push(`宅卦：${r.houseGua}（${r.houseGroup}）`);
    lines.push(`命宅配合：${r.match}。${r.matchAdvice}`);
  } else {
    lines.push('解读范围：本次只按命卦八宫判断个人方位取舍。');
  }
  lines.push(`四吉方：${r.luckyDirections.map((p) => `${p.direction}(${p.label})`).join('、')}`);
  lines.push(`四凶方：${r.unluckyDirections.map((p) => `${p.direction}(${p.label})`).join('、')}`);
  lines.push('命卦八宫明细：');
  lines.push(
    ...r.mingPalace.map(
      (palace) =>
        `- ${palace.gua}宫：${palace.direction} ${palace.degree}°，${palace.label}（${palace.luck}）`,
    ),
  );
  if (r.housePalace) {
    lines.push('宅卦八宫明细：');
    lines.push(
      ...r.housePalace.map(
        (palace) =>
          `- ${palace.gua}宫：${palace.direction} ${palace.degree}°，${palace.label}（${palace.luck}）`,
      ),
    );
  }
  lines.push(
    '取证层级：命卦八宫用于个人方位取舍，宅卦八宫用于住宅理气；两者重合可作主证，不重合时必须说明采用命卦或宅卦的理由。',
  );
  lines.push(
    '证据边界：只按命卦、宅卦与八宅大游年方位判断理气取舍；现场安全、实际动线与居住需求优先于单一方位吉凶。',
  );
  lines.push('');
  lines.push(
    '请结合命卦、宅卦和八宫明细，分析住宅大门、卧室、厨房、书房宜取的吉方及应回避的凶方；结论须区分主证、辅证和适用边界，只围绕上方明确列出的方位事实作答。',
  );
  return lines.join('\n');
}

/** 八宅风水分析 */
export function analyzeBaZhai(input: BaZhaiInput): BaZhaiResult {
  const resolvedMingGua = resolveMingGua(input);
  const mingGua = resolvedMingGua.gua;
  const mingGroup = getEastWestGroup(mingGua);
  const mingMansion = getEightMansion(mingGua);
  const mingPalace = mingMansion.lucky
    .concat(mingMansion.unlucky)
    .sort((a, b) => a.degree - b.degree);

  let houseGua: string | null = null;
  let houseGroup: '东四命' | '西四命' | null = null;
  let housePalace: BaZhaiPalace[] | null = null;
  let match: BaZhaiResult['match'] = '未知';
  let matchAdvice = '';

  if (input.sitMountain) {
    houseGua = getHouseTrigram(input.sitMountain);
    houseGroup = getEastWestGroup(houseGua);
    housePalace = getBaZhaiPalace(houseGua);
    if (houseGroup === mingGroup) {
      match = '相合';
      matchAdvice = `命卦与宅卦同属${mingGroup}，东四命配东四宅/西四命配西四宅为"命宅相合"，吉方可尽量重合利用。`;
    } else {
      match = '相冲';
      matchAdvice = `命卦属${mingGroup}、宅卦属${houseGroup}，命宅不同组（东四命住西四宅或反之），应以命卦吉方为主、宅卦为辅调和。`;
    }
  }

  const result: Omit<BaZhaiResult, 'prompt'> = {
    mingGua,
    effectiveBirthYear: resolvedMingGua.effectiveBirthYear,
    birthYearBoundaryNote: resolvedMingGua.note,
    mingGroup,
    houseGua,
    houseGroup,
    mingPalace,
    housePalace,
    match,
    matchAdvice,
    luckyDirections: mingMansion.lucky,
    unluckyDirections: mingMansion.unlucky,
  };

  return { ...result, prompt: buildPrompt(result) };
}

export const bazhai = { analyzeBaZhai };
