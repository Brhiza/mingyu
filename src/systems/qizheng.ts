import type { z } from 'zod';
import type { qizhengInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { resolveQizhengOptions } from './defaults';
import { correctBirthClock, resolveBirthClock } from './birth-time';
import { getTwentyEightStarSevenStar } from './ganzhi-foundation';
import { getCivilDateTimeAtFixedOffset } from './huangji/civil-time';
import { mansionBoundaries, locateMansion } from './qizheng/mansions';
import { ascendantLongitude, positionsAt, skyAt } from './qizheng/positions';
import { resolveFlowTime, resolveFlowWindow } from './qizheng/flow-time';
import { timeLords } from './qizheng/time-lords';
import { scanPeriodEvents, type PeriodSampleCache } from './qizheng/period-events';
import { solarIllumination } from './astronomy/solar-illumination';
import { qizhengEnNan, qizhengShensha } from './qizheng/tradition';
import { qizhengMoonPhase } from './qizheng/moon-phase';
import { qizhengFocus } from './qizheng/prompt-focus';
import { renderQizhengStarMeanings } from './qizheng/star-meanings';
import topics from './qizheng/prompt-topics.json';
import { formatSchoolGuidance, type SchoolGuidanceEntry } from '../prompt-selection';
import { evaluateQizhengSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectQizhengClassics } from './classics';

export const QIZHENG_ELEVEN_STARS = ['太阳', '太阴', '木星', '火星', '土星', '金星', '水星', '紫气', '月孛', '罗睺', '计都'] as const;
const qizhengSchools: Record<'guolao' | 'qintang', SchoolGuidanceEntry> = {
  guolao: {
    label: '果老星宗',
    task: '以命宫、命主及十一曜经纬庙旺为主，结合神煞、恩难仇用与限度生克核对吉凶。',
    basis: '《张果星宗》十一曜定局与限度法',
  },
  qintang: {
    label: '琴堂派',
    task: '重度主、命主与日月昼夜生克，兼察四余化气、五星朝拱与宫分清浊。',
    basis: '《琴堂指金》《五星集腋》论星度清浊',
  },
};

type Input = z.infer<typeof qizhengInput>;
type Source = Pick<Input, 'birth' | 'gender' | 'flow' | 'periodEvents' | 'options' | 'prompt'>;
const signs = [...'戌酉申未午巳辰卯寅丑子亥'];
const palaces = ['命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '妻妾', '疾厄', '迁移', '官禄', '福德', '相貌'];
const masters: Record<string, string> = { 子: '土', 丑: '土', 寅: '木', 卯: '火', 辰: '金', 巳: '水', 午: '日', 未: '月', 申: '水', 酉: '金', 戌: '火', 亥: '木' };
const dignities: Record<string, readonly [string, string, string, string]> = {
  日: ['戌', '巳', '寅', '午'], 月: ['戌', '酉', '亥', '未'], 水: ['午', '子巳', '辰', '巳申'],
  金: ['辰', '午亥', '', '辰酉'], 火: ['卯', '丑', '申', '卯戌'], 木: ['亥', '未亥', '未', '亥寅'], 土: ['丑', '卯辰', '午', '子丑'],
};
const aspects = [{ type: '同宫', angle: 0, orb: 8 }, { type: '六合', angle: 60, orb: 4 }, { type: '四正', angle: 90, orb: 6 }, { type: '三方', angle: 120, orb: 6 }, { type: '对照', angle: 180, orb: 8 }] as const;
const labels: Record<string, string> = { general: '通用', relationship: '感情', career: '事业', wealth: '财运', health: '身心', family: '家庭', academic: '学业', timing: '时机' };

type Palace = { palace: string; signIndex: number; signBranch: string };
function starsAt(timestamp: number, natalPalaces: Palace[], positions = positionsAt(timestamp)) {
  const boundaries = mansionBoundaries(new Date(timestamp));
  const stars = positions.map((star) => {
    const signIndex = Math.floor(star.longitude / 30), signBranch = signs[signIndex], mansion = locateMansion(star.longitude, boundaries);
    const labels = ['庙', '旺', '喜', '乐'];
    const states = star.key ? dignities[star.key].flatMap((branches, index) => branches.includes(signBranch) ? [labels[index]] : []) : [];
    return { ...star, ...mansion, sevenStar: getTwentyEightStarSevenStar(mansion.xiu), signIndex, signBranch,
      palace: natalPalaces.find((palace) => palace.signIndex === signIndex)!.palace, dignity: star.key ? states.join('/') || '平' : '—' };
  });
  return { boundaries, stars };
}
type Star = ReturnType<typeof starsAt>['stars'][number];
function matchAspect(first: Star, second: Star, cross: boolean) {
  const raw = Math.abs(first.longitude - second.longitude), angle = Math.min(raw, 360 - raw);
  const rule = aspects.map((item) => ({ ...item, deviation: Math.abs(angle - item.angle) })).filter((item) => item.deviation <= item.orb).sort((a, b) => a.deviation / a.orb - b.deviation / b.orb)[0];
  if (!rule) return [];
  const ratio = rule.deviation / rule.orb;
  return [{ star1: `${cross ? '流曜' : ''}${first.name}`, star2: `${cross ? '本命' : ''}${second.name}`, type: rule.type, exactAngle: rule.angle,
    actualAngle: Number(angle.toFixed(4)), orb: Number(rule.deviation.toFixed(4)), allowedOrb: rule.orb, orbRatio: Number(ratio.toFixed(4)),
    closeness: ratio <= 1 / 3 ? '紧密' as const : ratio <= 2 / 3 ? '中等' as const : '宽松' as const,
    precisionClass: first.precision === '现代天文计算' && second.precision === '现代天文计算' ? '同层现代天文' as const : '混合模型' as const }];
}
const sortAspects = (items: ReturnType<typeof matchAspect>) => items.sort((a, b) => a.orbRatio - b.orbRatio || a.orb - b.orb);

export async function calculateQizhengData(source: Source, context?: { solarIllumination: typeof solarIllumination; moonPhase?: typeof qizhengMoonPhase; periodSamples?: PeriodSampleCache }) {
  const input = { birth: source.birth, ...(source.gender ? { gender: source.gender } : {}), ...(source.flow ? { flow: source.flow } : {}), ...(source.periodEvents !== undefined ? { periodEvents: source.periodEvents } : {}), ...(source.options ? { options: source.options } : {}), ...(source.prompt ? { prompt: source.prompt } : {}) }, birth = input.birth;
  const clock = { year: birth.year, month: birth.month, day: birth.day, hour: birth.hour, minute: birth.minute, second: birth.second ?? 0,
    timezone: birth.timezone, timeZoneId: birth.timeZoneId, timeStandard: birth.timeStandard, ...(birth.timeStandard === 'true-solar' ? { longitude: birth.longitude } : {}) };
  const resolved = resolveBirthClock(clock), corrected = await correctBirthClock(clock, resolved), timestamp = resolved.utcTimestamp;
  const wall = getCivilDateTimeAtFixedOffset(new Date(corrected.timestamp), resolved.timezone);
  const timeBranchIndex = Math.floor((wall.hour + 1) / 2) % 12;
  const resolvedOptions = resolveQizhengOptions(source.options);
  const locations = positionsAt(timestamp, resolvedOptions);
  const sunSign = Math.floor(locations[0].longitude / 30), moonSign = Math.floor(locations[1].longitude / 30);
  const useAscendant = resolvedOptions.mingGongMethod === 'ascendant';
  const ascLon = useAscendant ? ascendantLongitude(timestamp, birth.latitude, birth.longitude) : undefined;
  const mingGong = useAscendant ? Math.floor(ascLon! / 30) % 12 : (sunSign - 3 + timeBranchIndex + 12) % 12;
  const shenGong = (moonSign - timeBranchIndex + 9 + 12) % 12;
  const twelvePalaces = palaces.map((palace, index) => ({ palace, signIndex: (mingGong + index) % 12, signBranch: signs[(mingGong + index) % 12] }));
  const { boundaries, stars } = starsAt(timestamp, twelvePalaces, locations);
  const sunDegreeInSign = locations[0].longitude % 30;
  const mingDuDegreeInSign = useAscendant ? ascLon! % 30 : sunDegreeInSign;
  const mingDuLongitude = useAscendant ? ascLon! : (mingGong * 30 + sunDegreeInSign) % 360;
  const mingDuMansion = locateMansion(mingDuLongitude, boundaries);
  const mingDu = {
    method: useAscendant ? ('地平真上升点（ASC）立命' as const) : ('太阳同度立命' as const),
    longitude: Number(mingDuLongitude.toFixed(6)),
    degreeInSign: Number(mingDuDegreeInSign.toFixed(6)),
    signBranch: signs[mingGong],
    xiu: mingDuMansion.xiu,
    xiuDegree: Number(mingDuMansion.xiuDegree.toFixed(6)),
    duZhu: getTwentyEightStarSevenStar(mingDuMansion.xiu),
  };
  const relations = sortAspects(stars.flatMap((first, index) => stars.slice(index + 1).flatMap((second) => matchAspect(first, second, false))));
  const illumination = (context?.solarIllumination ?? solarIllumination)({ timestamp, year: birth.year, month: birth.month, day: birth.day, latitude: birth.latitude, longitude: birth.longitude, timezone: resolved.timezone, timeZoneId: birth.timeZoneId });
  const moonPhase = (context?.moonPhase ?? qizhengMoonPhase)(timestamp);
  const shensha = qizhengShensha(timestamp, resolved.timezone), enNan = qizhengEnNan({ daylight: illumination.daylight, mingZhu: masters[signs[mingGong]], stars, aspects: relations });
  const flowTime = input.flow ? resolveFlowTime(input.flow, birth) : null;
  const limits = flowTime && input.gender ? timeLords({ gender: input.gender, birthYear: birth.year, flowYear: flowTime.flowYear, birthTimestamp: timestamp, flowTimestamp: flowTime.timestamp, palaces: twelvePalaces }) : null;
  const flowing = flowTime ? (() => { const result = starsAt(flowTime.timestamp, twelvePalaces, positionsAt(flowTime.timestamp, source.options));
    const period = input.periodEvents && input.flow ? scanPeriodEvents({ ...resolveFlowWindow(input.flow, birth, flowTime), timezone: birth.timezone ?? flowTime.timezone, timeZoneId: birth.timeZoneId, natalStars: stars, palaces: twelvePalaces }, context?.periodSamples) : null;
    return { time: flowTime, mansionBoundaries: result.boundaries, stars: result.stars,
      transits: sortAspects(result.stars.flatMap((first) => stars.flatMap((second) => matchAspect(first, second, true)))), period,
      limitation: period ? '流曜盘为单点；周期事件仅覆盖所列星曜与相位。' : '仅列目标时刻流曜与本命吊照，不代表整个周期；未启用周期事件扫描。' }; })() : null;
  return { input, basis: { utcTimestamp: timestamp, utcDateTime: new Date(timestamp).toISOString(), localDateTime: resolved.localDateTime, timezone: resolved.timezone,
    timeZoneId: birth.timeZoneId ?? null, latitude: birth.latitude, longitude: birth.longitude, palaceTimeStandard: birth.timeStandard ?? 'civil', palaceClock: wall,
    trueSolarCorrection: corrected.correction ?? null, timeBranchIndex },
    mansionModel: { epoch: 'J2000 / ICRS', source: 'SIMBAD 距星坐标和自行；Astronomy Engine J2000 到目标日期真黄道变换', limitation: '现代距星坐标复原不等于某一历史历元的古赤道距度表；距宿界 1e-9° 内按边界处理。' },
    mansionBoundaries: boundaries, stars, mingGong, shenGong, mingZhu: masters[signs[mingGong]], mingDu, twelvePalaces, aspects: relations, shensha, enNan, illumination, moonPhase, flowing, timeLords: limits,
    sky: { ...skyAt(timestamp, birth.latitude, birth.longitude), moonPhaseDegrees: moonPhase.phaseAngleDegrees, moonIlluminationFraction: moonPhase.illuminationFraction },
    limitations: ['命宫宿度与洞微百岁定式已提供参考；实测交限童限岁数依各派校法不同，未作唯一裁定。', '紫炁为传统均速模型，与现代天文星位精度不同；庙旺与吊照为传统规则，不证明现实结果。', '真太阳时只校正命身宫的时辰，不改变天体实际计算瞬时或神煞的民用日干。'] };
}
type Data = Awaited<ReturnType<typeof calculateQizhengData>>;
const starShortToFull: Record<string, string> = {
  日: '太阳', 月: '太阴', 木: '岁星(木)', 火: '荧惑(火)', 土: '镇星(土)', 金: '太白(金)', 水: '辰星(水)', 炁: '紫炁(木余)', 气: '紫炁(木余)', 孛: '月孛(水余)', 罗: '罗睺(火余)', 计: '计都(土余)',
  木星: '岁星(木)', 火星: '荧惑(火)', 土星: '镇星(土)', 金星: '太白(金)', 水星: '辰星(水)', 紫气: '紫炁(木余)', 紫炁: '紫炁(木余)', 月孛: '月孛(水余)', 罗睺: '罗睺(火余)', 计都: '计都(土余)',
};
/** 《果老星宗·十干化曜歌》十天干化十曜：天禄、天暗、天福、天耗、天荫、天贵、天刑、天印、天囚、天权 */
const tenStemHuaYao: Record<string, readonly [string, string, string, string, string, string, string, string, string, string]> = {
  甲: ['火星', '木星', '土星', '金星', '水星', '太阴', '太阳', '紫气', '月孛', '罗睺'],
  乙: ['月孛', '罗睺', '计都', '木星', '火星', '土星', '金星', '水星', '太阳', '太阴'],
  丙: ['木星', '火星', '土星', '金星', '水星', '太阳', '太阴', '罗睺', '计都', '紫气'],
  丁: ['金星', '水星', '太阳', '太阴', '紫气', '月孛', '罗睺', '计都', '木星', '火星'],
  戊: ['土星', '金星', '水星', '太阴', '太阳', '火星', '木星', '月孛', '罗睺', '计都'],
  己: ['太阴', '太阳', '紫气', '月孛', '罗睺', '计都', '木星', '火星', '土星', '金星'],
  庚: ['水星', '太阳', '太阴', '罗睺', '计都', '紫气', '月孛', '木星', '火星', '土星'],
  辛: ['紫气', '月孛', '罗睺', '计都', '木星', '火星', '土星', '金星', '水星', '太阳'],
  壬: ['太阳', '太阴', '火星', '木星', '土星', '金星', '水星', '计都', '紫气', '月孛'],
  癸: ['罗睺', '计都', '木星', '火星', '土星', '金星', '水星', '太阳', '太阴', '紫气'],
};
const huaYaoLabels = ['天禄（爵禄主）', '天暗（暗昧耗）', '天福（福德救）', '天耗（破耗散）', '天荫（庇荫贵）', '天贵（清贵显）', '天刑（刑煞克）', '天印（权印信）', '天囚（羁绊困）', '天权（威权柄）'] as const;

function buildQizhengCoreRulersAndHuaYao(data: Data): string {
  const starByName = Object.fromEntries(data.stars.map((s) => [s.name, s]));
  const mingStarName = starShortToFull[data.mingZhu] ?? data.mingZhu;
  const shenBranch = signs[data.shenGong];
  const shenZhuShort = masters[shenBranch];
  const shenStarName = starShortToFull[shenZhuShort] ?? shenZhuShort;
  const duStarName = starShortToFull[data.mingDu.duZhu] ?? data.mingDu.duZhu;
  const formatMaster = (role: string, name: string) => {
    const s = starByName[name];
    return s ? `${role}${name}落${s.palace}（${s.signBranch}宫·${s.xiu}宿${s.xiuDegree.toFixed(2)}°，${s.dignity}${s.retrograde ? '，逆行' : ''}）` : `${role}${name}`;
  };
  const threeMastersLine = `三主定位：${formatMaster('命主', mingStarName)}；${formatMaster('身主', shenStarName)}；${formatMaster('度主', duStarName)}。`;
  const palaceRulersLine = `十二宫主飞宫：${data.twelvePalaces.map((p) => {
    const rShort = masters[p.signBranch];
    const rName = starShortToFull[rShort] ?? rShort;
    const s = starByName[rName];
    return `${p.palace}（${p.signBranch}）主${rShort}飞${s ? `${s.palace}［${s.dignity}］` : '待考'}`;
  }).join('；')}。`;
  const yearStem = data.shensha.basis.yearGanZhi[0];
  const huaList = tenStemHuaYao[yearStem];
  const huaLine = huaList
    ? `生年（${data.shensha.basis.yearGanZhi}年·${yearStem}干）十干化曜：${huaYaoLabels.map((label, idx) => {
        const raw = huaList[idx];
        const fullKey = starShortToFull[raw] ?? raw;
        const s = starByName[fullKey];
        return `${label}＝${raw}${s ? `（入${s.palace}）` : ''}`;
      }).join('、')}。`
    : '';
  return [threeMastersLine, palaceRulersLine, huaLine].filter(Boolean).join('\n');
}

export function renderQizhengData(data: Data, question: string, options: Input['prompt']) {
  const topic = options?.topicId ?? 'general', subtopics = topics.subtopics as Record<string, { id: string; label: string }[]>;
  const subtopic = options?.subtopicId ? subtopics[topic]?.find((item) => item.id === options.subtopicId) : undefined;
  if (options?.subtopicId && !subtopic) throw new Error('所选子主题不属于当前主题。');
  const scope = options?.scope ?? (data.flowing ? 'full' : 'natal');
  if (scope !== 'natal' && !data.flowing) throw new Error('所选流曜范围需要原始流曜时点。');
  if (options?.eventDetail && (scope === 'natal' || !data.flowing?.period)) throw new Error('事件明细需要启用周期扫描并选择流曜范围。');
  const requiredKind = scope === 'yearly' ? 'year' : scope === 'monthly' ? 'month' : scope === 'daily' ? 'day' : undefined;
  if (requiredKind && data.flowing && (requiredKind === 'day' ? !['day', 'instant'].includes(data.flowing.time.kind) : data.flowing.time.kind !== requiredKind)) throw new Error('提示词范围与流曜时点类型不一致。');
  const starLines = data.stars.map((star) => `${star.name}：黄经${star.longitude.toFixed(4)}°，${star.xiu}宿${star.xiuDegree.toFixed(4)}°、${star.signBranch}宫、${star.palace}，${star.dignity}${star.retrograde === undefined ? '' : star.retrograde ? '，逆行' : '，顺行'}`);
  const relationLines = data.aspects.map((aspect) => `${aspect.star1}与${aspect.star2}${aspect.type}（夹角${aspect.actualAngle}°、偏差${aspect.orb}°、${aspect.closeness}）`);
  const flowing = scope !== 'natal' ? data.flowing : null, limits = scope !== 'natal' ? data.timeLords : null;
  const flowText = flowing ? `【流曜取样】\n当地${flowing.time.localDateTime}（UTC${flowing.time.timezone >= 0 ? '+' : ''}${flowing.time.timezone}），瞬时${flowing.time.utcDateTime}。${flowing.time.note}\n${flowing.stars.map((star) => `流曜${star.name}：${star.xiu}宿${star.xiuDegree.toFixed(4)}°，入本命${star.signBranch}宫${star.palace}，${star.dignity}`).join('；')}\n【流曜与本命吊照】\n${flowing.transits.map((item) => `${item.star1}与${item.star2}${item.type}（夹角${item.actualAngle}°、偏差${item.orb}°、${item.closeness}）`).join('；') || '未命中所列相位。'}\n${flowing.limitation}` : '';
  const limitText = limits ? `【行限】\n${limits.ageNote}\n小限${limits.currentMinorLimit.signBranch}宫${limits.currentMinorLimit.palace}；流年太岁${limits.annualBranch}入${limits.annualPalace.palace}。\n洞微宫序：${limits.majorPalaceYears.map((item) => `${item.signBranch}宫${item.palace}${item.years === null ? '年数待核' : `${item.years}年`}`).join('；')}。\n洞微百岁定式参考（命宫15年起）：当前虚岁${limits.nominalAge}对应${limits.dongweiStandard.activeLimit.signBranch}宫${limits.dongweiStandard.activeLimit.palace}（${limits.dongweiStandard.activeLimit.startAge}–${limits.dongweiStandard.activeLimit.endAge}岁）。${limits.limitation}` : flowing ? '【行限】\n未提供性别，不计算小限或洞微年分。' : '';
  const period = flowing?.period;
  const eventItems = period ? options?.eventDetail === 'full' ? period.events : period.events.slice(0, 20) : [];
  const eventText = period ? `【流曜周期事件】\nUTC ${new Date(period.startUtcMs).toISOString()} 至 ${new Date(period.endUtcMs).toISOString()}（终点不含）。扫描流曜：${period.movingStars.join('、')}；本命：${period.natalStars.join('、')}；相位：${period.aspectTypes.join('、')}。共${period.events.length}项，提示词列出${eventItems.length}项${eventItems.length < period.events.length ? `，其余${period.events.length - eventItems.length}项见结构化结果` : ''}。\n事件聚集：${period.windows.map((window) => `${new Date(window.startUtcMs).toISOString()}至${new Date(window.endUtcMs).toISOString()}（${window.count}项：${window.kinds.map((kind) => `${kind.kind}${kind.count}项`).join('、')}）`).join('；') || '未形成多个事件的聚集窗口'}。\n${eventItems.map((event) => event.text).join('\n') || '所列范围未见事件。'}\n${period.limitation}` : '';
  const crossingText = `${data.illumination.sunriseSunset.name}：${data.illumination.sunriseSunset.crossings.length ? data.illumination.sunriseSunset.crossings.map((event) => `${event.direction}${event.localDateTime}（UTC${event.timezone >= 0 ? '+' : ''}${event.timezone}）`).join('、') : data.illumination.sunriseSunset.status}`;
  const enNan = data.enNan;
  const focus = qizhengFocus[topic];
  const focusPalaces = focus.palaces.map((name) => {
    const palace = data.twelvePalaces.find((item) => item.palace === name)!;
    const stars = data.stars.filter((star) => star.palace === name).map((star) => `${star.name}（${star.dignity}）`);
    return `${name}${palace.signBranch}宫：${stars.join('、') || '无所列星曜'}`;
  });
  const subtask = options?.subtopicId ? focus.subtopics?.[options.subtopicId] : undefined;
  const text = [`【七政四余本命】\n出生瞬时${data.basis.utcDateTime}；时区 UTC${data.basis.timezone >= 0 ? '+' : ''}${data.basis.timezone}；宫位取${data.basis.palaceTimeStandard === 'true-solar' ? '真太阳时' : '民用时间'}。\n命宫${signs[data.mingGong]}，身宫${signs[data.mingGong === data.shenGong ? data.shenGong : data.shenGong]}，命主${data.mingZhu}；${data.mingDu.method}度：${data.mingDu.xiu}宿${data.mingDu.xiuDegree.toFixed(2)}°（度主${data.mingDu.duZhu}）。\n${buildQizhengCoreRulersAndHuaYao(data)}`,
    `【十一星】\n${starLines.join('\n')}`,
    options?.includeStarMeanings ? renderQizhengStarMeanings(data.stars) : '',
    `【吊照】\n${relationLines.join('；') || '未命中所列相位。'}`,
    `【神煞】\n节气年${data.shensha.basis.yearGanZhi}、出生地民用日${data.shensha.basis.dayGanZhi}：${data.shensha.stars.map((star) => `${star.name}${star.value}`).join('、')}。${data.shensha.limitation}`,
    `【恩难仇用】\n${enNan.sect}（${enNan.sectSummary}），命主${enNan.mingZhu}${enNan.mingZhu === enNan.mingElement ? '' : `（五行${enNan.mingElement}）`}；恩${enNan.enStars.join('、')}，难${enNan.nanStars.join('、')}，仇${enNan.chouStars.join('、')}，用${enNan.yongStars.join('、')}。\n${enNan.interactions.map((item) => `${item.role}${item.star}与命主形成${item.aspect}吊照`).join('；') || '命主未见所列恩难交会。'}\n${enNan.limitation}`,
    flowText,
    limitText,
    eventText,
    `【出生时天文背景】\n太阳视高度${data.sky.sunAltitudeDegrees.toFixed(2)}°（${crossingText}）；${data.moonPhase.eightPhaseName}${data.moonPhase.waxing ? '盈' : '亏'}，月相角${data.moonPhase.phaseAngleDegrees.toFixed(2)}°，月面照明约${(data.moonPhase.illuminationFraction * 100).toFixed(1)}%，近似月龄${data.moonPhase.approximateMoonAgeDays.toFixed(2)}日。\n前一四正${data.moonPhase.previous.name}：UTC ${new Date(data.moonPhase.previous.utcTimestamp).toISOString()}；${data.moonPhase.current ? `当前四正${data.moonPhase.current.name}；` : ''}下一四正${data.moonPhase.next.name}：UTC ${new Date(data.moonPhase.next.utcTimestamp).toISOString()}。`,
    formatSchoolAlgorithmSection(evaluateQizhengSchoolAlgorithms({ ...data, enNan }, options?.schools)),
    formatSchoolGuidance(options?.schools, qizhengSchools),
    options?.includeClassics
      ? formatClassicExcerpts(
          selectQizhengClassics([
            data.mingZhu,
            data.mingDu.duZhu,
            ...data.stars
              .filter((s) => s.palace === '命宫' || /庙|旺/.test(s.dignity))
              .map((s) => s.name),
            ...QIZHENG_ELEVEN_STARS,
          ]),
          '典籍片段',
        )
      : '',
    `【主题与任务】\n主题：${labels[topic]}${subtopic ? `（${subtopic.label}）` : ''}；范围：${scope === 'natal' ? '本命' : '本命与指定流曜时点'}。\n${focusPalaces.length ? `建议优先核对：${focusPalaces.join('；')}。` : '建议结合问题核对全部宫位。'}\n${focus.task}${subtask ? ` ${subtask}` : ''}${topic === 'timing' && !flowing ? ' 当前未选择流曜资料，不能据此判断具体时机。' : ''}\n结合所列星宿、宫位与吊照解释传统取象，分开事实与推论，说明反证及资料不足。`,
    `【限制】\n${data.limitations.join('\n')}\n${data.mansionModel.limitation}`,
    `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function qizheng(input: Input) {
  const data = await calculateQizhengData(input);
  return { data, summary: { title: '七政四余', lines: [`命宫：${signs[data.mingGong]}`, `本命星曜：${data.stars.length}`, `流曜：${data.flowing ? data.flowing.time.localDateTime : '未指定'}`] }, prompt: renderQizhengData(data, input.question, input.prompt) };
}
export async function promptForSavedQizheng(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = await calculateQizhengData(source);
  // 天文库内部缓存导致末位浮点抖动；字段和文本仍严格一致，数值允许 1e-9 的绝对误差。
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('七政四余结果与出生资料不一致。');
  return renderQizhengData(expected, question, options ?? source.prompt);
}
