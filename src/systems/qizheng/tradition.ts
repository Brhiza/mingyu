import { getDivinationTime, isKe, isSheng } from '../calendar';

const guiRen: Record<string, string> = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '寅午' };
const yearGroups = [{ members: '申子辰', values: '寅巳酉辰' }, { members: '寅午戌', values: '申亥卯戌' }, { members: '巳酉丑', values: '亥寅午丑' }, { members: '亥卯未', values: '巳申子未' }];
const seasonGroups = [{ members: '亥子丑', values: '寅戌' }, { members: '寅卯辰', values: '巳丑' }, { members: '巳午未', values: '申辰' }, { members: '申酉戌', values: '亥未' }];

/** 年支按出生真实瞬时的节气年，日干按出生地民用钟表取值。 */
export function qizhengShensha(timestamp: number, timezone: number) {
  const { ganzhi } = getDivinationTime(new Date(timestamp), timezone * 60), dayStem = ganzhi.day[0], yearBranch = ganzhi.year[1];
  const group = yearGroups.find((item) => item.members.includes(yearBranch)), season = seasonGroups.find((item) => item.members.includes(yearBranch)), noble = guiRen[dayStem];
  if (!group || !season || !noble) throw new Error('七政神煞年支或日干无效。');
  const values = [noble, ...group.values, ...season.values];
  return { basis: { yearGanZhi: ganzhi.year, dayGanZhi: ganzhi.day, dayStandard: '出生地民用时间' as const },
    stars: ['天乙贵人', '驿马', '劫煞', '咸池', '华盖', '孤辰', '寡宿'].map((name, index) => ({ name, value: values[index] })),
    limitation: '只列传统年支及日干对应，不直接推断现实结果。' };
}

const elements: Record<string, string> = { 太阳: '火', 太阴: '水', 水星: '水', 金星: '金', 火星: '火', 木星: '木', 土星: '土', 紫炁: '木', 月孛: '水', 罗睺: '火', 计都: '土' };
const aliases: Record<string, string> = { 日: '太阳', 月: '太阴', 水: '水星', 金: '金星', 火: '火星', 木: '木星', 土: '土星', 辰星: '水星', 太白: '金星', 荧惑: '火星', 岁星: '木星', 镇星: '土星' };
const canonical = (name: string) => { const base = name.replace(/[（(].*$/, '').trim(); return Object.hasOwn(elements, base) ? base : Object.hasOwn(aliases, base) ? aliases[base] : undefined; };
const rules: Record<string, readonly [number, number]> = { 同宫: [0, 8], 六合: [60, 4], 四正: [90, 6], 三方: [120, 6], 对照: [180, 8] };

/** 命主恩难仇用按五行计算，交会须由当前星位和相位共同支持。 */
export function qizhengEnNan(input: { daylight: boolean; mingZhu: string; stars: ReadonlyArray<{ name: string; longitude: number }>; aspects: ReadonlyArray<{ star1: string; star2: string; type: string }> }) {
  const mingStar = canonical(input.mingZhu), mingElement = mingStar ? elements[mingStar] : undefined;
  if (!mingStar || !mingElement) throw new Error('七政恩难命主名称无效。');
  const wuxing = [...'木火土金水'], en = wuxing.find((element) => isSheng(element, mingElement))!, nan = wuxing.find((element) => isKe(element, mingElement))!,
    yong = wuxing.find((element) => isSheng(mingElement, element))!, chou = wuxing.find((element) => isKe(element, en))!;
  const roles = { enStars: [] as string[], nanStars: [] as string[], chouStars: [] as string[], yongStars: [] as string[] };
  for (const [star, element] of Object.entries(elements)) {
    if (star === mingStar) continue;
    if (element === en) roles.enStars.push(star); else if (element === nan) roles.nanStars.push(star); else if (element === chou) roles.chouStars.push(star); else if (element === yong) roles.yongStars.push(star);
  }
  const longitudes = new Map(input.stars.map((star) => [canonical(star.name), star.longitude]));
  const interactions = input.aspects.flatMap((aspect) => {
    const first = canonical(aspect.star1), second = canonical(aspect.star2), firstAngle = longitudes.get(first), secondAngle = longitudes.get(second), rule = Object.hasOwn(rules, aspect.type) ? rules[aspect.type] : undefined;
    if (!first || !second || (first !== mingStar && second !== mingStar) || !Number.isFinite(firstAngle) || !Number.isFinite(secondAngle) || !rule) return [];
    const difference = Math.abs(((firstAngle! - secondAngle!) % 360 + 360) % 360), angle = Math.min(difference, 360 - difference);
    if (Math.abs(angle - rule[0]) > rule[1]) return [];
    const counterpart = first === mingStar ? aspect.star2 : aspect.star1, target = first === mingStar ? second : first, element = elements[target];
    const role = element === nan ? '难星' as const : element === en ? '恩星' as const : null;
    return role ? [{ role, star: counterpart, aspect: aspect.type === '同宫' ? '合相' : aspect.type }] : [];
  });
  return { sect: input.daylight ? '昼生' as const : '夜生' as const, sectSummary: input.daylight ? '昼生以日为尊' : '夜生以月为重', mingZhu: input.mingZhu, mingElement,
    ...roles, interactions, limitation: '以本命星位和传统五行关系描述恩难交会；昼夜按当地太阳上缘升落划分，不推断现实吉凶。' };
}
