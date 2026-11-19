import type { z } from 'zod';
import type { baziZiweiIndependentInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { calculateBaziIndependentData } from './bazi';
import { calculateZiweiIndependentData, collectZiweiMajorStars } from './ziwei';
import { isLunarDateDiscrepancyWarning } from './birth-time';
import { dedupeExcerpts, formatClassicExcerpts, selectBaziClassics, selectZiweiClassics } from './classics';
import { baziSchools } from './bazi/prompt-options';
import { summarizeClimate } from './bazi/climate';
import { summarizeClimateDecision } from './bazi/climate-decision';
import { summarizeUsefulStrategy } from './bazi/useful-strategy';
import { formatUsefulGod } from './bazi/useful-god';
import { formatPatternEvidence } from './bazi/pattern-evidence';
import { formatFortuneShensha } from './bazi/fortune-shensha';
import { formatBaziShensha, formatBaziShenshaHits, partitionBaziShensha } from './bazi/shensha';
import { formatNatalFlying, formatScopeMutagens } from './ziwei-flying';
import { evaluateBaziZiweiCorroboration, formatCorroborationSection, type BaziZiweiCorroborationResult } from './bazi-ziwei-corroboration';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof baziZiweiIndependentInput>;
type Source = Pick<Input, 'birth' | 'gender' | 'referenceTime' | 'ziweiRules' | 'prompt'>;
const themes = [
  { id: 'overview', label: '命局总纲', pillars: ['year', 'month', 'day', 'hour'], palaces: ['命宫', '福德', '迁移'] },
  { id: 'character', label: '性情与能力', pillars: ['month', 'day', 'hour'], palaces: ['命宫', '福德'] },
  { id: 'career', label: '事业与发展', pillars: ['month', 'day', 'hour'], palaces: ['官禄', '命宫', '迁移', '财帛'] },
  { id: 'wealth', label: '财帛与资源', pillars: ['month', 'day', 'hour'], palaces: ['财帛', '田宅', '官禄'] },
  { id: 'relationships', label: '感情与关系', pillars: ['day', 'hour'], palaces: ['夫妻', '福德', '命宫'] },
  { id: 'family', label: '家庭与六亲', pillars: ['year', 'month', 'day', 'hour'], palaces: ['父母', '兄弟', '子女', '田宅'] },
  { id: 'wellbeing', label: '身心与健康', pillars: ['month', 'day', 'hour'], palaces: ['疾厄', '福德', '命宫'] },
  { id: 'mobility', label: '迁移与环境', pillars: ['year', 'month', 'day'], palaces: ['迁移', '田宅', '官禄'] },
  { id: 'inner-world', label: '内在状态', pillars: ['month', 'day', 'hour'], palaces: ['福德', '命宫'] },
  { id: 'timing', label: '大运与流年', pillars: ['year', 'month', 'day', 'hour'], palaces: ['命宫', '官禄', '财帛'] },
] as const;
type Position = 'year' | 'month' | 'day' | 'hour';
const labels: Record<Position, string> = { year: '年', month: '月', day: '日', hour: '时' };
const ziweiSchools = { sanhe: '三合：核对命身宫与三方四正所列星曜。', feixing: '飞星：核对本命宫干化星、落宫与自化，以及已列运限四化落点；逐宫运限飞化仍待核。', sihua: '四化：分别核对生年和所列运限的四化。', zhongzhou: '中州：核对对宫借星、双星组合、邻宫夹辅与运限流曜。' } as const;

async function calculateData(input: Source) {
  const source = { birth: input.birth, gender: input.gender, ...(input.referenceTime ? { referenceTime: input.referenceTime } : {}), ...(input.ziweiRules ? { ziweiRules: input.ziweiRules } : {}), ...(input.prompt ? { prompt: input.prompt } : {}) };
  const exact = source.birth.clock.kind === 'exact';
  const bazi = await calculateBaziIndependentData({ birth: source.birth, gender: source.gender, ...(exact && source.referenceTime ? { referenceTime: source.referenceTime } : {}) });
  const ziwei = await calculateZiweiIndependentData({ birth: source.birth, gender: source.gender, referenceTime: source.referenceTime, rules: source.ziweiRules });
  let alignment: { kind: 'exact'; timestamp: number } | { kind: 'candidates'; source: unknown; candidates: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: number; baziIndex: number; ziweiIndex: number }> };
  if (bazi.chart && !('unknown' in ziwei)) {
    if (bazi.chart.basis.utcTimestamp !== Date.parse(ziwei.basis.utcDateTime)) throw new Error('八字与紫微出生瞬时不一致。');
    alignment = { kind: 'exact', timestamp: bazi.chart.basis.utcTimestamp };
  } else if (bazi.unknown && 'unknown' in ziwei) {
    const a = bazi.unknown.segments, b = ziwei.unknown.candidates;
    const firstSource = bazi.unknown.source, secondSource = ziwei.unknown.source;
    if (firstSource.startTimestamp !== secondSource.startTimestamp || firstSource.endTimestamp !== secondSource.endTimestamp || firstSource.excludedSeconds !== secondSource.excludedSeconds) throw new Error('八字与紫微的出生范围不一致。');
    const candidates: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: number; baziIndex: number; ziweiIndex: number }> = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const startTimestamp = Math.max(a[i].startTimestamp, b[j].startTimestamp), endTimestamp = Math.min(a[i].endTimestamp, b[j].endTimestamp);
      if (startTimestamp < endTimestamp) {
        if (a[i].timezone !== b[j].timezone) throw new Error('八字与紫微候选时区不一致。');
        candidates.push({ startTimestamp, endTimestamp, endExclusive: true, timezone: a[i].timezone, baziIndex: i, ziweiIndex: j });
      }
      if (a[i].endTimestamp <= b[j].endTimestamp) i++; else j++;
    }
    const covered = candidates.reduce((sum, item) => sum + item.endTimestamp - item.startTimestamp, 0);
    if (!candidates.length || covered !== firstSource.endTimestamp - firstSource.startTimestamp - firstSource.excludedSeconds * 1000) throw new Error('八字与紫微候选交集没有覆盖全部有效出生时间。');
    alignment = { kind: 'candidates', source: firstSource, candidates };
  } else throw new Error('八字与紫微出生精度不一致。');
  const calendarWarnings = ('unknown' in ziwei ? ziwei.unknown.candidates.flatMap((item) => item.chart.limitations) : ziwei.limitations).filter(isLunarDateDiscrepancyWarning);
  let corroboration: BaziZiweiCorroborationResult | undefined;
  if (alignment.kind === 'exact' && bazi.chart && !('unknown' in ziwei)) {
    corroboration = evaluateBaziZiweiCorroboration(bazi.chart, ziwei);
  } else if (alignment.kind === 'candidates' && source.prompt?.candidateIndex !== undefined && bazi.unknown && 'unknown' in ziwei) {
    const chosen = alignment.candidates[source.prompt.candidateIndex];
    if (chosen) corroboration = evaluateBaziZiweiCorroboration(bazi.unknown.segments[chosen.baziIndex], ziwei.unknown.candidates[chosen.ziweiIndex].chart);
  }
  return { input: source, charts: { bazi, ziwei }, alignment, ...(corroboration ? { corroboration } : {}), themes: structuredClone(themes),
    limitations: ['两套体系共用真实出生瞬时，但干支、历法与时区分界口径可能不同，不能强行认定结果相同。', '八字旺衰、化气、曲直、从儿及普通格局成败为所列条件模型；其他特殊格、完整格局成败和用神尚未完成；紫微本命宫干及运限四化落点已列，逐宫运限飞化与高级格局仍待核。', '不确定出生时只比较真实时间有交集的候选；八字精确起运和岁运未计算，候选首秒不是确定出生时刻。', '跨体系并列证据不等于独立验证或对现实结果的保证。', ...new Set(calendarWarnings)] };
}
type Data = Awaited<ReturnType<typeof calculateData>>;
function render(data: Data, question: string, options?: Input['prompt']) {
  const { bazi, ziwei } = data.charts, selected = options?.candidateIndex;
  if (data.alignment.kind === 'exact' && selected !== undefined) throw new Error('精确出生不接受候选索引。');
  if (data.alignment.kind === 'candidates' && selected !== undefined && !data.alignment.candidates[selected]) throw new Error('合参出生候选索引超出范围。');
  const topic = options?.topic, chosenThemes = topic ? themes.filter((item) => item.id === topic) : themes;
  const detail = options?.detailLevel ?? 'standard';
  const view = (index?: number) => {
    if (data.alignment.kind === 'exact') {
      if (!bazi.chart || 'unknown' in ziwei) throw new Error('合参缺少精确盘面。');
      return { pillars: bazi.chart.pillars, natalFacts: bazi.chart.natalFacts, shensha: bazi.chart.shensha, strength: bazi.chart.strength, ordinaryPattern: bazi.chart.ordinaryPattern, transformation: bazi.chart.transformation, quzhi: bazi.chart.quzhi, conger: bazi.chart.conger, patternOverview: bazi.chart.patternOverview, patternEvidence: bazi.chart.patternEvidence, usefulBaseline: bazi.chart.usefulBaseline, climate: bazi.chart.climate, climateDecision: bazi.chart.climateDecision, usefulStrategy: bazi.chart.usefulStrategy, usefulGod: bazi.chart.usefulGod, monthCommander: bazi.chart.monthCommander, ziwei: ziwei.natal, ziweiReference: ziwei.reference, baziLocated: bazi.located };
    }
    const item = data.alignment.candidates[index!];
    if (!bazi.unknown || !('unknown' in ziwei)) throw new Error('合参缺少出生候选。');
    const bz = bazi.unknown.segments[item.baziIndex], zw = ziwei.unknown.candidates[item.ziweiIndex].chart;
    return { pillars: bz.pillars, natalFacts: bz.natalFacts, shensha: bz.shensha, strength: bz.strength, ordinaryPattern: bz.ordinaryPattern, transformation: bz.transformation, quzhi: bz.quzhi, conger: bz.conger, patternOverview: bz.patternOverview, patternEvidence: bz.patternEvidence, usefulBaseline: bz.usefulBaseline, climate: bz.climate, climateDecision: bz.climateDecision, usefulStrategy: bz.usefulStrategy, usefulGod: bz.usefulGod, monthCommander: bz.monthCommander, ziwei: zw.natal, ziweiReference: zw.reference, baziLocated: null };
  };
  const describe = (index?: number) => {
    const value = view(index), pillarText = (Object.keys(labels) as Position[]).map((key) => `${labels[key]}柱${value.pillars[key].ganZhi}（${value.pillars[key].tenGod}）`).join('、');
    const ziweiDay = value.ziwei.chineseDate.split(/\s+/)[2];
    const difference = ziweiDay && ziweiDay !== value.pillars.day.ganZhi ? `八字日柱${value.pillars.day.ganZhi}与紫微排盘日柱${ziweiDay}不同，应核对各自分界口径。` : '两体系所列日柱相同，仍应分别核对分界口径。';
    const body = chosenThemes.map((theme) => {
      const baziFacts = theme.pillars.map((key) => `${labels[key]}${value.pillars[key].ganZhi}${value.pillars[key].tenGod}`).join('、');
      const palaceFacts = value.ziwei.palaces.filter((palace) => (theme.palaces as readonly string[]).includes(palace.name) || (palace.isBodyPalace && ['overview', 'character', 'inner-world'].includes(theme.id))).map((palace) => {
        const selectedStars = detail === 'concise' ? palace.majorStars : detail === 'standard' ? [...palace.majorStars, ...palace.minorStars] : [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
        const opp = value.ziwei.palaces[(palace.index + 6) % 12];
        const emptyBorrow = palace.majorStars.length === 0 && opp && opp.majorStars.length > 0
          ? `［空宫，借对宫${opp.name}${opp.majorStars.map((s) => `${s.name}${s.brightness ?? ''}${s.mutagen ? `化${s.mutagen}` : ''}`).join('、')}］`
          : '';
        return `${palace.name}${palace.earthlyBranch}${palace.isBodyPalace ? '（身）' : ''}${emptyBorrow}：${selectedStars.map((star) => `${star.name}${star.brightness ?? ''}${star.mutagen ? `化${star.mutagen}` : ''}`).join('、') || '未列星曜'}`;
      });
      const timing = theme.id === 'timing' ? `；八字${value.baziLocated ? `当前${value.baziLocated.cycle ? `大运${value.baziLocated.cycle.ganZhi}` : '童限'}、流年${value.baziLocated.year.ganZhi}` : '精确起运或岁运未计算'}；紫微${value.ziweiReference ? `大限${value.ziweiReference.layers.decadal.heavenlyStem}${value.ziweiReference.layers.decadal.earthlyBranch}（${formatScopeMutagens(value.ziweiReference.layers.decadal.mutagenPlacements)}）、流年${value.ziweiReference.layers.yearly.heavenlyStem}${value.ziweiReference.layers.yearly.earthlyBranch}（${formatScopeMutagens(value.ziweiReference.layers.yearly.mutagenPlacements)}）` : '未指定运限参考时刻'}` : '';
      const baziLine = chosenThemes.length > 1 && theme.id !== 'overview'
        ? `关联八字柱位：${theme.pillars.map((key) => `${labels[key]}柱`).join('、')}`
        : `八字：${baziFacts}；月令司权${value.monthCommander.stem}`;
      return chosenThemes.length > 1
        ? `【${theme.label}】${baziLine}｜紫微：${palaceFacts.join('；') || '未找到相应宫位'}${timing}。`
        : `【${theme.label}】\n${baziLine}。\n紫微：${palaceFacts.join('；') || '未找到相应宫位'}${timing}。`;
    }).join(chosenThemes.length > 1 ? '\n' : '\n\n');
    const relevantPalaces = value.ziwei.palaces.filter((palace) => !topic || chosenThemes.some((theme) => (theme.palaces as readonly string[]).includes(palace.name) || (palace.isBodyPalace && ['overview', 'character', 'inner-world'].includes(theme.id))));
    const specialParts = [
      value.transformation ? `化气${value.transformation.pattern}（${value.transformation.status}）` : detail === 'professional' ? '化气未见日干配合' : '',
      value.quzhi ? `曲直${value.quzhi.route}（${value.quzhi.status}）` : detail === 'professional' ? '曲直未命中' : '',
      value.conger?.route ? `从儿${value.conger.route}（${value.conger.status}）` : detail === 'professional' ? '从儿未命中' : '',
      value.conger?.competingWealth ? `从财优先${value.conger.competingWealth}` : detail === 'professional' ? '从财优先未命中' : '',
    ].filter(Boolean);
    return `【双系统盘面】\n八字${pillarText}；旺衰模型${value.strength.status}（月令${value.strength.tendencies.month}、根气${value.strength.tendencies.root}、结构${value.strength.tendencies.structure}）；普通取格候选${value.ordinaryPattern.candidate}（${value.ordinaryPattern.source}）；${specialParts.length ? `${specialParts.join('；')}；` : ''}已核算路线优先${value.patternOverview.pattern}；取用基础方向有利${value.usefulBaseline.favorable.join('、') || '待判'}、不利${value.usefulBaseline.unfavorable.join('、') || '待判'}（非最终喜忌）；${summarizeClimate(value.climate)}；${summarizeClimateDecision(value.climateDecision)}；紫微命宫${value.ziwei.soulBranch}、身宫${value.ziwei.bodyBranch}、命主${value.ziwei.soul}、身主${value.ziwei.body}、${value.ziwei.fiveElementsClass}。${difference}\n\n${body}\n\n【紫微相关宫位的本命宫干四化】\n${formatNatalFlying(relevantPalaces)}`;
  };
  let facts: string;
  if (data.alignment.kind === 'exact') facts = describe();
  else if (selected !== undefined) {
    const item = data.alignment.candidates[selected];
    facts = `【合参出生候选 ${selected}】\nUTC ${new Date(item.startTimestamp).toISOString()} 至 ${new Date(item.endTimestamp).toISOString()}（不含终点）；八字候选 ${item.baziIndex}、紫微候选 ${item.ziweiIndex}。该区间并非确定出生时刻。\n\n${describe(selected)}`;
  } else {
    const rows = data.alignment.candidates.map((item, index) => {
      const value = view(index), pillars = (Object.keys(labels) as Position[]).map((key) => value.pillars[key].ganZhi).join(' ');
      return `候选 ${index}：UTC ${new Date(item.startTimestamp).toISOString()} 至 ${new Date(item.endTimestamp).toISOString()}（不含终点），UTC${item.timezone >= 0 ? '+' : ''}${item.timezone}；八字${pillars}，旺衰模型${value.strength.status}，普通取格候选${value.ordinaryPattern.candidate}，化气${value.transformation ? `${value.transformation.pattern}（${value.transformation.status}）` : '未见日干配合'}，曲直${value.quzhi ? `${value.quzhi.route}（${value.quzhi.status}）` : '未命中'}，从儿${value.conger?.route ? `${value.conger.route}（${value.conger.status}）` : '未命中'}，从财优先${value.conger?.competingWealth ?? '未命中'}，已核算路线优先${value.patternOverview.pattern}，基础有利${value.usefulBaseline.favorable.join('、') || '待判'}、不利${value.usefulBaseline.unfavorable.join('、') || '待判'}（非最终喜忌）；${summarizeClimate(value.climate)}；${summarizeClimateDecision(value.climateDecision)}；紫微命宫${value.ziwei.soulBranch}、身宫${value.ziwei.bodyBranch}、${value.ziwei.fiveElementsClass}。${topic ? `\n${describe(index)}` : ''}`;
    });
    facts = `【出生时间交集】\n共 ${rows.length} 段，只组合实际时间重叠的八字与紫微候选；不能将任一候选当作确定出生时刻。\n${rows.join('\n')}\n完整双盘见结构化结果；用 candidateIndex 选择一个交集候选查看十项主题证据。`;
  }
  const bzSchools = options?.baziSchools?.map((school) => `${baziSchools[school].label}：${baziSchools[school].task}`).join('\n');
  const zwSchools = options?.ziweiSchools?.map((school) => ziweiSchools[school]).join('\n');
  const useful = data.alignment.kind === 'exact' ? `${summarizeUsefulStrategy(view().usefulStrategy)}\n${formatUsefulGod(view().usefulGod)}` : selected !== undefined ? `${summarizeUsefulStrategy(view(selected).usefulStrategy)}\n${formatUsefulGod(view(selected).usefulGod)}` : data.alignment.candidates.map((_, index) => `候选 ${index}：${summarizeUsefulStrategy(view(index).usefulStrategy)}；用神裁定${view(index).usefulGod.incrementStatus}（主用${view(index).usefulGod.useful}、喜${view(index).usefulGod.favorableWuxing.join('、') || '待判'}、忌${view(index).usefulGod.unfavorableWuxing.join('、') || '待判'}）`).join('\n');
  const patternEvidence = data.alignment.kind === 'exact' ? formatPatternEvidence(view().patternEvidence) : selected !== undefined ? formatPatternEvidence(view(selected).patternEvidence) : '格局透干根气按各出生候选分别保存在结构化结果；选择候选后可展开。';
  let shensha: string;
  if (data.alignment.kind === 'exact') shensha = formatBaziShensha(view().shensha);
  else if (selected !== undefined) shensha = formatBaziShensha(view(selected).shensha);
  else {
    const parts = partitionBaziShensha(data.alignment.candidates.map((_, index) => view(index).shensha));
    const withBasis = detail === 'professional';
    shensha = `各候选共同：${formatBaziShenshaHits(parts.common, withBasis, '没有共同命中项')}\n各候选仅列与共同项的差异：\n${parts.differences.map((item, index) => `候选 ${index}：${formatBaziShenshaHits(item, withBasis, '无额外命中')}`).join('\n')}\n${withBasis ? `${parts.common.rule}\n` : ''}${parts.common.limitation}`;
  }
  const timingShensha = (!topic || topic === 'timing') && data.alignment.kind === 'exact' && bazi.located
    ? formatFortuneShensha(bazi.located.shensha, ['dayun', 'year', 'month', 'day', 'hour'], detail === 'professional') : '';
  const activeCorroboration = data.alignment.kind === 'exact'
    ? data.corroboration
    : selected !== undefined
      ? (selected === data.input.prompt?.candidateIndex && data.corroboration
          ? data.corroboration
          : evaluateBaziZiweiCorroboration(
              bazi.unknown!.segments[data.alignment.candidates[selected].baziIndex],
              ('unknown' in ziwei ? ziwei.unknown.candidates[data.alignment.candidates[selected].ziweiIndex].chart : ziwei),
            ))
      : undefined;
  const corroborationText = activeCorroboration
    ? formatCorroborationSection(activeCorroboration)
    : '跨盘互证条件按各出生候选分别核验；选择候选后可展开。';
  const classics = options?.includeClassics
    ? (() => {
        const views = data.alignment.kind === 'exact'
          ? [view()]
          : selected !== undefined
            ? [view(selected)]
            : data.alignment.candidates.map((_, index) => view(index));
        return formatClassicExcerpts(
          dedupeExcerpts(
            views.flatMap((v) => [
              ...selectBaziClassics(v.pillars.day.gan, v.ordinaryPattern.candidate, v.pillars.month.zhi),
              ...selectZiweiClassics(collectZiweiMajorStars(v.ziwei.palaces)),
            ]),
          ),
          '典籍片段',
        );
      })()
    : '';
  const situationLines = buildMethodSituationDigest('bazi-ziwei', data, question);
  const text = [facts, `【八字本命神煞】\n${shensha}`, timingShensha ? `【八字岁运神煞】\n${timingShensha}` : '', `【八字取用条件候选】\n${useful}`, `【八字格局根气条件】\n${patternEvidence}`, `【跨盘互证条件】\n${corroborationText}`, bzSchools ? `【八字口径】\n${bzSchools}` : '', zwSchools ? `【紫微口径】\n${zwSchools}` : '', classics,
    situationLines.length ? `【局势要点】\n${situationLines.join('\n')}` : '',
    `【合参任务】\n先分别说明两套体系实际列出的事实，再比较相同、不同和资料不足之处；不要将不同方法的相似描述直接当作相互证明。${topic === 'wellbeing' ? '传统取象不能替代医疗判断。' : ''}`,
    `【限制】\n${data.limitations.join('\n')}`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function baziZiweiIndependent(input: Input) {
  const data = await calculateData(input);
  return { data, summary: { title: '八字紫微合参', lines: [data.alignment.kind === 'exact' ? '两盘共用精确出生瞬时' : `出生时间交集：${data.alignment.candidates.length} 段`, `主题：${themes.length} 项`] }, prompt: render(data, input.question, input.prompt) };
}
export async function promptForSavedBaziZiweiIndependent(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = await calculateData(source);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('八字紫微合参与出生资料不一致。');
  return render(expected, question, options ?? source.prompt);
}
