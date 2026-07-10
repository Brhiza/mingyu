/**
 * @file 八宅风水（BaZhai）
 * @description 以命卦（东四/西四命）与宅卦配合，排八宅大游年四吉四凶方。
 * 复用 bazi.calculateMingGua 与 direction 模块，返回结构化结果与提示词。
 * @古籍依据 《八宅明镜》《阳宅十书》
 */
import { calculateMingGua } from '../bazi/mingGua';
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
  /** 性别 */
  gender?: 'male' | 'female';
  /** 也可直接给定命卦（坎坤震巽乾兑艮离） */
  mingGua?: string;
  /** 坐山（二十四山，如「子」），用于推宅卦 */
  sitMountain?: string;
}

export interface BaZhaiResult {
  mingGua: string;
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

function resolveMingGua(input: BaZhaiInput): string {
  if (input.mingGua) return input.mingGua;
  if (input.birthYear != null && input.gender) {
    return calculateMingGua(input.birthYear, input.gender).gua;
  }
  throw new Error('需提供 birthYear+gender 或直接给定 mingGua。');
}

function buildPrompt(r: Omit<BaZhaiResult, 'prompt'>): string {
  const lines: string[] = [];
  lines.push('【八宅风水排盘】');
  lines.push(`命卦：${r.mingGua}（${r.mingGroup}）`);
  if (r.houseGua) {
    lines.push(`宅卦：${r.houseGua}（${r.houseGroup}）`);
    lines.push(`命宅配合：${r.match}。${r.matchAdvice}`);
  } else {
    lines.push('宅卦：未提供坐山，仅按命卦论吉凶方位。');
  }
  lines.push(`四吉方：${r.luckyDirections.map((p) => `${p.direction}(${p.label})`).join('、')}`);
  lines.push(`四凶方：${r.unluckyDirections.map((p) => `${p.direction}(${p.label})`).join('、')}`);
  lines.push('');
  lines.push(
    '请结合命卦与宅卦，分析住宅大门、卧室、厨房、书房宜取的吉方，以及应回避的凶方，并说明理气与形峦配合的要点。',
  );
  return lines.join('\n');
}

/** 八宅风水分析 */
export function analyzeBaZhai(input: BaZhaiInput): BaZhaiResult {
  const mingGua = resolveMingGua(input);
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
