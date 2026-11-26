import type { z } from 'zod';
import type { ziweiSynastryIndependentInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { calculateZiweiIndependentData, collectZiweiMajorStars, type ZiweiExactData } from './ziwei';
import { formatNatalFlying, formatScopeMutagens } from './ziwei-flying';
import { formatCrossFlying, locateCrossFlying } from './ziwei-cross-flying';
import { isLunarDateDiscrepancyWarning } from './birth-time';
import { dedupeExcerpts, formatClassicExcerpts, selectZiweiClassics } from './classics';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof ziweiSynastryIndependentInput>;
type Source = Pick<Input, 'person1' | 'person2' | 'relationship' | 'referenceTime' | 'syncYears' | 'compareCandidates' | 'comparisonPage' | 'prompt'>;
type PersonId = 'person1' | 'person2';
type Natal = ZiweiExactData['natal'];
const roles = {
  marriage: {
    label: '婚恋',
    task: '优先对照双方命宫、夫妻宫与福德宫的同支叠合与跨盘生年/飞星四化（禄权科忌流向），结合真实意愿、沟通和边界讨论合婚契合度与磨合重点，不预设必然结果。',
  },
  career: {
    label: '合作',
    task: '优先对照双方官禄宫、财帛宫、交友宫（奴仆宫）与迁移宫的跨盘叠合与化禄/化忌流向，结合职责分工、资源互补、决策权与退出机制讨论合伙共事，不保证商业收益。',
  },
  friendship: {
    label: '友情',
    task: '优先对照双方交友宫、福德宫与命宫叠合四化，结合相处方式、情绪支持与心理边界讨论友情搭档。',
  },
  children: {
    label: '亲子',
    task: '优先对照双方子女宫、田宅宫与命宫叠合四化，先确认双方亲子角色与成长阶段，再结合真实相处情况讨论沟通教养方式。',
  },
  parents: {
    label: '父母',
    task: '优先对照双方父母宫、疾厄宫与田宅宫叠合四化，先确认代际角色，再结合照护分担与家庭现实互动讨论。',
  },
  siblings: {
    label: '兄弟姐妹',
    task: '优先对照双方兄弟宫、田宅宫与财帛宫叠合四化，结合日常分工、责任界线与家庭背景分析。',
  },
} as const;
const schools = { sanhe: '三合：结合两盘同支宫位及各自三方四正核对。', feixing: '飞星：分别核对两人本命宫干四化，并按来源宫干将化星定位到对方本命盘；跨盘定位不等于本盘自化。', sihua: '四化：区分来源方的生年四化与对方同名星曜的实际落宫。', zhongzhou: '中州：兼看双方对宫借星、夹宫与双星组合的跨盘呼应。' } as const;
const stars = (palace: Natal['palaces'][number]) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const AUSPICIOUS_RELIEF_STARS = new Set(['禄存', '左辅', '右弼', '天魁', '天钺', '文昌', '文曲']);
const SELF_KEY_PALACES = new Set(['命', '夫妻', '财帛', '官禄', '福德', '田宅']);
const RELATION_FOCUS_PALACES: Record<keyof typeof roles, string[]> = {
  marriage: ['命', '夫妻', '福德'],
  career: ['命', '官禄', '财帛', '交友'],
  friendship: ['命', '交友', '福德'],
  children: ['命', '子女', '田宅'],
  parents: ['命', '父母', '田宅'],
  siblings: ['命', '兄弟', '田宅'],
};

function normalizeZiweiPalaceName(name: string): string {
  const bare = name.endsWith('宫') ? name.slice(0, -1) : name;
  return bare === '仆役' ? '交友' : bare;
}

export interface ZiweiSynastryJiModulation {
  direction: 'person1->person2' | 'person2->person1';
  sourceType: '宫干飞忌' | '生年化忌';
  sourcePalace: string;
  star: string;
  targetPalace: string;
  targetBranch: string;
  targetBody: boolean;
  status: '有缓解' | '无明解';
  reliefFactors: string[];
}

export interface ZiweiSynastryFlyingBalance {
  relationship: keyof typeof roles;
  luPattern: '双向互禄' | '单向付出（第一人→第二人）' | '单向付出（第二人→第一人）' | '未见核心宫位互禄';
  p1ToP2Lu: string[];
  p2ToP1Lu: string[];
  jiModulations: ZiweiSynastryJiModulation[];
  coreOverlays: string[];
}

export function buildZiweiSynastryFlyingBalance(
  first: Natal,
  second: Natal,
  relationship: keyof typeof roles,
  crossFlyingInput?: ReturnType<typeof locateCrossFlying>,
  crossMutagensInput?: ReturnType<typeof compatibility>['crossMutagens'],
): ZiweiSynastryFlyingBalance {
  const crossFlying = crossFlyingInput ?? locateCrossFlying(first, second);
  const crossMutagens = crossMutagensInput ?? compatibility(first, second).crossMutagens;
  const focusSet = new Set(RELATION_FOCUS_PALACES[relationship] ?? ['命', '夫妻']);
  const targetKeySet = new Set([...SELF_KEY_PALACES, ...focusSet]);
  const natals: Record<PersonId, Natal> = { person1: first, person2: second };

  const isSourceFocus = (palaceName: string, person: PersonId) => {
    const norm = normalizeZiweiPalaceName(palaceName);
    if (focusSet.has(norm)) return true;
    const palace = natals[person].palaces.find((p) => normalizeZiweiPalaceName(p.name) === norm);
    return Boolean(palace?.isBodyPalace);
  };

  const isTargetKey = (palaceName: string, isBody: boolean) =>
    isBody || targetKeySet.has(normalizeZiweiPalaceName(palaceName));

  // 1. 双向飞禄与生年化禄统计（核心来源宫 -> 对方关键宫）
  const p1ToP2Lu: string[] = [];
  const p2ToP1Lu: string[] = [];

  for (const path of crossFlying.paths) {
    if (path.mutagen !== '禄') continue;
    if (!isSourceFocus(path.sourcePalace, path.sourcePerson) || !isTargetKey(path.targetPalace, path.targetBody)) continue;
    const label = `${path.sourcePalace}飞禄(${path.star})→${path.targetPalace}${path.targetBody ? '(身)' : ''}`;
    if (path.sourcePerson === 'person1') p1ToP2Lu.push(label);
    else p2ToP1Lu.push(label);
  }
  for (const item of crossMutagens) {
    if (item.mutagen !== '禄') continue;
    if (!isTargetKey(item.targetPalace, item.targetBody)) continue;
    const label = `生年化禄(${item.star})入${item.targetPalace}${item.targetBody ? '(身)' : ''}`;
    if (item.sourcePerson === 'person1') p1ToP2Lu.push(label);
    else p2ToP1Lu.push(label);
  }

  const luPattern: ZiweiSynastryFlyingBalance['luPattern'] =
    p1ToP2Lu.length > 0 && p2ToP1Lu.length > 0
      ? '双向互禄'
      : p1ToP2Lu.length > 0
        ? '单向付出（第一人→第二人）'
        : p2ToP1Lu.length > 0
          ? '单向付出（第二人→第一人）'
          : '未见核心宫位互禄';

  // 2. 飞忌/生年忌落入关键宫位时的缓解核查（飞禄/飞科/本命吉星吉化）
  const findTargetPalaceRelief = (targetPerson: PersonId, targetPalaceName: string, targetBranch: string): string[] => {
    const factors: string[] = [];
    const targetNorm = normalizeZiweiPalaceName(targetPalaceName);

    // 跨盘飞禄/飞科落入同一目标宫位
    for (const p of crossFlying.paths) {
      if (
        p.targetPerson === targetPerson &&
        (p.mutagen === '禄' || p.mutagen === '科') &&
        p.targetBranch === targetBranch &&
        isSourceFocus(p.sourcePalace, p.sourcePerson)
      ) {
        factors.push(`对方${p.sourcePalace}飞${p.mutagen}(${p.star})同宫缓解`);
      }
    }
    // 跨盘生年化禄/化科落入同一目标宫位
    for (const m of crossMutagens) {
      if (
        m.targetPerson === targetPerson &&
        (m.mutagen === '禄' || m.mutagen === '科') &&
        m.targetEarthlyBranch === targetBranch
      ) {
        factors.push(`对方生年化${m.mutagen}(${m.star})同宫缓解`);
      }
    }
    // 目标宫位本命吉星/吉化
    const palace = natals[targetPerson].palaces.find(
      (p) => p.earthlyBranch === targetBranch || normalizeZiweiPalaceName(p.name) === targetNorm,
    );
    if (palace) {
      const allStars = stars(palace);
      const natalGoodMutagens = allStars
        .filter((s) => s.mutagen === '禄' || s.mutagen === '权' || s.mutagen === '科')
        .map((s) => `本命${s.name}化${s.mutagen}`);
      const natalGoodStars = allStars
        .filter((s) => AUSPICIOUS_RELIEF_STARS.has(s.name))
        .map((s) => `本命${s.name}`);
      factors.push(...natalGoodMutagens, ...natalGoodStars);
    }

    return [...new Set(factors)];
  };

  const jiModulations: ZiweiSynastryJiModulation[] = [];
  const seenJi = new Set<string>();

  for (const path of crossFlying.paths) {
    if (path.mutagen !== '忌') continue;
    if (!isSourceFocus(path.sourcePalace, path.sourcePerson) || !isTargetKey(path.targetPalace, path.targetBody)) continue;
    const key = `fly:${path.sourcePerson}:${path.sourcePalace}:${path.star}:${path.targetBranch}`;
    if (seenJi.has(key)) continue;
    seenJi.add(key);
    const reliefFactors = findTargetPalaceRelief(path.targetPerson, path.targetPalace, path.targetBranch);
    jiModulations.push({
      direction: path.sourcePerson === 'person1' ? 'person1->person2' : 'person2->person1',
      sourceType: '宫干飞忌',
      sourcePalace: path.sourcePalace,
      star: path.star,
      targetPalace: path.targetPalace,
      targetBranch: path.targetBranch,
      targetBody: path.targetBody,
      status: reliefFactors.length > 0 ? '有缓解' : '无明解',
      reliefFactors,
    });
  }

  for (const item of crossMutagens) {
    if (item.mutagen !== '忌') continue;
    if (!isTargetKey(item.targetPalace, item.targetBody)) continue;
    const key = `birth:${item.sourcePerson}:${item.star}:${item.targetEarthlyBranch}`;
    if (seenJi.has(key)) continue;
    seenJi.add(key);
    const reliefFactors = findTargetPalaceRelief(item.targetPerson, item.targetPalace, item.targetEarthlyBranch);
    jiModulations.push({
      direction: item.sourcePerson === 'person1' ? 'person1->person2' : 'person2->person1',
      sourceType: '生年化忌',
      sourcePalace: item.sourcePalace,
      star: item.star,
      targetPalace: item.targetPalace,
      targetBranch: item.targetEarthlyBranch,
      targetBody: item.targetBody,
      status: reliefFactors.length > 0 ? '有缓解' : '无明解',
      reliefFactors,
    });
  }

  // 3. 关系核心宫位同支叠合呼应
  const byBranchSecond = new Map(second.palaces.map((p) => [p.earthlyBranch, p]));
  const coreOverlays: string[] = [];
  for (const p1 of first.palaces) {
    const p2 = byBranchSecond.get(p1.earthlyBranch);
    if (!p2) continue;
    const hit1 = focusSet.has(normalizeZiweiPalaceName(p1.name)) || p1.isBodyPalace;
    const hit2 = focusSet.has(normalizeZiweiPalaceName(p2.name)) || p2.isBodyPalace;
    if (!hit1 && !hit2) continue;
    const s1 = p1.majorStars.map((s) => s.name).join('、') || '空宫';
    const s2 = p2.majorStars.map((s) => s.name).join('、') || '空宫';
    coreOverlays.push(
      `第一人${p1.name}${p1.isBodyPalace ? '(身)' : ''}（${s1}）叠第二人${p2.name}${p2.isBodyPalace ? '(身)' : ''}（${s2}）于${p1.earthlyBranch}宫`,
    );
  }

  return {
    relationship,
    luPattern,
    p1ToP2Lu,
    p2ToP1Lu,
    jiModulations,
    coreOverlays,
  };
}

function formatZiweiSynastryFlyingBalance(balance: ZiweiSynastryFlyingBalance, people: Record<PersonId, string>): string {
  const replaceNames = (text: string) =>
    text.replace(/第一人/g, people.person1).replace(/第二人/g, people.person2);
  const luLine = `- 互禄与付出方向：${replaceNames(balance.luPattern)}；${people.person1}→${people.person2}：${balance.p1ToP2Lu.slice(0, 4).join('、') || '无核心宫位飞禄'}；${people.person2}→${people.person1}：${balance.p2ToP1Lu.slice(0, 4).join('、') || '无核心宫位飞禄'}。`;

  const jiLines = balance.jiModulations.length
    ? balance.jiModulations.slice(0, 8).map((item) => {
        const from = item.direction === 'person1->person2' ? people.person1 : people.person2;
        const to = item.direction === 'person1->person2' ? people.person2 : people.person1;
        const relief = item.reliefFactors.length
          ? `［${item.status}：${item.reliefFactors.slice(0, 4).join('、')}］`
          : `［${item.status}：未见同宫飞禄/飞科或本命吉星吉化缓冲］`;
        return `${from}${item.sourcePalace}${item.sourceType}(${item.star})→${to}${item.targetPalace}${item.targetBody ? '(身)' : ''}(${item.targetBranch})${relief}`;
      })
    : ['未检出核心宫位飞忌或生年化忌直入对方关键宫位'];

  const overlayLine = `- 核心宫位叠合：${balance.coreOverlays.slice(0, 6).map(replaceNames).join('；') || '无'}。`;
  return [luLine, `- 飞忌冲击与缓解制衡：${jiLines.join('；')}。`, overlayLine].join('\n');
}

function direction(from: PersonId, to: PersonId, source: Natal, target: Natal) {
  const byBranch = new Map(target.palaces.map((palace) => [palace.earthlyBranch, palace]));
  if (source.palaces.length !== 12 || byBranch.size !== 12 || new Set(source.palaces.map((palace) => palace.earthlyBranch)).size !== 12) throw new Error('紫微双盘须各有十二个不同地支宫位。');
  const overlays = source.palaces.map((palace) => {
    const match = byBranch.get(palace.earthlyBranch);
    if (!match) throw new Error('紫微双盘缺少相同地支宫位。');
    return { kind: 'palace-overlay' as const, sourcePerson: from, targetPerson: to, sourcePalace: palace.name, sourceBody: palace.isBodyPalace,
      earthlyBranch: palace.earthlyBranch, targetPalace: match.name, targetBody: match.isBodyPalace,
      sourceMajorStars: palace.majorStars.map((star) => star.name), targetMajorStars: match.majorStars.map((star) => star.name) };
  });
  const targetStars = new Map<string, Natal['palaces']>();
  for (const palace of target.palaces) for (const star of stars(palace)) {
    const matches = targetStars.get(star.name) ?? [];
    if (!matches.some((item) => item.index === palace.index)) matches.push(palace);
    targetStars.set(star.name, matches);
  }
  const placements = [], gaps = [];
  for (const palace of source.palaces) for (const star of stars(palace)) {
    if (!star.mutagen) continue;
    const matches = targetStars.get(star.name) ?? [];
    const common = { sourcePerson: from, targetPerson: to, star: star.name, mutagen: star.mutagen, sourcePalace: palace.name, sourceBody: palace.isBodyPalace };
    if (matches.length === 1) {
      const match = matches[0];
      placements.push({ kind: 'cross-mutagen' as const, ...common, targetPalace: match.name, targetBody: match.isBodyPalace, targetEarthlyBranch: match.earthlyBranch });
    } else gaps.push({ kind: 'cross-mutagen-gap' as const, ...common, reason: matches.length ? '目标盘同名星曜落宫不唯一' : '目标盘缺少同名星曜', candidatePalaces: matches.map((match) => `${match.name}（${match.earthlyBranch}）`) });
  }
  return { overlays, placements, gaps };
}
function compatibility(first: Natal, second: Natal) {
  const a = direction('person1', 'person2', first, second), b = direction('person2', 'person1', second, first);
  return { overlays: [...a.overlays, ...b.overlays], crossMutagens: [...a.placements, ...b.placements], gaps: [...a.gaps, ...b.gaps],
    limitation: '同支叠宫仅表示宫位对应；跨盘四化只表示同名星曜定位，不证明关系吉凶、意愿、事件结果或应期。' };
}
type Evidence = ReturnType<typeof compatibility>;
type Fact = Evidence['overlays'][number] | Evidence['crossMutagens'][number] | Evidence['gaps'][number];
type Variant = { index: number | null; chart: ZiweiExactData };
function aggregate(first: Variant[], second: Variant[], page?: Input['comparisonPage']) {
  const total = first.length * second.length;
  if (total > 1024) throw new Error('出生候选组合超过 1024 组，请缩小出生时段。');
  const facts = new Map<string, { fact: Fact; count: number; example: { person1Index: number | null; person2Index: number | null } }>();
  for (const a of first) for (const b of second) {
    const evidence = compatibility(a.chart.natal, b.chart.natal), seen = new Set<string>();
    for (const fact of [...evidence.overlays, ...evidence.crossMutagens, ...evidence.gaps]) {
      const key = JSON.stringify(fact);
      if (seen.has(key)) continue;
      seen.add(key);
      const item = facts.get(key);
      if (item) item.count++; else facts.set(key, { fact, count: 1, example: { person1Index: a.index, person2Index: b.index } });
    }
  }
  const all = [...facts.values()], variable = all.filter((item) => item.count < total), offset = page?.offset ?? 0, limit = page?.limit ?? 100;
  if (offset > 0 && offset >= variable.length) throw new Error('候选变化事实分页偏移超出范围。');
  return { person1Candidates: first.length, person2Candidates: second.length, total, common: all.filter((item) => item.count === total), variable: variable.slice(offset, offset + limit),
    variableTotal: variable.length, page: { offset, limit, nextOffset: offset + limit < variable.length ? offset + limit : null },
    limitation: '组合仅列可能性；候选时长可能不同，组合出现次数不代表概率或现实关系结论。' };
}
function buildPersonHoroscope(chart: ZiweiExactData) {
  const ref = chart.reference;
  if (!ref) throw new Error('紫微双盘缺少参考时刻运限数据。');
  const summarize = (scope: 'decadal' | 'yearly') => {
    const layer = ref.layers[scope];
    return {
      index: layer.index,
      heavenlyStem: layer.heavenlyStem,
      earthlyBranch: layer.earthlyBranch,
      natalPalace: chart.natal.palaces[layer.index]?.name ?? '',
      palaceNames: layer.palaceNames,
      mutagen: layer.mutagen,
      mutagenPlacements: layer.mutagenPlacements,
    };
  };
  return {
    localDateTime: ref.localDateTime,
    timezone: ref.timezone,
    decadal: summarize('decadal'),
    yearly: summarize('yearly'),
  };
}

async function calculateData(input: Source) {
  const source = { person1: input.person1, person2: input.person2, relationship: input.relationship ?? 'marriage' as const,
    ...(input.referenceTime ? { referenceTime: input.referenceTime } : {}),
    ...(input.syncYears ? { syncYears: input.syncYears } : {}),
    ...(input.compareCandidates !== undefined ? { compareCandidates: input.compareCandidates } : {}), ...(input.comparisonPage ? { comparisonPage: input.comparisonPage } : {}), ...(input.prompt ? { prompt: input.prompt } : {}) };
  const person = async (value: Input['person1']) => {
    const data = await calculateZiweiIndependentData({ birth: value.birth, gender: value.gender, rules: value.rules, referenceTime: input.referenceTime });
    const variants: Variant[] = 'unknown' in data ? data.unknown.candidates.map((item, index) => ({ index, chart: item.chart })) : [{ index: null, chart: data }];
    if (value.candidateIndex !== undefined && !variants[value.candidateIndex]) throw new Error(`紫微出生候选索引超出范围：共有 ${variants.length} 项。`);
    const chosen = 'unknown' in data ? (value.candidateIndex === undefined ? null : variants[value.candidateIndex]) : variants[0];
    return { data, variants, chosen };
  };
  const first = await person(source.person1), second = await person(source.person2);
  const shouldCompare = input.compareCandidates ?? (!!input.comparisonPage || !first.chosen || !second.chosen);
  if (!shouldCompare && (!first.chosen || !second.chosen)) throw new Error('不比较全部候选时，须为出生时间不确定者指定候选。');
  const selected = first.chosen && second.chosen ? (() => {
    const baseEvidence = compatibility(first.chosen.chart.natal, second.chosen.chart.natal);
    const crossFlyingAll = locateCrossFlying(first.chosen.chart.natal, second.chosen.chart.natal);
    const flyingBalance = buildZiweiSynastryFlyingBalance(
      first.chosen.chart.natal,
      second.chosen.chart.natal,
      source.relationship,
      crossFlyingAll,
      baseEvidence.crossMutagens,
    );
    return {
      person1Index: first.chosen.index,
      person2Index: second.chosen.index,
      natal: { person1: first.chosen.chart.natal, person2: second.chosen.chart.natal },
      evidence: {
        ...baseEvidence,
        flyingBalance,
        ...(input.prompt?.schools?.includes('feixing') ? { crossFlying: crossFlyingAll } : {}),
      },
    };
  })() : null;
  const horoscopeComparison = selected && input.referenceTime ? {
    referenceTime: input.referenceTime,
    person1: buildPersonHoroscope(first.chosen!.chart),
    person2: buildPersonHoroscope(second.chosen!.chart),
    limitation: '运限合参仅列双方大限与流年宫位及四化定位，不代表事件应期或关系结果。',
  } : null;
  const annualSync = selected && input.syncYears ? await (async () => {
    const pickVariant = (data: Awaited<ReturnType<typeof calculateZiweiIndependentData>>, index: number | null) =>
      'unknown' in data ? data.unknown.candidates[index!]!.chart : data;
    const years = await Promise.all(
      Array.from({ length: input.syncYears!.endYear - input.syncYears!.startYear + 1 }, async (_, i) => {
        const year = input.syncYears!.startYear + i;
        const refIso = new Date(Date.UTC(year, 5, 15, 4, 0, 0)).toISOString();
        const [d1, d2] = await Promise.all([
          calculateZiweiIndependentData({ birth: source.person1.birth, gender: source.person1.gender, rules: source.person1.rules, referenceTime: refIso }),
          calculateZiweiIndependentData({ birth: source.person2.birth, gender: source.person2.gender, rules: source.person2.rules, referenceTime: refIso }),
        ]);
        const h1 = buildPersonHoroscope(pickVariant(d1, selected.person1Index));
        const h2 = buildPersonHoroscope(pickVariant(d2, selected.person2Index));
        const p1YearlyOnP2 = selected.natal.person2.palaces.find((p) => p.earthlyBranch === h1.yearly.earthlyBranch)?.name ?? '';
        const p2YearlyOnP1 = selected.natal.person1.palaces.find((p) => p.earthlyBranch === h2.yearly.earthlyBranch)?.name ?? '';
        return {
          year,
          person1: { decadal: `${h1.decadal.heavenlyStem}${h1.decadal.earthlyBranch}(${h1.decadal.natalPalace})`, yearly: `${h1.yearly.heavenlyStem}${h1.yearly.earthlyBranch}(${h1.yearly.natalPalace})`, yearlyMutagen: h1.yearly.mutagen },
          person2: { decadal: `${h2.decadal.heavenlyStem}${h2.decadal.earthlyBranch}(${h2.decadal.natalPalace})`, yearly: `${h2.yearly.heavenlyStem}${h2.yearly.earthlyBranch}(${h2.yearly.natalPalace})`, yearlyMutagen: h2.yearly.mutagen },
          yearlyOverlap: {
            sameBranch: h1.yearly.earthlyBranch === h2.yearly.earthlyBranch,
            person1YearlyOnPerson2Palace: p1YearlyOnP2,
            person2YearlyOnPerson1Palace: p2YearlyOnP1,
          },
        };
      }),
    );
    return {
      startYear: input.syncYears!.startYear,
      endYear: input.syncYears!.endYear,
      years,
      limitation: '多年流年同步按公历年中定位双方大限与流年宫位及四化，不代表固定日期或必然结果。',
    };
  })() : undefined;
  const compact = (data: typeof first.data) => 'unknown' in data ? { input: data.input, unknown: { source: data.unknown.source, possible: data.unknown.possible, limitation: data.unknown.limitation,
    candidates: data.unknown.candidates.map(({ chart, ...segment }) => ({ ...segment, soulBranch: chart.natal.soulBranch, bodyBranch: chart.natal.bodyBranch, fiveElementsClass: chart.natal.fiveElementsClass })) } } : data;
  const horoscopeNote = horoscopeComparison ? '运限合参仅含大限与流年，完整专业证据尚未迁移。' : '运限合参与完整专业证据尚未迁移。';
  const calendarWarnings = [...new Set([...first.variants, ...second.variants].flatMap((item) => item.chart.limitations).filter(isLunarDateDiscrepancyWarning))];
  return { input: source, charts: { person1: compact(first.data), person2: compact(second.data) }, selected,
    ...(horoscopeComparison ? { horoscopeComparison } : {}),
    ...(annualSync ? { annualSync } : {}),
    comparison: shouldCompare ? aggregate(first.variants, second.variants, input.comparisonPage) : null,
    limitation: `独立紫微双盘提供双方各自本命宫干四化、宫位叠合、生年四化及选定双盘的宫干化星跨盘定位；全部候选比较不汇总宫干飞化。不确定出生仅返回候选摘要，完整候选盘可通过独立紫微单盘获取。${horoscopeNote}${calendarWarnings.length ? `\n${calendarWarnings.join('\n')}` : ''}` };
}
type Data = Awaited<ReturnType<typeof calculateData>>;
function render(data: Data, question: string, options?: Input['prompt']) {
  const people = { person1: data.input.person1.name ?? '第一人', person2: data.input.person2.name ?? '第二人' };
  const factText = (fact: Fact) => {
    const from = people[fact.sourcePerson], to = people[fact.targetPerson], body = fact.sourceBody ? '（身宫同宫）' : '';
    if (fact.kind === 'palace-overlay') return `${from}${fact.sourcePalace}${body}与${to}${fact.targetPalace}${fact.targetBody ? '（身宫同宫）' : ''}同处${fact.earthlyBranch}支；双方主星分别为${fact.sourceMajorStars.join('、') || '无'} / ${fact.targetMajorStars.join('、') || '无'}`;
    if (fact.kind === 'cross-mutagen') return `${from}${fact.sourcePalace}${body}的${fact.star}生年化${fact.mutagen}；同名星在${to}${fact.targetPalace}${fact.targetBody ? '（身宫同宫）' : ''}（${fact.targetEarthlyBranch}）`;
    return `${from}${fact.sourcePalace}${body}的${fact.star}化${fact.mutagen}：${fact.reason}${fact.candidatePalaces.length ? `（${fact.candidatePalaces.join('、')}）` : ''}`;
  };
  const selected = data.selected;
  const chosenHeader = selected
    ? `${people.person1}：命宫${selected.natal.person1.soulBranch}、身宫${selected.natal.person1.bodyBranch}、命主${selected.natal.person1.soul}、身主${selected.natal.person1.body}、${selected.natal.person1.fiveElementsClass}；${people.person2}：命宫${selected.natal.person2.soulBranch}、身宫${selected.natal.person2.bodyBranch}、命主${selected.natal.person2.soul}、身主${selected.natal.person2.body}、${selected.natal.person2.fiveElementsClass}。`
    : '';
  const chosen = selected ? `【所选双盘】\n候选索引 ${selected.person1Index ?? '精确'} / ${selected.person2Index ?? '精确'}；若为时段候选，仅代表各自所选时段。\n${chosenHeader}\n【同支宫位】\n${selected.evidence.overlays.filter((item) => item.sourcePerson === 'person1').map(factText).join('\n')}\n【跨盘生年四化】\n${selected.evidence.crossMutagens.map(factText).join('\n') || '未形成可定位的跨盘四化。'}\n【双方各自本命宫干四化】\n${people.person1}：\n${formatNatalFlying(selected.natal.person1.palaces)}\n${people.person2}：\n${formatNatalFlying(selected.natal.person2.palaces)}\n【定位缺口】\n${selected.evidence.gaps.map(factText).join('\n') || '未见缺口。'}` : '';
  const crossFlying = options?.schools?.includes('feixing')
    ? selected ? `【宫干化星跨盘定位】\n按来源宫干四化表，在对方本命盘查找同名星曜；不判断跨盘自化，也不计算运限。\n${formatCrossFlying(selected.evidence.crossFlying ?? locateCrossFlying(selected.natal.person1, selected.natal.person2), people)}`
      : '【宫干化星跨盘定位】\n尚未选定双方出生候选；全部候选比较不汇总此项，选定双方候选后可查看。'
    : '';
  const formatHoroscopePerson = (label: string, h: ReturnType<typeof buildPersonHoroscope>) =>
    `${label}（当地 ${h.localDateTime}，UTC${h.timezone >= 0 ? '+' : ''}${h.timezone}）：\n`
    + `  大限：${h.decadal.heavenlyStem}${h.decadal.earthlyBranch}（本命${h.decadal.natalPalace}），四化禄权科忌依序为${h.decadal.mutagen.join('、')}；${formatScopeMutagens(h.decadal.mutagenPlacements)}\n`
    + `  流年：${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}（本命${h.yearly.natalPalace}），四化禄权科忌依序为${h.yearly.mutagen.join('、')}；${formatScopeMutagens(h.yearly.mutagenPlacements)}`;
  const horoscopeText = data.horoscopeComparison
    ? `【运限合参】\n参考时刻 ${data.horoscopeComparison.referenceTime}\n${formatHoroscopePerson(people.person1, data.horoscopeComparison.person1)}\n${formatHoroscopePerson(people.person2, data.horoscopeComparison.person2)}\n${data.horoscopeComparison.limitation}`
    : data.input.referenceTime
      ? '【运限合参】\n尚未选定双方出生候选；全部候选比较不汇总运限合参，选定双方候选后可查看。'
      : '';
  const comparison = data.comparison;
  const factLine = (item: NonNullable<typeof comparison>['common'][number]) => `${factText(item.fact)}（${item.count}/${comparison!.total} 组；示例候选 ${item.example.person1Index ?? '精确'} / ${item.example.person2Index ?? '精确'}）`;
  const variable = comparison && options?.detailMode !== 'full' ? comparison.variable.slice(0, 30) : comparison?.variable;
  const comparing = comparison ? `【全部出生候选比较】\n${people.person1} ${comparison.person1Candidates} 段、${people.person2} ${comparison.person2Candidates} 段，共 ${comparison.total} 组。\n每组共同事实：\n${comparison.common.map(factLine).join('\n') || '无'}\n部分组合事实（当前页 ${comparison.variable.length} / 全部 ${comparison.variableTotal} 项，偏移 ${comparison.page.offset}）：\n${variable!.map(factLine).join('\n') || '无'}${comparison.variable.length > variable!.length ? `\n本页另有 ${comparison.variable.length - variable!.length} 项见结构化结果，可用 detailMode=full 列出本页。` : ''}${comparison.page.nextOffset === null ? '' : `\n下一页 comparisonPage.offset=${comparison.page.nextOffset}。`}\n${comparison.limitation}` : '';
  const task = roles[data.input.relationship];
  const situationLines = buildMethodSituationDigest('ziwei-synastry', data, question);
  const schoolText = options?.schools?.map((school) => schools[school]).join('\n');
  const classics = options?.includeClassics
    ? (() => {
        const starLists = selected
          ? [collectZiweiMajorStars(selected.natal.person1.palaces), collectZiweiMajorStars(selected.natal.person2.palaces)]
          : [
              ...(['person1', 'person2'] as const)
                .map((id) => ('natal' in data.charts[id] ? collectZiweiMajorStars(data.charts[id].natal.palaces) : [])),
              ...(data.comparison
                ? [...data.comparison.common, ...data.comparison.variable]
                    .map((item) => item.fact)
                    .filter((fact): fact is Extract<Fact, { kind: 'palace-overlay' }> => fact.kind === 'palace-overlay')
                    .map((fact) => [
                      ...(fact.sourcePalace === '命宫' || fact.sourceBody ? fact.sourceMajorStars : []),
                      ...(fact.targetPalace === '命宫' || fact.targetBody ? fact.targetMajorStars : []),
                    ])
                : []),
            ];
        return formatClassicExcerpts(dedupeExcerpts(starLists.flatMap((stars) => selectZiweiClassics(stars))), '典籍片段');
      })()
    : '';
  const syncText = data.annualSync
    ? [
        `【多年大限与流年同步（${data.annualSync.startYear}–${data.annualSync.endYear}）】`,
        ...data.annualSync.years.map((item) =>
          `${item.year}年：${people.person1}[大限${item.person1.decadal}，流年${item.person1.yearly}，四化${item.person1.yearlyMutagen.join('、')}]；${people.person2}[大限${item.person2.decadal}，流年${item.person2.yearly}，四化${item.person2.yearlyMutagen.join('、')}]；互落宫：${people.person1}流年入${people.person2}本命${item.yearlyOverlap.person1YearlyOnPerson2Palace}，${people.person2}流年入${people.person1}本命${item.yearlyOverlap.person2YearlyOnPerson1Palace}${item.yearlyOverlap.sameBranch ? '（流年同支叠合）' : ''}。`,
        ),
        data.annualSync.limitation,
      ].join('\n')
    : data.input.syncYears
      ? '【多年大限与流年同步】\n尚未选定双方出生候选；选定双方候选后可查看。'
      : '';
  const flyingBalanceText = selected
    ? `【双向飞化与宫位制衡关系】\n${formatZiweiSynastryFlyingBalance(selected.evidence.flyingBalance, people)}`
    : '';
  const g1 = data.input.person1.gender === 'male' ? '（男）' : data.input.person1.gender === 'female' ? '（女）' : '';
  const g2 = data.input.person2.gender === 'male' ? '（男）' : data.input.person2.gender === 'female' ? '（女）' : '';
  const text = [`【紫微双人合盘】\n${people.person1}${g1}与${people.person2}${g2}；双方候选区间及摘要见结构化结果，选定双盘时包含各自本命盘。`,
    situationLines.length ? `【局势要点】\n${situationLines.join('\n')}` : '',
    chosen, flyingBalanceText, crossFlying, horoscopeText, syncText, comparing,
    schoolText ? `【解读口径】\n${schoolText}` : '', classics,
    `【${task.label}任务】\n${task.task} 区分盘面定位、传统取象和现实资料；资料缺项时按已列双盘事实作条件说明。`,
    `【限制】\n${data.limitation}\n同支宫位与跨盘四化不代表关系结果；未命中也不代表有利或不利。`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function ziweiSynastryIndependent(input: Input) {
  const data = await calculateData(input);
  return { data, summary: { title: '紫微双人合盘', lines: [data.selected ? `已选择双盘：${data.selected.evidence.overlays.length} 条宫位叠合` : '出生候选尚未确定', ...(data.comparison ? [`候选组合：${data.comparison.total}`] : [])] }, prompt: render(data, input.question, input.prompt) };
}
export async function promptForSavedZiweiSynastryIndependent(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = await calculateData(source);
  if (!sameJsonValue(data, expected)) throw new Error('紫微双盘与双方出生资料不一致。');
  return render(expected, question, options ?? source.prompt);
}
