import { SolarTerm } from 'tyme4ts';
import { createUtcTimestamp, resolveCivilDayStart } from '../huangji/civil-time';
import { resolveBirthClock } from '../birth-time';
import { mountainTrigram, trigrams } from '../compass';
import { isKe, isSheng } from '../calendar';
import { bazhaiPalaces } from './palaces';
export { bazhaiPalaces } from './palaces';

const guaNumbers: Record<number, string> = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
export const guaGroup = (gua: string) => {
  if (!trigrams.includes(gua)) throw new Error('命卦须为八卦之一。');
  return '坎离震巽'.includes(gua) ? '东四' as const : '西四' as const;
};
export function mingGuaForYear(year: number, gender: 'male' | 'female') {
  if (!Number.isSafeInteger(year) || year < 0 || year > 9999 || !['male', 'female'].includes(gender)) throw new Error('命卦需要有效年份和性别。');
  const raw = ((gender === 'male' ? 11 - year % 9 : 4 + year % 9) - 1 + 9) % 9 + 1;
  const number = raw === 5 ? gender === 'male' ? 2 : 8 : raw;
  const gua = guaNumbers[number];
  return { year, gender, number, gua, group: guaGroup(gua) };
}
const starElements: Record<string, readonly [string, string]> = {
  生气: ['贪狼', '木'], 延年: ['武曲', '金'], 天医: ['巨门', '土'], 伏位: ['左辅', '木'],
  绝命: ['破军', '金'], 五鬼: ['廉贞', '火'], 六煞: ['文曲', '水'], 祸害: ['禄存', '土'],
};
const palaceElements: Record<string, string> = { 坎: '水', 艮: '土', 震: '木', 巽: '木', 离: '火', 坤: '土', 兑: '金', 乾: '金' };
export const trigramProfiles: Record<string, { familyRole: string; houseBranch: string; bodyParts: string; element: string }> = {
  乾: { familyRole: '老父/长辈尊长', houseBranch: '戌乾亥', bodyParts: '首、骨、肺、大肠', element: '金' },
  坤: { familyRole: '老母/主妇', houseBranch: '未坤申', bodyParts: '腹、脾胃、肌肉', element: '土' },
  震: { familyRole: '长男/长房', houseBranch: '甲卯乙', bodyParts: '足、肝胆、筋脉', element: '木' },
  巽: { familyRole: '长女/长房女', houseBranch: '辰巽巳', bodyParts: '股、胆气、呼吸神经', element: '木' },
  坎: { familyRole: '中男/二房', houseBranch: '壬子癸', bodyParts: '耳、肾、泌尿血液', element: '水' },
  离: { familyRole: '中女/二房女', houseBranch: '丙午丁', bodyParts: '目、心、小肠心血管', element: '火' },
  艮: { familyRole: '少男/三房', houseBranch: '丑艮寅', bodyParts: '手、背、鼻、脾胃', element: '土' },
  兑: { familyRole: '少女/三房女', houseBranch: '庚酉辛', bodyParts: '口舌、齿咽、肺支气管', element: '金' },
};
export const bazhaiStarGuidance: Record<string, { rank: string; domain: string; layoutAdvice: string }> = {
  生气: { rank: '上吉（第一吉星）', domain: '生发活力、科名功名、添丁创富', layoutAdvice: '宜设大门、书房、办公位或主卧，灶口朝向此方主生发' },
  延年: { rank: '上吉（第二吉星）', domain: '婚姻和睦、人际贵人、健康寿考、守成聚财', layoutAdvice: '最宜设夫妻主卧、大门、客厅核心区，利感情稳定与解厄' },
  天医: { rank: '次吉（第三吉星）', domain: '祛病康健、贵人扶助、稳健财禄', layoutAdvice: '宜设长辈房、卧室、厨房灶口朝向（病者尤为适宜）' },
  伏位: { rank: '小吉（第四吉星）', domain: '平顺守旧、静思蓄势、小富安稳', layoutAdvice: '宜设静室、书房或次卧，主守成不主突进' },
  绝命: { rank: '大凶（第一凶星）', domain: '决裂耗损、意外伤病、竞争退败', layoutAdvice: '忌开门或设主卧，宜设卫生间、储物间镇压（凶方宜压）' },
  五鬼: { rank: '大凶（第二凶星）', domain: '口舌官非、虚惊火烛、是非暗耗', layoutAdvice: '忌设大门、主卧或厨房火灶，宜作库房或保持整洁静置' },
  六煞: { rank: '次凶（第三凶星）', domain: '桃花纠葛、情绪烦乱、肠胃水厄', layoutAdvice: '忌设夫妻房或正门，宜设洗手间、排水区以水泄化' },
  祸害: { rank: '小凶（第四凶星）', domain: '日常口角、琐碎争执、慢性疲乏', layoutAdvice: '忌作主卧或核心会客区，宜作次要通道、楼梯或杂物间' },
};
export function starPalaceRelations(gua: string) {
  return bazhaiPalaces(gua).map((palace) => {
    const [star, starElement] = starElements[palace.label], palaceElement = palaceElements[palace.gua];
    const relation = starElement === palaceElement ? '星与宫比和' : isSheng(starElement, palaceElement) ? '星生宫'
      : isSheng(palaceElement, starElement) ? '宫生星' : isKe(starElement, palaceElement) ? '星克宫' : '宫克星';
    return { gua: palace.gua, direction: palace.direction, label: palace.label, star, starElement, palaceElement, relation };
  });
}
export function compareMingHouse(mingGua: string, sitMountain: string) {
  const houseGua = mountainTrigram(sitMountain), mingGroup = guaGroup(mingGua), houseGroup = guaGroup(houseGua);
  const ming = bazhaiPalaces(mingGua), house = bazhaiPalaces(houseGua);
  return { mingGua, mingGroup, sitMountain, houseGua, houseGroup, match: mingGroup === houseGroup ? '同组' as const : '异组' as const,
    directions: ming.map((item, index) => ({ gua: item.gua, direction: item.direction, ming: item.label, house: house[index].label, mingLuck: item.luck, houseLuck: house[index].luck })) };
}

/** 命卦以立春为界；仅知道出生年或当地日期时保留所有年界候选。 */
export function birthYearCandidates(input: { year: number; month?: number; day?: number; clock?: { hour: number; minute: number; second: number }; timezone?: number; timeZoneId?: string }) {
  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 2100) throw new Error('出生年份须在 1900 至 2100 之间。');
  if ((input.month === undefined) !== (input.day === undefined) || (input.clock && input.month === undefined)) throw new Error('出生月日须同时提供，出生时刻须提供完整日期。');
  if (input.month === undefined || input.day === undefined) {
    if (input.timezone !== undefined || input.timeZoneId !== undefined) throw new Error('仅有年份时不接受时区设置。');
    return { years: [input.year - 1, input.year], status: '交界双候选' as const, rule: '未提供出生月日，列出立春前后年份候选。' };
  }
  const term = SolarTerm.fromIndex(input.year, 3).getJulianDay().getSolarTime();
  const boundary = createUtcTimestamp(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
  if (input.clock) {
    const birth = resolveBirthClock({ year: input.year, month: input.month, day: input.day, ...input.clock, timezone: input.timezone, timeZoneId: input.timeZoneId });
    return { years: [birth.utcTimestamp < boundary ? input.year - 1 : input.year], status: '已核定' as const, boundary, rule: '按实际出生瞬时与立春瞬时比较。' };
  }
  if (input.timeZoneId && input.timezone !== undefined) throw new Error('仅提供出生日期时不能同时按固定偏移筛选 IANA 时区，请提供精确时刻。');
  const timezone = input.timezone ?? (input.timeZoneId ? undefined : 8);
  const dayStart = resolveCivilDayStart({ year: input.year, month: input.month, day: input.day, timezone, timeZoneId: input.timeZoneId }).utcTimestamp;
  const wall = createUtcTimestamp(input.year, input.month - 1, input.day);
  let dayEnd: number | undefined;
  for (let delta = 1; delta <= 3; delta++) {
    const following = new Date(wall + delta * 86_400_000);
    try { dayEnd = resolveCivilDayStart({ year: following.getUTCFullYear(), month: following.getUTCMonth() + 1, day: following.getUTCDate(), timezone, timeZoneId: input.timeZoneId }).utcTimestamp; break; }
    catch (error) { if (!(error instanceof Error) || !error.message.includes('整日不存在')) throw error; }
  }
  if (dayEnd === undefined || dayEnd <= dayStart) throw new Error('无法确定出生当地日的完整范围。');
  const years = dayStart < boundary && dayEnd > boundary ? [input.year - 1, input.year] : [dayEnd <= boundary ? input.year - 1 : input.year];
  return { years, status: years.length > 1 ? '交界双候选' as const : '已核定' as const, boundary, rule: '按当地公历日与立春瞬时比较；跨立春时保留两种候选。' };
}
