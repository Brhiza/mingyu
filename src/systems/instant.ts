import type { z } from 'zod';
import type { instantInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { createTimezoneOffsetReader, formatCivilDateTime, getCivilDateTimeAtFixedOffset, createUtcTimestamp } from './huangji/civil-time';
import { formatNatalFlying } from './ziwei-flying';
import { formatZiweiStarLabel } from './ziwei';
import { buildMethodSituationDigest } from './situation-digest';
import { formatAstroHouseSystem } from './prompt-format';
import { formatPatternEvidence } from './bazi/pattern-evidence';
import { formatUsefulStrategy } from './bazi/useful-strategy';
import { correctBirthClock, lunarDateDiscrepancy, resolveBirthClock } from './birth-time';
import { buildZiweiAstrolabe, getMutagensByStem, normalizeZiweiRules, type ZiweiStar } from './ziwei/index';

type Input = z.infer<typeof instantInput>;
type Source = Pick<Input, 'type' | 'at' | 'timeStandard' | 'observer' | 'ziweiAlgorithm'>;
const labels = { bazi: '八字', ziwei: '紫微', 'bazi-ziwei': '八字紫微', astrolabe: '西洋星盘', qizheng: '七政四余' } as const;

async function calculateData(source: Source, currentTime: string) {
  const timestamp = source.at ? Date.parse(source.at) : Math.floor(Date.parse(currentTime) / 1000) * 1000;
  const at = new Date(timestamp).toISOString(), observer = source.observer, standard = source.timeStandard ?? 'beijing';
  const useObserverClock = standard === 'true-solar' || source.type === 'astrolabe' || source.type === 'qizheng';
  const actualOffset = observer?.timeZoneId ? createTimezoneOffsetReader(observer.timeZoneId)(timestamp) : observer?.timezone;
  if (observer?.timeZoneId && observer.timezone !== undefined && Math.abs(actualOffset! - observer.timezone) > 1e-6) throw new Error('观测地点固定偏移与起盘时刻的 IANA 时区不一致。');
  const timezone = useObserverClock ? actualOffset! : 8;
  if (!Number.isInteger(timezone * 60)) throw new Error('即时盘仅支持整分钟 UTC 偏移。');
  const wall = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
  if (wall.year < 1900 || wall.year > 2100) throw new Error('即时盘支持当地 1900 至 2100 年。');
  const zone = { timezone, ...(useObserverClock && observer?.timeZoneId ? { timeZoneId: observer.timeZoneId } : {}) };
  const birth = { year: wall.year, month: wall.month, day: wall.day, clock: { kind: 'exact' as const, hour: wall.hour, minute: wall.minute, second: wall.second }, ...zone,
    ...(standard === 'true-solar' ? { timeStandard: 'true-solar' as const, longitude: observer!.longitude } : {}) };
  let bazi: Awaited<ReturnType<typeof neutralBazi>> | undefined, ziwei: Awaited<ReturnType<typeof neutralZiwei>> | undefined;
  let astrolabe: Awaited<ReturnType<typeof neutralAstrolabe>> | undefined, qizheng: Awaited<ReturnType<typeof neutralQizheng>> | undefined;
  if (source.type === 'bazi' || source.type === 'bazi-ziwei') bazi = await neutralBazi(birth);
  if (source.type === 'ziwei' || source.type === 'bazi-ziwei') ziwei = await neutralZiwei(birth, source.ziweiAlgorithm);
  if (source.type === 'astrolabe' || source.type === 'qizheng') {
    const location = { ...wall, ...zone, longitude: observer!.longitude, latitude: observer!.latitude! };
    if (source.type === 'astrolabe') astrolabe = await neutralAstrolabe(location, standard === 'true-solar');
    else qizheng = await neutralQizheng(location, standard === 'true-solar');
  }
  const correction = astrolabe?.basis.trueSolarTimeCorrection;
  const trueSolarDateTime = standard !== 'true-solar' ? undefined
    : bazi ? formatCivilDateTime(bazi.calculationClock)
      : ziwei ? ziwei.correctedLocalDateTime
        : qizheng ? formatCivilDateTime(qizheng.basis.palaceClock)
          : correction ? formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(Math.floor((timestamp + correction.totalCorrectionMinutes * 60_000) / 1000) * 1000), timezone))
            : undefined;
  return { input: { type: source.type, at, timeStandard: standard, ...(observer ? { observer } : {}), ...(source.ziweiAlgorithm ? { ziweiAlgorithm: source.ziweiAlgorithm } : {}) },
    basis: { utcDateTime: at, localDateTime: formatCivilDateTime(wall), timezone, clockSource: useObserverClock ? 'observer' as const : 'beijing' as const, ...(trueSolarDateTime ? { trueSolarDateTime } : {}) },
    ...(bazi ? { bazi } : {}), ...(ziwei ? { ziwei } : {}), ...(astrolabe ? { astrolabe } : {}), ...(qizheng ? { qizheng } : {}),
    limitation: `即时盘记录起盘时刻，不是个人出生盘；不提供个人性别、大运、岁限或个人命理结论。真太阳时只调整有关排盘口径，不改变天体计算的真实瞬时。${ziwei?.lunarDateWarning ? `\n${ziwei.lunarDateWarning}` : ''}` };
}

type Birth = { year: number; month: number; day: number; clock: { kind: 'exact'; hour: number; minute: number; second: number }; timezone: number; timeZoneId?: string; timeStandard?: 'true-solar'; longitude?: number };
async function neutralBazi(birth: Birth) {
  const { calculateBaziPillars } = await import('./bazi/pillars');
  const chart = await calculateBaziPillars(birth);
  return { pillars: chart.pillars, monthCommander: chart.monthCommander, natalFacts: chart.natalFacts, strength: chart.strength,
    ordinaryPattern: chart.ordinaryPattern, transformation: chart.transformation, quzhi: chart.quzhi, conger: chart.conger, extreme: chart.extreme,
    patternOverview: chart.patternOverview, patternEvidence: chart.patternEvidence, usefulBaseline: chart.usefulBaseline, climate: chart.climate, climateDecision: chart.climateDecision, usefulStrategy: chart.usefulStrategy,
    calculationClock: chart.basis.calculationClock, trueSolar: chart.basis.trueSolar ?? null };
}
async function neutralZiwei(birth: Birth, algorithm: Input['ziweiAlgorithm']) {
  const clock = { year: birth.year, month: birth.month, day: birth.day, ...birth.clock, timezone: birth.timezone, timeZoneId: birth.timeZoneId, timeStandard: birth.timeStandard, longitude: birth.longitude };
  const resolved = resolveBirthClock(clock), corrected = await correctBirthClock(clock, resolved);
  const wall = getCivilDateTimeAtFixedOffset(new Date(corrected.timestamp), resolved.timezone);
  const rules = normalizeZiweiRules({ algorithm });
  const originalIndex = wall.hour === 23 ? 12 : Math.floor((wall.hour + 1) / 2);
  const effectiveDate = rules.dayDivide === 'forward' && originalIndex === 12
    ? getCivilDateTimeAtFixedOffset(new Date(createUtcTimestamp(wall.year, wall.month - 1, wall.day + 1)), 0)
    : wall;
  const effectiveIndex = rules.dayDivide === 'forward' && originalIndex === 12 ? 0 : originalIndex;
  const chart = buildZiweiAstrolabe({
    solarDate: { year: effectiveDate.year, month: effectiveDate.month, day: effectiveDate.day },
    timeIndex: effectiveIndex,
    gender: 'neutral',
    rules,
    solarTermMoment: { year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute, second: wall.second },
  });
  const mapStar = (value: ZiweiStar) => ({
    name: value.name,
    type: value.type,
    scope: value.scope,
    ...(value.brightness ? { brightness: value.brightness } : {}),
    ...(value.mutagen ? { mutagen: value.mutagen } : {}),
  });
  const palaces = chart.palaces.map((palace) => {
    const stars = getMutagensByStem(palace.heavenlyStem, rules.mutagenSchool);
    const flyingTransformations = (['禄', '权', '科', '忌'] as const).map((mutagen, index) => {
      const targets = chart.palaces.filter((item) => [...item.majorStars, ...item.minorStars].some((s) => s.name === stars[index]));
      if (targets.length !== 1) throw new Error(`紫微${palace.name}化${mutagen}落宫无法确认。`);
      const target = targets[0];
      return {
        mutagen,
        star: stars[index],
        targetIndex: target.index,
        targetName: target.name,
        targetBranch: target.earthlyBranch,
        relation: target.index === palace.index ? 'self' as const : (target.index + 6) % 12 === palace.index ? 'opposite' as const : 'other' as const,
      };
    });
    return {
      index: palace.index,
      name: palace.name,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      majorStars: palace.majorStars.map(mapStar),
      minorStars: palace.minorStars.map(mapStar),
      adjectiveStars: palace.adjectiveStars.map(mapStar),
      flyingTransformations,
    };
  });
  const warning = lunarDateDiscrepancy(effectiveDate);
  return {
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    chineseDate: chart.chineseDate,
    time: chart.time,
    timeRange: chart.timeRange,
    soulBranch: chart.earthlyBranchOfSoulPalace,
    bodyBranch: chart.earthlyBranchOfBodyPalace,
    soul: chart.soul,
    body: chart.body,
    fiveElementsClass: chart.fiveElementsClass,
    palaces,
    omitted: chart.omittedGenderStars ?? [],
    rules,
    correctedLocalDateTime: formatCivilDateTime(wall),
    trueSolarCorrection: corrected.correction ?? null,
    ...(warning ? { lunarDateWarning: warning } : {}),
  };
}
type Location = { year: number; month: number; day: number; hour: number; minute: number; second: number; timezone: number; timeZoneId?: string; latitude: number; longitude: number };
async function neutralAstrolabe(location: Location, trueSolar: boolean) {
  const { calculateAstrolabeIndependentData } = await import('./astrolabe');
  const chart = await calculateAstrolabeIndependentData({ birth: { ...location, useTrueSolarTime: trueSolar, coordinateAccuracy: 'user-provided' } });
  return { basis: chart.basis, points: chart.points, derived: chart.derived, angles: chart.angles, houses: chart.houses, aspects: chart.aspects,
    distributions: chart.distributions, patterns: chart.patterns, warnings: chart.warnings, limitations: chart.limitations.filter((item) => item.includes('改用') || item.includes('未计算谷神')) };
}
async function neutralQizheng(location: Location, trueSolar: boolean) {
  const { calculateQizhengData } = await import('./qizheng');
  const chart = await calculateQizhengData({ birth: { ...location, ...(trueSolar ? { timeStandard: 'true-solar' as const } : {}) } });
  return { basis: chart.basis, mansionModel: chart.mansionModel, mansionBoundaries: chart.mansionBoundaries, stars: chart.stars, mingGong: chart.mingGong, shenGong: chart.shenGong,
    mingZhu: chart.mingZhu, twelvePalaces: chart.twelvePalaces, aspects: chart.aspects, shensha: chart.shensha, enNan: chart.enNan, illumination: chart.illumination, moonPhase: chart.moonPhase, sky: chart.sky, limitations: chart.limitations };
}
type Data = Awaited<ReturnType<typeof calculateData>>;
function render(data: Data, question: string) {
  const pNames: Record<string, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
  const pillars = data.bazi ? Object.entries(data.bazi.pillars).map(([position, p]) => `${pNames[position]}${p.ganZhi}（十神${p.tenGod}，藏干${p.hiddenStems.map((s) => s.stem).join('、')}）`).join('；') : '';
  const ziweiOmitted = data.ziwei?.omitted.length ? `\n排除男女不同的星曜：${data.ziwei.omitted.map((p) => `${p.palace}${p.stars.join('、')}`).join('；')}` : '';
  const ziwei = data.ziwei ? `五行局：${data.ziwei.fiveElementsClass}；命主：${data.ziwei.soul}；身主：${data.ziwei.body}；命宫：${data.ziwei.soulBranch}；身宫：${data.ziwei.bodyBranch}\n${data.ziwei.palaces.map((p, idx, arr) => {
    const opp = arr[(idx + 6) % 12];
    const emptyNote = p.majorStars.length === 0 && opp && opp.majorStars.length > 0 ? `［空宫，借对宫${opp.name}${opp.majorStars.map((s) => formatZiweiStarLabel(s, { parenBrightness: true })).join('、')}］` : p.majorStars.length === 0 ? '［空宫］' : '';
    return `${p.name}${p.heavenlyStem}${p.earthlyBranch}${emptyNote}：${[...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map((s) => formatZiweiStarLabel(s, { parenBrightness: true })).join('、') || '无所列星曜'}`;
  }).join('\n')}\n【本命宫干四化】\n${formatNatalFlying(data.ziwei.palaces)}${ziweiOmitted}` : '';
  const baziEvidence = data.bazi ? `月令司权${data.bazi.monthCommander.stem}；旺衰条件${data.bazi.strength.status}；普通取格候选${data.bazi.ordinaryPattern.candidate}；已核算路线${data.bazi.patternOverview.pattern}。\n柱间关系：${data.bazi.natalFacts.relations.map((item) => `${item.positions.map((pos) => pNames[pos]).join('、')}${item.values.join('、')}${item.name}${item.element ?? ''}`).join('；') || '未命中所列关系'}。\n${formatPatternEvidence(data.bazi.patternEvidence)}\n${formatUsefulStrategy(data.bazi.usefulStrategy)}` : '';
  const astro = data.astrolabe ? (() => {
    const chart = data.astrolabe, names = Object.fromEntries(chart.points.map((p) => [p.id, p.name]));
    const points = [...chart.points, ...chart.derived, ...chart.angles].map((p) => {
      const dignity = 'dignity' in p && Array.isArray(p.dignity) && p.dignity.length ? `（${p.dignity.map((d: string) => ({ domicile: '入庙', exaltation: '耀升', detriment: '失势', fall: '落陷' } as Record<string, string>)[d] ?? d).join('、')}）` : '';
      const retro = 'retrograde' in p && p.retrograde ? '（逆行）' : '';
      return `${p.name} ${p.sign}${p.degreeInSign.toFixed(2)}°${retro}${dignity} 第${p.house}宫`;
    }).join('\n');
    const houses = chart.houses.map((p) => `${p.house}宫${p.sign}${p.degreeInSign.toFixed(2)}°`).join('；');
    const aspects = chart.aspects.map((a) => `${names[a.first]}与${names[a.second]}${a.name}，偏差${a.deviation.toFixed(2)}°`).join('；') || '未命中所列相位';
    const patterns = chart.patterns.map((p) => `${p.label}（${p.members.map((m) => m.name).join('、')}）`).join('；') || '未见所列格局';
    return `${points}\n${formatAstroHouseSystem(chart.basis.houseSystem)}宫位制：${houses}\n相位：${aspects}\n星体格局：${patterns}\n星历警告：${chart.warnings.length ? JSON.stringify(chart.warnings) : '无'}。${chart.limitations.join('；')}`;
  })() : '';
  const qizheng = data.qizheng ? `${data.qizheng.stars.map((s) => `${s.name} 黄经${s.longitude.toFixed(4)}° ${s.xiu}宿${s.xiuDegree.toFixed(4)}° ${s.palace} ${s.dignity}${'retrograde' in s && s.retrograde ? ' 逆行' : ''}`).join('\n')}\n十二宫：${data.qizheng.twelvePalaces.map((p) => `${p.palace}${p.signBranch}`).join('、')}\n吊照：${data.qizheng.aspects.map((a) => `${a.star1}与${a.star2}${a.type}（偏差${a.orb}°）`).join('；') || '未命中所列相位'}\n神煞：${data.qizheng.shensha.stars.map((s) => `${s.name}${s.value}`).join('、')}。\n恩难仇用：${data.qizheng.enNan.sect}，命宫主宰星${data.qizheng.enNan.mingZhu}；恩${data.qizheng.enNan.enStars.join('、')}、难${data.qizheng.enNan.nanStars.join('、')}、仇${data.qizheng.enNan.chouStars.join('、')}、用${data.qizheng.enNan.yongStars.join('、')}。\n月相：${data.qizheng.moonPhase.eightPhaseName}，照明约${(data.qizheng.moonPhase.illuminationFraction * 100).toFixed(1)}%；太阳高度${data.qizheng.illumination.sun.geometricAltitudeDegrees.toFixed(2)}°。\n${data.qizheng.mansionModel.limitation}` : '';
  const solarUse = {
    bazi: '四柱日时按真太阳时，年月交节按真实瞬时确定。',
    ziwei: '紫微排盘使用校正后的钟表，晚子换日另依所选规则。',
    'bazi-ziwei': '四柱日时及紫微排盘使用校正钟表，四柱年月交节按真实瞬时确定。',
    astrolabe: '西洋星盘仍按真实瞬时计算，真太阳时仅作参考。',
    qizheng: '真太阳时用于命身宫时辰，星位仍按真实瞬时计算。',
  }[data.input.type];
  const digestLines = buildMethodSituationDigest('instant', data, question);
  const text = [`【${labels[data.input.type]}即时盘】\n起盘 UTC ${data.basis.utcDateTime}；${data.basis.clockSource === 'beijing' ? '北京时间' : '观测地民用时间'} ${data.basis.localDateTime} UTC${data.basis.timezone >= 0 ? '+' : ''}${data.basis.timezone}。${data.basis.trueSolarDateTime ? `真太阳时钟表 ${data.basis.trueSolarDateTime}；${solarUse}` : ''}`,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    pillars ? `【即时四柱】\n${pillars}\n【四柱条件证据】\n${baziEvidence}` : '', ziwei ? `【即时紫微】\n${ziwei}` : '', astro ? `【即时星位】\n${astro}` : '', qizheng ? `【即时七政星位】\n${qizheng}` : '',
    `【任务与限制】\n${data.limitation} 根据所列即时盘面与问题解释，区分事实与推论，不虚构未提供的个人资料。`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function instant(input: Input, currentTime: string) {
  const data = await calculateData(input, currentTime);
  return { data, summary: { title: `${labels[input.type]}即时盘`, lines: [data.basis.utcDateTime, '即时盘不代表个人出生盘'] }, prompt: render(data, input.question) };
}
export async function promptForSavedInstant(data: unknown, source: Source, question: string) {
  if (!source.at) throw new Error('即时盘结果缺少原始起盘时刻。');
  const expected = await calculateData(source, source.at);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('即时盘与起盘时刻或观测资料不一致。');
  return render(expected, question);
}
