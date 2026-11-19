/**
 * @file 通用简繁与异体字工具
 * @description 结合字库索引与补充一简对多繁/常用异体映射，提供简繁归一化与变体展开纯函数。
 */
import dictionary from '../data/characters/index.json';

/** 补充的一简对多繁与常用异体字表（键为简体规范字，值为常见繁体/异体集合） */
const SUPPLEMENTARY_VARIANTS: Record<string, readonly string[]> = {
  干: ['干', '乾', '幹'],
  里: ['里', '裏', '裡'],
  钟: ['钟', '鐘', '鍾'],
  发: ['发', '發', '髮'],
  台: ['台', '臺', '檯', '颱'],
  后: ['后', '後'],
  面: ['面', '麵'],
  松: ['松', '鬆'],
  历: ['历', '曆', '歷'],
  云: ['云', '雲'],
  余: ['余', '餘'],
  复: ['复', '復', '複'],
  系: ['系', '係', '繫'],
  准: ['准', '準'],
  脏: ['臟', '髒'],
  筑: ['筑', '築'],
  只: ['只', '隻', '祇'],
  折: ['折', '摺'],
  谷: ['谷', '穀'],
  丰: ['丰', '豐'],
  丑: ['丑', '醜'],
  冲: ['冲', '沖', '衝'],
  范: ['范', '範'],
  姜: ['姜', '薑'],
  苏: ['苏', '蘇', '甦'],
  叶: ['叶', '葉'],
  游: ['游', '遊'],
  周: ['周', '週'],
  注: ['注', '註'],
  才: ['才', '纔'],
  尽: ['尽', '盡', '儘'],
  团: ['团', '團', '糰'],
  坛: ['坛', '壇'],
  汇: ['汇', '匯', '彙'],
  当: ['当', '當', '噹'],
  蒙: ['蒙', '矇', '濛', '懞'],
  征: ['征', '徵'],
  症: ['症', '癥'],
  致: ['致', '緻'],
  制: ['制', '製'],
  伙: ['伙', '夥'],
  获: ['获', '獲', '穫'],
  刮: ['刮', '颳'],
  向: ['向', '嚮'],
  须: ['须', '須', '鬚'],
  咸: ['咸', '鹹'],
  曲: ['曲', '麴'],
  斗: ['斗', '鬥'],
  板: ['板', '闆'],
  表: ['表', '錶'],
  占: ['占', '佔'],
  回: ['回', '迴'],
  几: ['几', '幾'],
  借: ['借', '藉'],
  克: ['克', '剋'],
  了: ['了', '瞭'],
  舍: ['舍', '捨'],
  朱: ['朱', '硃'],
  签: ['签', '簽', '籤'],
  药: ['药', '藥'],
  卫: ['卫', '衛'],
};

const simplifiedMap = new Map<string, string>();
const traditionalVariantsMap = new Map<string, string[]>();

function addVariantPair(simplified: string, variant: string) {
  if (!simplified || !variant) return;
  if (variant !== simplified && !simplifiedMap.has(variant)) {
    simplifiedMap.set(variant, simplified);
  }
  const list = traditionalVariantsMap.get(simplified) ?? [];
  if (!list.includes(variant)) {
    list.push(variant);
    traditionalVariantsMap.set(simplified, list);
  }
}

// 1. 从字库 index.json 提取基础简繁与同码异体映射
const records = dictionary.records as unknown as Array<Array<string | number | boolean | null>>;
for (const row of records) {
  const char = typeof row[0] === 'string' ? row[0] : '';
  const simplified = typeof row[1] === 'string' ? row[1] : char;
  const traditional = typeof row[2] === 'string' ? row[2] : '';
  if (char && simplified && char !== simplified) addVariantPair(simplified, char);
  if (traditional && simplified && traditional !== simplified) addVariantPair(simplified, traditional);
}

for (const [glyph, id] of Object.entries(dictionary.glyphs as Record<string, number>)) {
  const row = records[id];
  if (!row) continue;
  const simplified = typeof row[1] === 'string' ? row[1] : (typeof row[0] === 'string' ? row[0] : '');
  if (simplified && glyph !== simplified) addVariantPair(simplified, glyph);
}

// 2. 叠加补充的一简对多繁/常用异体映射（覆盖并补全字库未收录的异体）
for (const [simplified, variants] of Object.entries(SUPPLEMENTARY_VARIANTS)) {
  for (const variant of variants) {
    if (variant !== simplified) simplifiedMap.set(variant, simplified);
    const list = traditionalVariantsMap.get(simplified) ?? [];
    if (!list.includes(variant)) {
      list.push(variant);
      traditionalVariantsMap.set(simplified, list);
    }
  }
}

/** 将单个汉字转换为简体规范字（未收录则原样返回）。 */
export function toSimplifiedChar(char: string): string {
  if (!char) return char;
  return simplifiedMap.get(char) ?? char;
}

/** 获取汉字对应的繁体/异体候选列表（无映射时返回自身单元素数组）。 */
export function toTraditionalVariants(char: string): string[] {
  if (!char) return [];
  const simplified = toSimplifiedChar(char);
  const variants = traditionalVariantsMap.get(simplified);
  return variants && variants.length > 0 ? [...variants] : [char];
}

/** 展开汉字的全部等价变体（包含简体规范字、繁体及异体字，去重且顺序稳定）。 */
export function expandCharVariants(char: string): string[] {
  if (!char) return [];
  const simplified = toSimplifiedChar(char);
  const variants = traditionalVariantsMap.get(simplified) ?? [];
  return [...new Set([simplified, ...variants, char])];
}

export interface NormalizeChineseTextOptions {
  /** 'simplified'（默认）将汉字转为简体；'preserve' 保留原字形。 */
  form?: 'simplified' | 'preserve';
  /** 是否移除所有空白字符（默认 false，仅做首尾裁剪）。 */
  stripWhitespace?: boolean;
  /** 是否移除标点与符号字符（默认 false）。 */
  stripPunctuation?: boolean;
}

/** 规范化中文文本：Unicode NFC 化、全角空格处理、可选简繁归一与空白/标点清理。 */
export function normalizeChineseText(
  text: string,
  options: NormalizeChineseTextOptions = {},
): string {
  const form = options.form ?? 'simplified';
  let result = text.normalize('NFC').replace(/\u3000/g, ' ').trim();
  if (options.stripWhitespace) result = result.replace(/\s+/g, '');
  if (options.stripPunctuation) result = result.replace(/[\p{P}\p{S}]+/gu, '');
  if (form === 'preserve') return result;
  return [...result].map(toSimplifiedChar).join('');
}
