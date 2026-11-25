import type { z } from 'zod';
import { sameJsonValue } from '../json-value';
import { computeQimen } from './qimen/compute';
import { analyzeQimenEvidence, buildQimenStarDoorStateSummary, getQimenActiveSpecialConditionText } from './qimen/evidence';
import { formatQimenPatternRelations } from './qimen/patterns';
import type { QimenData } from './qimen/types';
import type { qimenInput } from '../schema';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateQimenSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { generateQimenRange, type QimenRange } from './qimen/range';
import reference from './qimen-reference.json';
import { formatClassicExcerpts, selectQimenClassics } from './classics';
import { createTimezoneOffsetReader, formatFixedTimezoneOffset } from './huangji/civil-time';
import { buildMethodSituationDigest, buildQimenMatterFocusSection } from './situation-digest';

type Input = z.infer<typeof qimenInput>;
type Options = Input['prompt'];
const scopes = { hour: 'hourly', day: 'daily', month: 'monthly', year: 'yearly' } as const;

function seasonalityText(data: QimenData) {
  const season = data.seasonality;
  if (!season || !['hour', 'day'].includes(data.scope ?? '')) return '';
  return `实际节气${season.currentJieQi}；定局${data.timeInfo.juTerm || data.timeInfo.solarTerm}${data.timeInfo.epoch}；季节五行${season.seasonalElement}；日干${season.dayStem}属${season.dayElement}，${season.seasonRelationDescription}；月相${season.lunarPhase}（${season.lunarPhaseDetail}）；建除${season.dayOfficer}（${season.dayOfficerFortuneLabel}）；四柱互动${season.ganzhiInteractions.map((item) => item.description).join('、') || '未检出明确合冲刑害'}`;
}

async function canonicalChart(data: QimenData) {
  if (!data || !Number.isSafeInteger(data.timestamp) || !['hour', 'day', 'month', 'year'].includes(data.scope ?? '') ||
      !['zhuanpan', 'feipan'].includes(data.method ?? '') || !Number.isInteger(data.timezoneOffsetMinutes)) {
    throw new Error('奇门结果缺少有效时间、层级、时区或排盘方式。');
  }
  if ((!data.civilTime && data.timezoneOffsetMinutes !== 480) ||
      (['hour', 'day'].includes(data.scope!) && !['chaibu', 'zhirun', 'maoshan'].includes(data.juMethod ?? '')) ||
      (['month', 'year'].includes(data.scope!) && data.juMethod !== undefined) ||
      (data.centerPalace !== undefined && !['kun2', 'yang-gen8-yin-kun2'].includes(data.centerPalace)) ||
      (data.feipanMode !== undefined && (data.method !== 'feipan' || !['star-only', 'all-fly'].includes(data.feipanMode)))) {
    throw new Error('奇门结果包含当前入口不支持的排盘设置。');
  }
  const context = data.timeContext;
  if (data.civilTime && context) throw new Error('奇门结果不能同时使用地方时与真太阳时。');
  if (data.civilTime && (typeof data.civilTime !== 'object' || Array.isArray(data.civilTime) ||
      (data.civilTime.timezone === undefined) === (data.civilTime.timeZoneId === undefined) ||
      (data.civilTime.timezone !== undefined && (typeof data.civilTime.timezone !== 'number' || !Number.isFinite(data.civilTime.timezone))) ||
      (data.civilTime.timeZoneId !== undefined && (typeof data.civilTime.timeZoneId !== 'string' || !data.civilTime.timeZoneId.trim())))) throw new Error('奇门地方时区配置无效。');
  if (context && (context.standard !== 'true-solar' || !Number.isSafeInteger(context.referenceTimestamp) || !Number.isFinite(context.longitude) || context.longitude < -180 || context.longitude > 180 || data.termReferenceTimestamp !== context.referenceTimestamp)) throw new Error('真太阳时结果缺少有效的实际占时或经度。');
  if (!context && data.termReferenceTimestamp !== undefined) throw new Error('奇门结果缺少真太阳时设置。');
  const settings = { method: data.method, ...(data.feipanMode ? { feipanMode: data.feipanMode } : {}), scope: data.scope, juMethod: data.juMethod, ...(data.centerPalace ? { centerPalace: data.centerPalace } : {}), ...(context ? { timeStandard: 'true-solar' as const, longitude: context.longitude } : data.civilTime ? { timeStandard: 'civil' as const, ...data.civilTime } : {}) };
  const expected = await computeQimen(new Date(context?.referenceTimestamp ?? data.timestamp), settings);
  const { evidenceAnalysis: _savedEvidence, ...saved } = data;
  const { evidenceAnalysis: _expectedEvidence, ...canonical } = expected;
  // Results are JSON values at the HTTP/MCP boundary; normalize optional undefined
  // fields before comparing so a serialized saved chart has the same semantics.
  if (!sameJsonValue(saved, canonical)) throw new Error('奇门盘面与起局时间和排盘设置不一致。');
  return expected;
}

function buildPrompt(data: QimenData, question: string, options: Options, now: string) {
  const evidence = data.evidenceAnalysis ?? analyzeQimenEvidence(data);
  const selection = resolvePromptSelection('qimen', { ...options, scope: options?.scope ?? scopes[data.scope!] });
  const schools = formatSchoolGuidance(options?.schools, reference.schools, {
    multiNote: '多口径合参：分别依据各口径分析，再比较共同点、分歧及其对应盘面依据。',
  });
  const schoolAlgorithmsText = formatSchoolAlgorithmSection(evaluateQimenSchoolAlgorithms(data, options?.schools));
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n') : '';
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectQimenClassics({
          zhiFu: data.zhiFu,
          zhiShi: data.zhiShi,
          deities: data.jiuGongGe.map((gong) => gong.shenPan.god).filter(Boolean),
          stemPairs: data.jiuGongGe.flatMap((gong) => [
            `${gong.tianPan.stem}${gong.diPan.stem}`,
            ...(gong.tianPan.companionStem ? [`${gong.tianPan.companionStem}${gong.diPan.stem}`] : []),
          ]),
        }),
        '典籍片段',
      )
    : '';
  const special = getQimenActiveSpecialConditionText(data);
  const season = seasonalityText(data);
  const setupRuleLine = evidence.ruleSourceFacts[0]?.promptText ?? '';
  const starDoorStateLine = buildQimenStarDoorStateSummary(data);
  const concisePatterns = data.patternTags?.length
    ? [`全局格局标签：${data.patternTags.join('、')}`]
    : [];
  const patternRelationsText = formatQimenPatternRelations(data);
  const filteredCounters = evidence.counterEvidenceFacts
    .map((item) => item.promptText)
    .filter((text) => !/同宫，宜防阻力、口舌或反复。$/u.test(text));
  const actionableDirections = evidence.directionFacts.filter((item) => item.kind !== '候选宫方位');
  const matterFocusSection = buildQimenMatterFocusSection(
    question,
    data.jiuGongGe,
    data.voidBranches,
    data.zhiFu,
  );
  const digestLines = buildMethodSituationDigest('qimen', data, question);
  const sections = [
    '【传统依据】\n按本次排盘层级和定局方法确定九宫；先结合问题确定主体、事项用神与主客，再以门星神、天地盘干及实际命中格局取证。',
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    matterFocusSection,
    data.timeContext
      ? `【时间】\n实际起局：${new Date(data.timeContext.referenceTimestamp).toISOString()}；真太阳时钟表：${new Date(data.timestamp + 8 * 3_600_000).toISOString().slice(0, 19)}（按北京时间钟表口径校正）；经度 ${data.timeContext.longitude}°，经度修正 ${data.timeContext.longitudeCorrectionMinutes.toFixed(3)} 分钟，均时差 ${data.timeContext.equationOfTimeMinutes.toFixed(3)} 分钟，合计 ${data.timeContext.totalCorrectionMinutes.toFixed(3)} 分钟。节气及年月按实际起局瞬时确定，日时按真太阳时确定；提示词时间：${now}。`
      : `【时间】\n起局：${new Date(data.timestamp).toISOString()}；历法时区 UTC${formatFixedTimezoneOffset(data.timezoneOffsetMinutes! / 60)}${data.civilTime?.timeZoneId ? `（${data.civilTime.timeZoneId}）` : ''}；提示词时间：${now}。`,
    `【起局与规则】\n${evidence.calculationEvidenceFacts.map((fact) => fact.promptText).join('；')}${setupRuleLine ? `\n${setupRuleLine}` : ''}`,
    special ? `【特殊条件】\n${special}` : '',
    season ? `【节令背景】\n${season}` : '',
    data.seasonality?.lunarDateWarning ? `【历法差异】\n${data.seasonality.lunarDateWarning}` : '',
    `【九宫】\n${evidence.palaceFacts.map((item) => item.promptText).join('\n')}${starDoorStateLine ? `\n${starDoorStateLine}` : ''}`,
    concisePatterns.length ? `【盘面格局】\n${concisePatterns.join('\n')}` : '',
    `【格局叠加与吉凶制衡关系】\n${patternRelationsText}`,
    evidence.relations.length ? `【候选宫间关系】\n${evidence.relations.map((item) => item.promptText).join('；')}` : '',
    filteredCounters.length ? `【反证】\n${filteredCounters.join('；')}` : '',
    evidence.timingFacts.length ? `【应期条件】\n${evidence.timingFacts.map((item) => item.promptText).join('；')}` : '',
    actionableDirections.length ? `【方位条件】\n${actionableDirections.map((item) => item.promptText).join('；')}` : '',
    selection ? `【解读选择】\n${selection.section}` : '',
    schools,
    schoolAlgorithmsText,
    classics ? `【经典依据】\n${classics}` : '',
    classicExcerpts,
    `【任务】\n围绕问题先明确主体、事项用神和主客身份，逐宫核验门星神、天地盘干、空亡马星及命中格局；列出支持、反证、成立条件与现实核验点。${selection ? `\n${selection.task}` : ''}\n候选宫与格局是盘内传统取象，应期和方位须结合现实条件，不据此保证事件、日期或路线安全。`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}

function rangePrompt(range: QimenRange, question: string, options: Options, now: string) {
  const civil = range.input.qimen.timeStandard === 'civil', zone = range.input.qimen.timeZoneId;
  const readOffset = civil && zone ? createTimezoneOffsetReader(zone) : undefined;
  const format = (timestamp: number) => {
    const offset = civil ? readOffset ? readOffset(timestamp) : range.input.qimen.timezone! : 8;
    return `${new Date(timestamp + offset * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')}（${civil ? `UTC${formatFixedTimezoneOffset(offset)}${zone ? `，${zone}` : ''}` : '北京时间'}）`;
  };
  const sections = range.branches.map((branch, index) => {
    const phase = branch.data.scope === 'hour' || branch.data.scope === 'day'
      ? `月相起止采样：${format(branch.moonPhaseEvidence.start.utcTimestamp)} ${branch.moonPhaseEvidence.start.eightPhaseName}，照明 ${branch.moonPhaseEvidence.start.illuminationPercent.toFixed(3)}%；${format(branch.moonPhaseEvidence.end.utcTimestamp)} ${branch.moonPhaseEvidence.end.eightPhaseName}，照明 ${branch.moonPhaseEvidence.end.illuminationPercent.toFixed(3)}%；月相连续变化，采样值只代表所标注时刻。`
      : '';
    return [`【分支 ${index + 1}】\n${format(branch.startTimestamp)} 至 ${format(branch.endTimestamp)}（起点含、终点不含）`, phase, buildPrompt(branch.data, question, options, now).text].filter(Boolean).join('\n');
  });
  const standard = range.input.qimen.timeStandard === 'true-solar' ? `真太阳时（经度 ${range.input.qimen.longitude}°）` : range.input.qimen.timeStandard === 'civil' ? `地方民用时（${range.source.timezone}）` : '北京时间';
  const text = [`【时间范围】\n${format(range.source.startTimestamp)} 至 ${format(range.source.endTimestamp)}（起点含、终点不含）；按${standard}的时辰、日界及实际瞬时的节气、节令阶段切分，共 ${range.branches.length} 段。`, ...sections, '【范围任务】\n分别分析每个分支的共同点和差异，结论须标明适用时间段；不将任一分支当作整个范围的确定结果。'].join('\n\n');
  return { text };
}

function withoutCachedEvidence(range: QimenRange) {
  return { ...range, branches: range.branches.map((branch) => { const { evidenceAnalysis: _evidence, ...data } = branch.data; return { ...branch, data }; }) };
}

async function canonicalRange(value: unknown, input: Input): Promise<QimenRange> {
  if (!value || typeof value !== 'object') throw new Error('奇门范围结果无效。');
  const data = value as QimenRange;
  if (data.kind !== 'range' || !data.input || !Array.isArray(data.branches)) throw new Error('奇门范围结果缺少原始输入或分支。');
  if (!input.range) throw new Error('奇门范围结果缺少有效区间。');
  const expected = await generateQimenRange(input.range, input.qimen);
  if (!sameJsonValue(withoutCachedEvidence(data), withoutCachedEvidence(expected))) throw new Error('奇门范围结果与原始输入不一致。');
  return expected;
}

export async function qimen(input: Input, now: string) {
  if (input.range) {
    const data = await generateQimenRange(input.range, input.qimen);
    const summary = { title: '奇门遁甲范围起局', tags: [data.status === 'stable' ? '盘面稳定' : '条件分支', `${data.branches.length} 段`], lines: [...data.branches.map((branch, i) => `分支 ${i + 1}：${new Date(branch.startTimestamp).toISOString()} 至 ${new Date(branch.endTimestamp).toISOString()}（终点不含）；${branch.data.isYangDun ? '阳遁' : '阴遁'}${branch.data.juShu}局，值符${branch.data.zhiFu}，值使${branch.data.zhiShi}`), ...new Set(data.branches.flatMap((branch) => branch.data.seasonality?.lunarDateWarning ? [branch.data.seasonality.lunarDateWarning] : []))] };
    return { data, summary, prompt: rangePrompt(data, input.question, input.prompt, now) };
  }
  const data = await computeQimen(new Date(input.divinationTime ?? now), input.qimen);
  const evidenceAnalysis = data.evidenceAnalysis ?? analyzeQimenEvidence(data);
  const summary = {
    title: '奇门遁甲排盘结果', tags: [`${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局`, `值符：${data.zhiFu}`, `值使：${data.zhiShi}`],
    lines: [...evidenceAnalysis.calculationEvidenceFacts.map((fact) => fact.promptText), ...(data.seasonality?.lunarDateWarning ? [data.seasonality.lunarDateWarning] : [])],
  };
  return { data, summary, prompt: buildPrompt(data, input.question, input.prompt, now) };
}

export async function promptForQimenRange(data: unknown, input: Input, now: string) {
  const range = await canonicalRange(data, input);
  return rangePrompt(range, input.question, input.prompt, now);
}

export async function promptForQimen(value: unknown, question: string, options: Options, now: string) {
  return buildPrompt(await canonicalChart((value && typeof value === 'object' ? value : {}) as QimenData), question, options, now);
}
