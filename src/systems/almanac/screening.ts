import type { participantProfile } from './participants';
import { getBranchWuxing, getStemWuxing } from '../ganzhi-foundation';

type Participant = Awaited<ReturnType<typeof participantProfile>>;
type Match = { support: string[]; caution: string[]; restriction: string | null };
type Reason = { source: '事项忌项' | '通用限制' | '参与人关系' | '四离四绝' | '交节' | '事项未明确列宜' | '时段限制'; text: string; strength: '明确限制' | '条件提示' };

/** 本次已迁移依据的初筛，结果不等于完整择日结论。 */
export function screenAlmanac(match: Match, branch: string, participants: Participant[], options: { scope: 'day' | 'hour'; special?: string[]; boundary?: string; noUsableHours?: boolean }) {
  const reasons: Reason[] = [];
  if (match.caution.length) reasons.push({ source: '事项忌项', text: `原始忌项命中：${match.caution.join('、')}`, strength: '明确限制' });
  if (match.restriction) reasons.push({ source: '通用限制', text: match.restriction, strength: '明确限制' });
  for (const text of options.special ?? []) reasons.push({ source: '四离四绝', text, strength: '明确限制' });
  if (options.boundary) reasons.push({ source: '交节', text: options.boundary, strength: '条件提示' });
  if (options.scope === 'day' && !match.support.length) reasons.push({ source: '事项未明确列宜', text: '原始宜项未命中当前事项，结合具体活动场景酌情取用', strength: '条件提示' });
  if (options.noUsableHours) reasons.push({ source: '时段限制', text: '所选时间范围内未筛出没有明确限制的时辰', strength: '条件提示' });
  for (const person of participants) {
    const record = person.relationsByBranch.find((item) => item.candidateBranch === branch);
    if (!record) throw new Error('参与人关系缺少候选地支。');
    const conflictSets = record.outcomes.map((outcome) => new Set(outcome.conflicts.map((conflict) => `${conflict.scope === 'year' ? '年支' : '日支'}${conflict.targetBranch}${conflict.type}${'detail' in conflict ? `（${conflict.detail}）` : ''}`)));
    const union = [...new Set(conflictSets.flatMap((set) => [...set]))];
    const common = union.filter((item) => conflictSets.every((set) => set.has(item)));
    const conditional = union.filter((item) => !common.includes(item));
    if (common.length) reasons.push({ source: '参与人关系', text: `${person.name}：候选${options.scope === 'day' ? '日' : '时'}支${branch}与${common.join('、')}`, strength: '明确限制' });
    if (conditional.length) reasons.push({ source: '参与人关系', text: `${person.name}：出生时段未定时，候选${options.scope === 'day' ? '日' : '时'}支${branch}可能与${conditional.join('、')}（仅部分出生候选触发）`, strength: '条件提示' });
  }
  return { status: reasons.some((reason) => reason.strength === '明确限制') ? '有明确限制' as const : reasons.length ? '需要核对' as const : '未见已列限制' as const,
    reasons, limitation: '仅按已列规则初筛，不等于完整择日、现实适宜或成功率。' };
}

const MAJOR_AUSPICIOUS_GODS = new Set(['天德', '月德', '天德合', '月德合', '天赦', '天愿', '岁德', '岁德合', '三合', '六合', '母仓', '五富', '天喜', '益后', '续世']);
const MAJOR_TABOO_GODS = new Set(['岁破', '月破', '大耗', '四离', '四绝', '受死', '往亡', '十恶大败', '杨公忌', '三娘煞', '五墓', '天吏', '致死']);
const HUANGDAO_STARS = new Set(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);
const FAVORABLE_OFFICERS = new Set(['成', '开', '定', '满']);
const CAUTION_OFFICERS = new Set(['破', '闭']);

export interface BaziElementMatch {
  stemElement: string;
  branchElement: string;
  scoreDelta: number;
  participants: Array<{
    name: string;
    favorableHits: string[];
    unfavorableHits: string[];
  }>;
  summary: string;
}

/** 比对候选日柱或时柱干支五行与精确出生参与人八字喜用/避忌五行的契合度。 */
export function evaluateBaziElementMatch(ganzhi: string, participants: readonly Participant[]): BaziElementMatch | undefined {
  const withBazi = participants.filter((p) => p.baziUsefulGod);
  if (!withBazi.length || ganzhi.length < 2) return undefined;
  const stemElement = getStemWuxing(ganzhi[0]);
  const branchElement = getBranchWuxing(ganzhi[1]);
  let scoreDelta = 0;
  const matched = withBazi.map((person) => {
    const ug = person.baziUsefulGod!;
    const favorableHits: string[] = [];
    const unfavorableHits: string[] = [];
    if (ug.favorable.includes(stemElement)) {
      favorableHits.push(`干${ganzhi[0]}(${stemElement})喜用`);
      scoreDelta += 4;
    } else if (ug.primaryUnfavorable.includes(stemElement) || ug.unfavorable.includes(stemElement)) {
      unfavorableHits.push(`干${ganzhi[0]}(${stemElement})忌神`);
      scoreDelta -= ug.primaryUnfavorable.includes(stemElement) ? 5 : 3;
    }
    if (ug.favorable.includes(branchElement)) {
      favorableHits.push(`支${ganzhi[1]}(${branchElement})喜用`);
      scoreDelta += 5;
    } else if (ug.primaryUnfavorable.includes(branchElement) || ug.unfavorable.includes(branchElement)) {
      unfavorableHits.push(`支${ganzhi[1]}(${branchElement})忌神`);
      scoreDelta -= ug.primaryUnfavorable.includes(branchElement) ? 6 : 3;
    }
    return { name: person.name, favorableHits, unfavorableHits };
  });
  const summaryParts = matched
    .map((m) => {
      const items = [...m.favorableHits, ...m.unfavorableHits];
      return items.length ? `${m.name}:${items.join('、')}` : '';
    })
    .filter(Boolean);
  return {
    stemElement,
    branchElement,
    scoreDelta,
    participants: matched,
    summary: summaryParts.join('；') || '干支五行未触及喜忌',
  };
}

export interface DayForRecommendation {
  date: string;
  weekday: string;
  lunarDate: string;
  dayOfficer: string;
  twelveStar: string;
  traditionalFacts: { twentyEightStar: { name: string; luck: string } };
  match: Match;
  gods: Array<{ name: string; luck: string }>;
  screening: ReturnType<typeof screenAlmanac>;
  baziMatch?: BaziElementMatch;
  preference: { isWeekend: boolean; matchesWeekend: boolean };
  hours: Array<{
    name: string;
    range: string;
    ganzhi: string;
    twelveStar: string;
    match: Match;
    screening: ReturnType<typeof screenAlmanac>;
    baziMatch?: BaziElementMatch;
    preference: { withinWorkHours: boolean; preferredTime: boolean };
  }>;
}

/** 结合建除十二神、黄黑道、核心吉凶神煞、二十八宿、参与人初筛及可选八字喜忌生成结构化择日分级与吉时推荐。 */
export function buildAlmanacRecommendations(days: readonly DayForRecommendation[]) {
  const evaluated = days.map((day) => {
    const keyAuspiciousGods = day.gods.filter((g) => MAJOR_AUSPICIOUS_GODS.has(g.name)).map((g) => g.name);
    const majorTabooGods = day.gods.filter((g) => MAJOR_TABOO_GODS.has(g.name)).map((g) => g.name);
    const isHuangdao = HUANGDAO_STARS.has(day.twelveStar);
    const starLuck = day.traditionalFacts.twentyEightStar.luck;
    const bestHours = day.hours
      .filter((h) => h.screening.status !== '有明确限制' && h.preference.withinWorkHours)
      .sort((a, b) => {
        const scoreHour = (h: typeof a) =>
          (h.screening.status === '未见已列限制' ? 10 : 0)
          + (h.match.support.length ? 6 : 0)
          + (HUANGDAO_STARS.has(h.twelveStar) ? 4 : 0)
          + (h.preference.preferredTime ? 3 : 0)
          + (h.baziMatch?.scoreDelta ?? 0);
        return scoreHour(b) - scoreHour(a);
      })
      .slice(0, 4)
      .map((h) => ({
        name: h.name,
        range: h.range,
        ganzhi: h.ganzhi,
        twelveStar: h.twelveStar,
        huangdao: HUANGDAO_STARS.has(h.twelveStar),
        status: h.screening.status,
        ...(h.baziMatch ? { baziMatchSummary: h.baziMatch.summary } : {}),
      }));
    let rankScore = 0;
    if (day.screening.status === '未见已列限制') rankScore += 40;
    else if (day.screening.status === '需要核对') rankScore += 15;
    else rankScore -= 40;
    if (day.match.support.length) rankScore += 20;
    if (day.match.caution.length) rankScore -= 25;
    if (majorTabooGods.length) rankScore -= 20 * majorTabooGods.length;
    if (keyAuspiciousGods.length) rankScore += 6 * Math.min(3, keyAuspiciousGods.length);
    if (isHuangdao) rankScore += 8;
    if (FAVORABLE_OFFICERS.has(day.dayOfficer)) rankScore += 6;
    if (CAUTION_OFFICERS.has(day.dayOfficer)) rankScore -= 15;
    if (starLuck === '吉') rankScore += 4;
    if (day.preference.matchesWeekend) rankScore += 5;
    if (day.baziMatch) rankScore += day.baziMatch.scoreDelta;
    const tier: '优选' | '次选' | '慎用' =
      day.screening.status === '未见已列限制' && majorTabooGods.length === 0 && !CAUTION_OFFICERS.has(day.dayOfficer)
        ? '优选'
        : day.screening.status !== '有明确限制' && majorTabooGods.length === 0
          ? '次选'
          : '慎用';
    return {
      date: day.date,
      weekday: day.weekday,
      lunarDate: day.lunarDate,
      tier,
      rankScore,
      huangdao: isHuangdao,
      dayOfficer: day.dayOfficer,
      keyAuspiciousGods,
      majorTabooGods,
      ...(day.baziMatch ? { baziMatchSummary: day.baziMatch.summary } : {}),
      bestHours,
    };
  });
  const sorted = [...evaluated].sort((a, b) => b.rankScore - a.rankScore || a.date.localeCompare(b.date));
  return {
    preferredDays: sorted.filter((d) => d.tier === '优选'),
    secondaryDays: sorted.filter((d) => d.tier === '次选'),
    cautionDays: sorted.filter((d) => d.tier === '慎用'),
    ranked: sorted,
    rule: '综合原始宜忌、参与人年日支冲克、四离四绝、岁破/月破/受死/十恶大败等大忌、天德/月德/天赦等吉神、建除十二神、黄黑道及二十八宿分级；优选须无明确限制且无大忌神煞。',
  };
}
