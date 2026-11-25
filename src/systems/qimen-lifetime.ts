import type { z } from 'zod';
import type { qimenLifetimeInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { calculateLifetime, type LifetimeInput } from './qimen/lifetime/chart';
import { buildQimenStarDoorStateSummary } from './qimen/evidence';
import { formatQimenPatternRelations } from './qimen/patterns';
import { formatClassicExcerpts, selectQimenClassics } from './classics';
import reference from './qimen-reference.json';
import { buildMethodSituationDigest } from './situation-digest';
import { inferFortuneScope } from '../router-model/fortune-scope';
import { getYearSixtyCycle, isKe } from './ganzhi-foundation';
import { getDunJiaStem } from './qimen/layout';
import { doorElements, hasTianPanStem } from './qimen/palace';

type Input = z.infer<typeof qimenLifetimeInput>;
type Data = Awaited<ReturnType<typeof calculateLifetime>>;
type Options = Input['prompt'];

const BEIJING_OFFSET_MS = 8 * 3_600_000;
const QIMEN_PUNISHMENTS: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };

function buildCompactQimenFortuneBlock(
  data: Data,
  stages: Data['stages'],
  question: string,
  now: string,
): string {
  if (!stages.length || !data.baseChart.jiuGongGe.length) return '';

  const parsedNow = Date.parse(now);
  const refTs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
  const refDate = new Date(refTs + BEIJING_OFFSET_MS);
  const refYear = refDate.getUTCFullYear();
  const refDateStr = refDate.toISOString().slice(0, 10);
  const birthYear = Number(data.basis.localDateTime.slice(0, 4));
  const currentNominalAge = Number.isFinite(birthYear) ? refYear - birthYear + 1 : NaN;

  let currentStageIndex = -1;
  const ageMatches = stages.filter(
    (s) => Number.isFinite(currentNominalAge) && currentNominalAge >= s.ageStart && currentNominalAge <= s.ageEnd,
  );
  if (ageMatches.length === 1) {
    currentStageIndex = ageMatches[0].stageIndex;
  } else if (ageMatches.length > 1) {
    const exact = ageMatches.find((s) => refDateStr >= s.calendarStart && refDateStr <= s.calendarEnd);
    currentStageIndex = (exact ?? ageMatches[ageMatches.length - 1]).stageIndex;
  } else {
    const calMatch = stages.find((s) => refDateStr >= s.calendarStart && refDateStr <= s.calendarEnd);
    if (calMatch) currentStageIndex = calMatch.stageIndex;
  }

  const maxStages = 8;
  const visibleStages = stages.length <= maxStages
    ? stages
    : (() => {
        const curPos = stages.findIndex((s) => s.stageIndex === currentStageIndex);
        if (curPos < 0 || curPos < maxStages) return stages.slice(0, maxStages);
        const start = Math.min(stages.length - maxStages, Math.max(0, curPos - maxStages + 2));
        return stages.slice(start, start + maxStages);
      })();

  const stageLine = visibleStages
    .map((stage) => {
      const label = stage.title.replace(/大运$/, '');
      const isCurrent = stage.stageIndex === currentStageIndex;
      return `${label}(${stage.ageStart}-${stage.ageEnd}${isCurrent ? '·当前' : ''})`;
    })
    .join('｜');

  const fortuneScope = inferFortuneScope(question, refYear, refTs, Number.isFinite(birthYear) ? birthYear : undefined);
  const voidSet = new Set((data.baseChart.voidPalaces ?? []).map((v) => v.palace));
  const palaces = data.baseChart.jiuGongGe;

  const yearLine = fortuneScope.years
    .map((year) => {
      const ganZhi = getYearSixtyCycle(year);
      const rawStem = ganZhi[0];
      const lookupStem = rawStem === '甲' ? getDunJiaStem(ganZhi) : rawStem;
      const stemLabel = rawStem === '甲' ? `天盘甲遁${lookupStem}` : `天盘${lookupStem}`;
      const palace =
        palaces.find((p) => p.gong !== 5 && hasTianPanStem(p, lookupStem)) ??
        palaces.find((p) => hasTianPanStem(p, lookupStem));
      if (!palace) return `${year}${ganZhi}(${stemLabel}未落宫)`;

      const door = palace.renPan.door || '';
      const star =
        palace.tianPan.companionStem === lookupStem && palace.tianPan.companionStar
          ? palace.tianPan.companionStar
          : palace.tianPan.star || '';
      const flags: string[] = [];
      if (voidSet.has(palace.gong)) flags.push('空亡');
      if (door && doorElements[door] && isKe(doorElements[door], palace.element)) flags.push('门迫');
      if (QIMEN_PUNISHMENTS[lookupStem] === palace.gong) flags.push('击刑');
      const detail = [`${door}${star}`, ...(flags.length ? [flags.join('/')] : [])].filter(Boolean).join('·');
      return `${year}${ganZhi}(${stemLabel}落${palace.name}${detail ? `·${detail}` : ''})`;
    })
    .join('｜');

  return `【阶段运限与流年落宫（压平精要）】\n阶段：${stageLine}\n流年：${yearLine}`;
}

function compactStageFact(text: string): string {
  return text
    .replace(/^((?:成吉格|逢凶格)「[^」]+」)：.+$/u, '$1')
    .replace(/，传统(?:门|神|取)象(?:对应|涉及).+$/u, '');
}

function render(data: Data, question: string, options: Options, now: string) {
  const evidence = data.baseChart.evidenceAnalysis;
  if (!evidence) throw new Error('终身局缺少本命盘证据。');
  const scope = options?.scope ?? 'full';
  const selectedStage = scope === 'stage' ? data.stages[options!.stageIndex!] : undefined;
  if (scope === 'stage' && !selectedStage) throw new Error('所选阶段索引超出已有阶段范围。');
  const stages = scope === 'natal' ? [] : selectedStage ? [selectedStage] : data.stages;
  const dynamic = scope === 'natal' ? [] : (data.dynamicFacts ?? []).filter((fact) => !selectedStage || fact.stageIndices.includes(selectedStage.stageIndex));
  const dynamicText = dynamic.map((fact) => {
    const dates = selectedStage ? fact.dates?.filter((date) => date.stageIndices.includes(selectedStage.stageIndex)) : fact.dates;
    const when = fact.interval ? `${new Date(fact.interval.startTimestamp).toISOString()} 至 ${new Date(fact.interval.endTimestamp).toISOString()}（起点含、终点不含）` : fact.dateTime ? `当地交节：${fact.dateTime}；实际瞬时 ${new Date(fact.timestamp!).toISOString()}` : '';
    const dateDetails = dates?.length ? options?.detailMode === 'full'
      ? `命中日期（当地公历日）：${dates.map((date) => `${date.date} ${date.ganzhi}［阶段${date.stageIndices.join('、') || '无'}］`).join('；')}`
      : `命中 ${dates.length} 个当地公历日，首日 ${dates[0].date}，末日 ${dates[dates.length - 1].date}；完整日期见结构化结果，可使用 full 输出。`
      : '';
    return [`${fact.label}｜涉及阶段 ${fact.stageIndices.join('、') || '未落入已列阶段'}${when ? `｜${when}` : ''}`, ...fact.details,
      fact.supports.length ? `支持：${fact.supports.join('；')}` : '', fact.constraints.length ? `制约：${fact.constraints.join('；')}` : '', dateDetails].filter(Boolean).join('\n');
  });
  const isFullDetail = options?.detailMode === 'full';
  const stageModelNames: Record<string, string> = {
    decadalGanzhi: '十年大运干支',
    pillarFourLimits: '四柱四限',
    palaceWalk: '九宫游年',
    fushiAlternating: '符使交替',
  };
  const stageLimitations = [...new Set(stages.flatMap((stage) => stage.limitations))];
  const stageText = stages.map((stage) => {
    const precise = 'startDateTime' in stage && typeof stage.startDateTime === 'string' && 'endDateTimeExclusive' in stage && typeof stage.endDateTimeExclusive === 'string'
      ? isFullDetail
        ? `精确区间：${stage.startDateTime} 至 ${stage.endDateTimeExclusive}（起点含、终点不含）`
        : `${stage.startDateTime.slice(0, 4)}–${stage.endDateTimeExclusive.slice(0, 4)}年`
      : `日期：${stage.calendarStart} 至 ${stage.calendarEnd}（含两端）`;
    const isDecadal = data.basis.stagePolicy.model === 'decadalGanzhi';
    const supports = isFullDetail
      ? stage.supportFacts
      : [...new Set(stage.supportFacts.map(compactStageFact))];
    const constraints = isFullDetail
      ? stage.constraintFacts
      : [...new Set(stage.constraintFacts.map(compactStageFact))];
    if (!isFullDetail) {
      const assoc = stage.associatedMarkers.join('、') || `主导宫：${stage.dominantPalaces.map((p) => p.name).join('、') || '无'}`;
      return [
        `${stage.stageIndex}｜${stage.title}（${stage.ageStart}–${stage.ageEnd}岁，${precise}）：${assoc}`,
        !isDecadal && stage.stageTheme ? stage.stageTheme : '',
        supports.length ? `支持：${supports.join('、')}` : '',
        constraints.length ? `制约：${constraints.join('、')}` : '',
      ].filter(Boolean).join('；');
    }
    return [`${stage.stageIndex}｜${stage.title}｜${stage.ageStart}–${stage.ageEnd}岁｜${precise}`,
      `主导宫：${stage.dominantPalaces.map((p) => p.name).join('、') || '无'}；关联：${stage.associatedMarkers.join('、') || '无'}`,
      stage.stageTheme,
      supports.length ? `支持：${supports.join('；')}` : '',
      constraints.length ? `制约：${constraints.join('；')}` : ''].filter(Boolean).join('\n');
  });
  const topicText = data.topicCandidates.map((topic) => [
    `${topic.topicName}：主宫 ${topic.primaryPalaces.join('、') || '无'}；辅宫 ${topic.secondaryPalaces.join('、') || '无'}。${topic.basis}`,
    ...(isFullDetail ? topic.patternSummary : []),
    ...(topic.alternatives?.map((item) => `${item.rule === 'male' ? '男取法' : '女取法'}：主宫 ${item.primaryPalaces.join('、') || '无'}；辅宫 ${item.secondaryPalaces.join('、') || '无'}`) ?? []),
  ].join('\n'));
  const starDoorStateLine = buildQimenStarDoorStateSummary(data.baseChart);
  const concisePatterns = isFullDetail
    ? [...new Set(evidence.patternFacts.filter((fact) => fact.kind !== '复合格局').map((fact) => fact.promptText))]
    : data.baseChart.patternTags?.length
      ? [`全局格局标签：${data.baseChart.patternTags.join('、')}`]
      : [];
  const patternRelationsText = formatQimenPatternRelations(data.baseChart);
  const filteredCounters = evidence.counterEvidenceFacts
    .map((fact) => fact.promptText)
    .filter((text) => isFullDetail || !/同宫，宜防阻力、口舌或反复。$/u.test(text));
  const setupRuleLine = evidence.ruleSourceFacts[0]?.promptText ?? '';
  const schools = [...new Set(options?.schools ?? [])].map((id) => `${reference.schools[id].label}：${reference.schools[id].task}\n依据：${reference.schools[id].basis}`);
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}；适用条件：${item.application}`) : [];
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectQimenClassics({
          zhiFu: data.baseChart.zhiFu,
          zhiShi: data.baseChart.zhiShi,
          deities: data.baseChart.jiuGongGe.map((gong) => gong.shenPan.god).filter(Boolean),
          stemPairs: data.baseChart.jiuGongGe.flatMap((gong) => [
            `${gong.tianPan.stem}${gong.diPan.stem}`,
            ...(gong.tianPan.companionStem ? [`${gong.tianPan.companionStem}${gong.diPan.stem}`] : []),
          ]),
        }),
        '典籍片段',
      )
    : '';
  const localClock = new Date(data.baseChart.timestamp + data.basis.timezone * 3_600_000).toISOString().slice(0, 19);
  const sections = [
    data.birthRange ? `【出生时间范围】\n完整范围：${new Date(data.birthRange.startTimestamp).toISOString()} 至 ${new Date(data.birthRange.endTimestamp).toISOString()}（起点含、终点不含）。本次仅计算第 ${data.birthRange.index + 1} 个候选秒，共 ${data.birthRange.totalSamples} 个；候选实际时刻：${new Date(data.birthRange.timestamp).toISOString()}。${data.birthRange.nextIndex === null ? '已到最后一个候选秒。' : `下一候选索引：${data.birthRange.nextIndex}。`} 每个候选秒可能产生不同盘面和交运时刻，不把本次结果当作整个出生区间的确定结论。` : '',
    `【奇门终身局基础盘】\n${data.input.name ? `称谓：${data.input.name}；` : ''}${data.input.gender === 'male' ? '性别：男；' : data.input.gender === 'female' ? '性别：女；' : ''}出生当地公历钟表：${data.basis.localDateTime}；时区：${data.basis.timeZoneId ?? `UTC${data.basis.timezone >= 0 ? '+' : ''}${data.basis.timezone}`}；真实出生瞬时：${new Date(data.basis.birthTimestamp).toISOString()}。${data.basis.timeStandard === 'true-solar' ? `真太阳时钟表：${localClock}；经度：${data.basis.longitude}°；相对当地民用时间修正：${data.basis.totalCorrectionMinutes?.toFixed(3)} 分钟。` : '日时按当地民用时间。'} 年月与交节按真实瞬时；提示词时间：${now}。`,
    data.baseChart.seasonality?.lunarDateWarning ? `【历法差异】\n${data.baseChart.seasonality.lunarDateWarning}` : '',
    `【起局与规则】\n${evidence.calculationEvidenceFacts.map((fact) => fact.promptText).join('；')}${setupRuleLine ? `\n${setupRuleLine}` : ''}`,
    `【九宫】\n${evidence.palaceFacts.map((fact) => fact.promptText).join('\n')}${starDoorStateLine ? `\n${starDoorStateLine}` : ''}`,
    concisePatterns.length ? `【盘面格局】\n${concisePatterns.join('\n')}` : '',
    `【格局叠加与吉凶制衡关系】\n${patternRelationsText}`,
    evidence.relations.length ? `【候选宫间关系】\n${evidence.relations.map((fact) => fact.promptText).join('；')}` : '',
    filteredCounters.length ? `【反证】\n${filteredCounters.join('；')}` : '',
    `【个人标记】\n${data.personalMarkers.map((marker) => `${marker.palaceName}：${marker.traditionalSignificance}`).join('\n')}`,
    topicText.length ? `【人生主题候选宫】\n${topicText.join('\n')}` : '',
    stages.length ? `【阶段运限】\n模型：${stageModelNames[data.basis.stagePolicy.model] ?? data.basis.stagePolicy.model}；${data.basis.decadalLuck ? `${data.basis.decadalLuck.rule}\n${data.basis.decadalLuck.mapping}` : '阶段为所选模型的时间划分。'}\n${stageText.join(isFullDetail ? '\n\n' : '\n')}${stageLimitations.length ? `\n${stageLimitations.join('\n')}` : ''}` : '',
    buildCompactQimenFortuneBlock(data, stages, question, now),
    data.input.periodRange && scope !== 'natal' ? `【动态时间事实】\n扫描当地公历日 ${data.input.periodRange.startDate} 至 ${data.input.periodRange.endDate}（含两端）；流年按立春准确分界，月建按交节瞬时定位，日支仅为日期级关系。${selectedStage ? '仅列与所选阶段相交的事实。' : ''}\n${dynamicText.length ? dynamicText.join('\n\n') : '所选范围内没有匹配的动态事实。'}` : '',
    schools.length ? `【解读口径】\n${schools.join('\n')}` : '', classics.length ? `【经典资料摘要】\n${classics.join('\n')}` : '', classicExcerpts,
    (() => {
      const digest = buildMethodSituationDigest('qimen-lifetime', data, question);
      return digest.length ? `【局势要点】\n${digest.join('\n')}` : '';
    })(),
    `【任务】\n围绕问题，先说明本命盘、标记和候选宫的实际依据；${stages.length ? '结合给出的阶段区间分别分析支持、制约与触发兑现条件，' : ''}区分盘面事实、传统取象和条件性推论。阶段分界不保证具体事件；${dynamicText.length ? '动态事实仅限所列立春分界、相冲月建和本命空马日支，不得虚构其他流月流日盘。' : '尚未提供适用的动态流年、流月或流日扫描，不得虚构其结果。'}`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const text = sections.join('\n\n');
  return { text };
}

export async function qimenLifetime(input: Input, now: string) {
  const { birth, birthRange, name, gender, method, juMethod, topics, stagePolicy, periodRange } = input;
  const data = await calculateLifetime({ birth, birthRange, name, gender, method, juMethod, topics, stagePolicy, periodRange });
  const summary = { title: '奇门终身局', tags: [`${data.baseChart.isYangDun ? '阳遁' : '阴遁'}${data.baseChart.juShu}局`, `${data.stages.length} 个阶段`], lines: [`出生时刻：${data.basis.localDateTime}`, ...(data.birthRange ? [`出生范围候选：第 ${data.birthRange.index + 1}/${data.birthRange.totalSamples} 个整秒`] : []), `阶段模型：${data.basis.stagePolicy.model}`, periodRange ? `动态范围：${periodRange.startDate} 至 ${periodRange.endDate}` : '可选指定动态扫描日期范围。', ...(data.baseChart.seasonality?.lunarDateWarning ? [data.baseChart.seasonality.lunarDateWarning] : [])] };
  return { data, summary, prompt: render(data, input.question, input.prompt, now) };
}

export async function promptForQimenLifetime(data: unknown, savedInput: LifetimeInput, question: string, options: Options, now: string) {
  const expected = await calculateLifetime(savedInput);
  if (!sameJsonValue(data, expected)) throw new Error('奇门终身局结果与出生资料和计算规则不一致。');
  return render(expected, question, options, now);
}
