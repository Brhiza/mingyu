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
  getSitFacingFromFacingDegree,
  type BaZhaiPalace,
  type SitFacingPosition,
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

/** 从大门处面向屋内测量的八宅便捷入参。 */
export interface BaZhaiDoorDegreeInput extends Omit<BaZhaiInput, 'sitMountain'> {
  /** 站在大门处面向屋内时的指南针读数，正北为 0°，顺时针增加。 */
  doorToInteriorDegree: number;
}

/** 入户测量读数换算成传统坐山朝向后的完整资料。 */
export interface BaZhaiDoorMeasurement {
  method: '站在大门处面向屋内测量';
  measuredDegree: number;
  facingDegree: number;
  facingMountain: string;
  sitDegree: number;
  sitMountain: string;
  label: string;
  promptText: string;
}

export interface BaZhaiDoorDegreeResult extends BaZhaiResult {
  directionMeasurement: BaZhaiDoorMeasurement;
}

/**
 * 将“从大门面向屋内”的指南针读数换算为八宅传统坐山朝向。
 * 例如读数 0° 表示从大门向屋内看正北，对应子山午向。
 */
export function getBaZhaiSitFacingFromDoorDegree(doorToInteriorDegree: number): SitFacingPosition {
  if (
    typeof doorToInteriorDegree !== 'number' ||
    !Number.isFinite(doorToInteriorDegree) ||
    doorToInteriorDegree < 0 ||
    doorToInteriorDegree > 360
  ) {
    throw new Error('大门朝向屋内的度数必须是 0-360 之间的有限数字。');
  }
  return getSitFacingFromFacingDegree((doorToInteriorDegree + 180) % 360);
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

/**
 * 直接使用“从大门面向屋内”的指南针读数生成完整八宅结果。
 * 调用方无需自行换算相反方向或二十四山。
 */
export function analyzeBaZhaiByDoorDegree(input: BaZhaiDoorDegreeInput): BaZhaiDoorDegreeResult {
  const { doorToInteriorDegree, ...birthInput } = input;
  const { facing, sit, label } = getBaZhaiSitFacingFromDoorDegree(doorToInteriorDegree);
  if (facing.isBoundary) {
    const boundary = facing.boundaryMountains?.join('向与') ?? '两个二十四山';
    throw new Error(`当前度数正好位于${boundary}向的分界线，请重新测量。`);
  }
  const result = analyzeBaZhai({ ...birthInput, sitMountain: sit.mountain });
  return {
    ...result,
    directionMeasurement: {
      method: '站在大门处面向屋内测量',
      measuredDegree: doorToInteriorDegree,
      facingDegree: facing.degree,
      facingMountain: facing.mountain,
      sitDegree: sit.degree,
      sitMountain: sit.mountain,
      label,
      promptText: `测量方式：站在大门处面向屋内，指南针读数为 ${doorToInteriorDegree}°。换算后住宅坐山 ${sit.degree}° 为${sit.mountain}山，传统朝向 ${facing.degree}° 为${facing.mountain}向，结果为${label}。`,
    },
  };
}

export const bazhai = {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
};
