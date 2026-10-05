/**
 * @file 奇门终身局自包含提示词生成器
 * @description 遵循 AGENTS.md 规范，生成供在线 AI 解读的自包含完整任务书，
 * 严禁暴露内部工程术语、代码路径、字段键名或否定性限制。
 */

import type { QimenLifetimeData } from '../../../../types/divination';
import { TimeManager } from '../../../../calendar/timeManager';
import { QIMEN_IMAGE_INTERPRETATION_TASK } from '../../../../prompt/qimen-interpretation';
import { buildPromptTask } from '../../../../prompt/guidance';
import {
  formatQimenClassicPatternBasisForPrompt,
  formatQimenClassicPatternSummary,
  selectQimenClassicPatternsForPrompt,
} from '../../../qimen-evidence';

type TriggerDate = NonNullable<
  NonNullable<QimenLifetimeData['eventClusters']>[number]['triggerDates']
>[number];

export function formatLifetimePatternSummary(name: string, summary: string): string {
  return formatQimenClassicPatternSummary(name, summary);
}

function formatTriggerDate(item: TriggerDate): string {
  const detail = [item.ganzhi, item.relation].filter(Boolean).join('，');
  return detail ? `${item.dateTime ?? item.date}（${detail}）` : (item.dateTime ?? item.date);
}

function formatTriggerDates(items: TriggerDate[]): string[] {
  type DateGroup = { month: string; relation: string; entries: string[] };
  type Output = { kind: 'group'; group: DateGroup } | { kind: 'single'; text: string };

  const outputs: Output[] = [];
  const groups = new Map<string, DateGroup>();
  for (const item of items) {
    if (!item.dateTime && item.ganzhi && item.relation && /^\d{4}-\d{2}-\d{2}$/u.test(item.date)) {
      const month = item.date.slice(0, 7);
      const key = `${month}|${item.relation}`;
      let group = groups.get(key);
      if (!group) {
        group = { month, relation: item.relation, entries: [] };
        groups.set(key, group);
        outputs.push({ kind: 'group', group });
      }
      group.entries.push(`${item.date.slice(8, 10)}日（${item.ganzhi}）`);
    } else {
      outputs.push({ kind: 'single', text: formatTriggerDate(item) });
    }
  }

  return outputs.map((output) => {
    if (output.kind === 'single') return `  可复核日期：${output.text}`;
    const [year, month] = output.group.month.split('-');
    return `  可复核日期：${year}年${month}月${output.group.entries.join('、')}；日干支关系：${output.group.relation}`;
  });
}

function formatDailyTriggerDates(items: TriggerDate[]): string[] {
  const isCompactable = items.every(
    (item) =>
      !item.dateTime && item.ganzhi && item.relation && /^\d{4}-\d{2}-\d{2}$/u.test(item.date),
  );
  const relations = [...new Set(items.map((item) => item.relation).filter(Boolean))];
  if (!isCompactable || relations.length !== 1) return formatTriggerDates(items);

  const datesByGanzhi = new Map<string, string[]>();
  for (const item of items) {
    const dates = datesByGanzhi.get(item.ganzhi!) ?? [];
    dates.push(item.date);
    datesByGanzhi.set(item.ganzhi!, dates);
  }
  const entries = [...datesByGanzhi].map(([ganzhi, dates]) => `${ganzhi}：${dates.join('、')}`);

  return [`  可复核日期：${entries.join('；')}；日干支关系：${relations[0]}`];
}

function formatDailyVoidFillSummary(data: QimenLifetimeData): string {
  const clusters = (data.eventClusters ?? []).filter((item) =>
    item.key.includes(':day:void-fill:'),
  );
  const branches = data.baseChart.voidBranches ?? [];
  const dates = [
    ...new Set(clusters.flatMap((item) => item.triggerDates ?? []).map((item) => item.date)),
  ].sort();
  if (branches.length === 0 || dates.length === 0) return '';
  const startDate = data.input.periodRange?.startDate ?? dates[0]!;
  const endDate = data.input.periodRange?.endDate ?? dates.at(-1)!;
  return `日级空亡填实条件：日支逢本命旬空地支${branches.join('、')}；核验范围${startDate}至${endDate}，各年符合条件的日数见下。`;
}

/**
 * 构建终身局自包含提示词任务书
 */
export type LifetimePromptOptions = {
  includeCurrentTime?: boolean;
};

export function buildLifetimePrompt(
  data: QimenLifetimeData,
  question?: string,
  options: LifetimePromptOptions = {},
): string {
  const lines: string[] = [];
  const q = question?.trim() || '请全面推演我的人生宏观格局、核心阶段运限与关键转折窗口。';

  // 1. 【当前时间】
  if (options.includeCurrentTime !== false) {
    const now = TimeManager.getWallClockParts(new Date(), 480);
    const nowStr = `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
    lines.push(`【当前时间】`);
    lines.push(`${nowStr}（UTC+08:00）\n`);
  }

  // 2. 【传统依据】
  lines.push(`【传统依据】`);
  const baseTradition = [
    '奇门终身局以本次年命、日干和时干落宫为个人标记，结合门、星、神、天地盘干、宫间生克与格局解释人生主题。',
    '本命为根，阶段运限按所列起止与行限口径展开，流年引动结合本命及所属阶段共同判断；同一象意在不同时间层级分别取证。',
  ];

  const schoolNotes: Record<string, string> = {
    baojian: '《御定奇门宝鉴》取向：结合星门、奇仪、宫位生克与格局条件推演。',
    tongzong: '《奇门遁甲统宗》取向：围绕年命与个人标记落宫，结合各宫奇仪生克解释人事关系。',
    mingfa: '《奇门鸣法》取向：结合本次九宫、符使与动静关系推演。',
    yubo: '《烟波钓叟歌》取向：结合九星八门、奇仪格局与主客动静推演。',
  };

  if (data.input.schools && data.input.schools.length > 0) {
    for (const sc of data.input.schools) {
      if (schoolNotes[sc] && !baseTradition.includes(schoolNotes[sc])) {
        baseTradition.push(schoolNotes[sc]);
      }
    }
  }

  lines.push(`${baseTradition.join('\n')}\n`);

  // 3. 【起盘依据】
  lines.push(`【起盘依据】`);
  if (data.birthRange) {
    const range = data.birthRange;
    const wallClock = (timestamp: number) =>
      new Date(timestamp + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    lines.push(
      `出生候选范围：北京时间 ${wallClock(range.source.startTimestamp)} 至 ${wallClock(range.source.endTimestamp)}（起点含、终点不含）。`,
    );
    lines.push(
      `本册候选时刻：北京时间 ${wallClock(range.timestamp)}；第${range.index + 1}个整秒，共${range.totalSamples}个整秒。`,
    );
    lines.push('本册盘面、阶段起止和动态事实均以所列候选时刻为条件，完整出生范围按整秒分别核验。');
  } else {
    lines.push(`出生时刻：${data.input.birthDateTime}`);
  }
  lines.push(`出生时区：${data.basis.timeZoneUsed}`);
  lines.push(`历法口径：${data.basis.calendar}`);
  lines.push(
    `时间标准：${data.basis.timeStandard}${data.basis.trueSolarOffsetSeconds !== undefined ? `（经度时差与均时差校正 ${data.basis.trueSolarOffsetSeconds} 秒）` : ''}`,
  );
  lines.push(`当令节气：${data.basis.solarTerm}`);
  lines.push(
    `排盘方法：${data.basis.method === 'zhuanpan' ? '转盘法（天禽寄坤二宫）' : '飞盘法（九星顺逆飞布）'}`,
  );
  lines.push(`定局法则：${data.basis.juMethod === 'chaibu' ? '拆补法' : '置闰法'}`);
  lines.push(
    `阶段模型：${data.basis.stagePolicy.model === 'pillarFourLimits' ? '传统四柱分限法（年柱初限、月柱中前限、日柱中后限、时柱末限）' : data.basis.stagePolicy.model === 'palaceWalk' ? '洛书九宫巡行法' : data.basis.stagePolicy.model === 'decadalGanzhi' ? '十年干支大运（八字交节起运合参奇门本命宫）' : '符使交替十年分段'}`,
  );
  if (data.basis.decadalLuck) {
    const luck = data.basis.decadalLuck;
    const age = luck.startAge;
    lines.push(
      `起运：出生后${age.years}年${age.months}月${age.days}日${age.hours}时${age.minutes}分，${luck.startDateTime}交第一运，${luck.direction === 'forward' ? '顺行' : '逆行'}。`,
    );
    lines.push(`起运口径：${luck.rule}`, `定位口径：${luck.mapping}`);
    lines.push('年龄为整岁展示，阶段归属以精确交运时间为准；交运年与交运日结合前后两运分别解读。');
  }
  if (data.input.schools && data.input.schools.length > 0) {
    const schoolLabels: Record<string, string> = {
      baojian: '宝鉴派',
      tongzong: '统宗派',
      mingfa: '鸣法派',
      yubo: '钓叟歌理路',
    };
    lines.push(`参考流派：${data.input.schools.map((s) => schoolLabels[s] || s).join('、')}`);
  }
  lines.push('');

  // 4. 【终身局基础盘】
  lines.push(`【终身局基础盘】`);
  lines.push(
    `四柱干支：${data.baseChart.ganzhi.year}年 ${data.baseChart.ganzhi.month}月 ${data.baseChart.ganzhi.day}日 ${data.baseChart.ganzhi.hour}时`,
  );
  lines.push(`遁局属性：${data.baseChart.isYangDun ? '阳遁' : '阴遁'} ${data.baseChart.juShu} 局`);
  lines.push(`值符星：${data.baseChart.zhiFu} | 值使门：${data.baseChart.zhiShi}`);
  if (data.baseChart.voidBranches && data.baseChart.voidBranches.length > 0) {
    lines.push(`旬空地支：${data.baseChart.voidBranches.join('、')}`);
  }
  if (data.baseChart.horseStar) {
    lines.push(
      `驿马星：${data.baseChart.horseStar.branch}（在${data.baseChart.horseStar.name || `${data.baseChart.horseStar.palace}宫`}）`,
    );
  }

  lines.push(`九宫四盘明细：`);
  for (const p of data.baseChart.jiuGongGe) {
    const starText = p.tianPan.companionStar
      ? `${p.tianPan.star}（携${p.tianPan.companionStar}）`
      : p.tianPan.star;
    const stemText = p.tianPan.companionStem
      ? `${p.tianPan.stem}（携${p.tianPan.companionStem}）`
      : p.tianPan.stem;
    const isVoid = data.baseChart.voidPalaces?.some((vp) => vp.palace === p.gong);
    const hasHorse = data.baseChart.horseStar?.palace === p.gong;
    const flags: string[] = [];
    if (isVoid) flags.push('旬空');
    if (hasHorse) flags.push('临马');
    lines.push(
      `  ${p.name}（${p.element}）：天盘[${starText}，干${stemText}]，人盘[${p.renPan.door}]，神盘[${p.shenPan.god}]，地盘干[${p.diPan.stem}]${flags.length > 0 ? `【${flags.join('，')}】` : ''}`,
    );
  }

  const classicPatterns = data.baseChart.classicPatterns ?? [];
  const classicFacts =
    data.baseChart.evidenceAnalysis?.patternFacts.filter((fact) => fact.kind === '经典格局') ?? [];
  const visibleClassicPatterns = selectQimenClassicPatternsForPrompt(classicPatterns);
  if (visibleClassicPatterns.length > 0) {
    lines.push(`盘面吉凶格局：`);
    for (const cp of visibleClassicPatterns) {
      const parentName = cp.name.match(/^([日月星]奇得使)临吉门$/u)?.[1];
      const parentSummaries = parentName
        ? classicPatterns
            .filter(
              (pattern) =>
                pattern.name === parentName &&
                pattern.palaces.some((gong) => cp.palaces.includes(gong)),
            )
            .map((pattern) =>
              formatLifetimePatternSummary(pattern.name, pattern.summary).replace(/[；。]+$/u, ''),
            )
        : [];
      const summary = formatLifetimePatternSummary(cp.name, cp.summary);
      const fact = classicFacts.find(
        (item) =>
          item.name === cp.name &&
          item.originalText === cp.summary &&
          item.palaces.length === cp.palaces.length &&
          item.palaces.every((gong) => cp.palaces.includes(gong)),
      );
      const locationClause =
        summary.match(
          /^(?:天盘[乙丙丁戊己庚辛壬癸]加地盘[乙丙丁戊己庚辛壬癸]于[^，；]+|值符.+与值使.+同落[^，；]+)[，；]/u,
        )?.[0] ??
        ([
          '天遁',
          '地遁',
          '人遁',
          '神遁',
          '鬼遁',
          '龙遁',
          '虎遁',
          '风遁',
          '云遁',
          '真诈',
          '重诈',
          '休诈',
          '相佐',
        ].includes(cp.name)
          ? summary.match(/^[^，]+，/u)?.[0]
          : undefined);
      const locationAlreadyShown = Boolean(
        fact &&
        locationClause &&
        formatQimenClassicPatternBasisForPrompt(fact, classicFacts, data.baseChart) === cp.name,
      );
      const palaceName = locationAlreadyShown
        ? data.baseChart.jiuGongGe.find((palace) => palace.gong === cp.palaces[0])?.name
        : '';
      const remainingSummary = locationAlreadyShown
        ? summary.slice(locationClause!.length)
        : summary;
      const mergedSummary = [
        ...new Set([
          ...parentSummaries,
          parentSummaries.length
            ? remainingSummary
                .replace(`${parentName}又临吉门`, '同宫临')
                .replace(/，得门得使，双重吉利。?$/u, '')
            : remainingSummary,
        ]),
      ].join('；');
      lines.push(
        `  ${cp.name}（${cp.type === 'good' ? '吉' : cp.type === 'bad' ? '凶' : '中性'}${palaceName ? `，${palaceName}` : ''}）${mergedSummary ? `：${mergedSummary}` : ''}`,
      );
    }
  }
  lines.push('');

  // 5. 【个人标记与主题宫】
  lines.push(`【个人标记与主题宫】`);
  lines.push(`核心个人标记：`);
  const layerMap: Record<string, string> = {
    tianPan: '天盘',
    diPan: '地盘',
    renPan: '人盘',
    shenPan: '神盘',
    baseGong: '本宫',
  };
  for (const m of data.personalMarkers) {
    const layerText = layerMap[m.layer] || m.layer;
    lines.push(`  ${m.traditionalSignificance}：值临${m.palaceName}（${layerText}）`);
  }

  lines.push(`人生重点主题候选宫：`);
  for (const t of data.topicCandidates) {
    const pNames = t.primaryPalaces
      .map((g) => data.baseChart.jiuGongGe.find((item) => item.gong === g)?.name || `${g}宫`)
      .join('、');
    lines.push(`  ${t.topicName}：主落${pNames}。依据：${t.basis}`);
  }
  lines.push('');

  // 6. 【人生阶段资料】
  lines.push(`【人生阶段资料】`);
  const basePatternFacts = new Map<string, string>();
  const redundantStagePatternFacts = new Set<string>();
  for (const pattern of classicPatterns) {
    const label = pattern.type === 'good' ? '成吉格' : pattern.type === 'bad' ? '逢凶格' : '';
    if (label) {
      const fullFact = `${label}「${pattern.name}」：${pattern.summary}`;
      basePatternFacts.set(fullFact, `${label}「${pattern.name}」`);
      if (
        !visibleClassicPatterns.some(
          (visible) =>
            visible.name === pattern.name &&
            formatLifetimePatternSummary(visible.name, visible.summary) ===
              formatLifetimePatternSummary(pattern.name, pattern.summary),
        )
      ) {
        redundantStagePatternFacts.add(fullFact);
      }
    }
  }
  const formatStageFacts = (facts: string[]) =>
    [
      ...new Set(
        facts
          .filter((fact) => !redundantStagePatternFacts.has(fact))
          .map((fact) => basePatternFacts.get(fact) ?? fact),
      ),
    ].join('；');
  for (const st of data.stages) {
    const domNames = st.dominantPalaces.map((d) => d.name).join('、');
    lines.push(
      `阶段${st.stageIndex + 1}：${st.title}（${st.ageStart} - ${st.ageEnd} 岁 / ${st.calendarStart} ~ ${st.calendarEnd}）`,
    );
    lines.push(`  主导宫位：${domNames}`);
    lines.push(`  阶段核心主线：${st.stageTheme}`);
    if (st.startDateTime)
      lines.push(`  精确区间：${st.startDateTime}起，至${st.endDateTimeExclusive}前。`);
    if (st.ganzhi) lines.push(`  干支定位：${st.associatedMarkers.join('；')}`);
    const supportFacts = formatStageFacts(st.supportFacts);
    const constraintFacts = formatStageFacts(st.constraintFacts);
    if (supportFacts) {
      lines.push(`  宫位支持类象：${supportFacts}`);
    }
    if (constraintFacts) {
      lines.push(`  宫位制约类象：${constraintFacts}`);
    }
  }
  lines.push('');

  // 7. 【周期触发与事件簇】
  if (data.eventClusters && data.eventClusters.length > 0) {
    lines.push(`【周期触发与事件簇】`);
    const dailyVoidFillSummary = formatDailyVoidFillSummary(data);
    if (dailyVoidFillSummary) lines.push(dailyVoidFillSummary);
    for (const ec of data.eventClusters) {
      const triggerDates = ec.triggerDates ?? [];
      const isDailyRelation = ec.key.includes(':day:') && triggerDates.length > 0;
      const isDailyVoidFill = isDailyRelation && ec.key.includes(':day:void-fill:');
      const stageLabel = ec.stageIndices?.length
        ? `（涉及阶段${ec.stageIndices.map((index) => index + 1).join('、')}）`
        : ec.stageIndex === undefined
          ? '（阶段表范围外）'
          : `（涉及阶段${ec.stageIndex + 1}）`;
      if (ec.key.includes(':month-clash:')) {
        lines.push(`${ec.triggerFact}${stageLabel}（节奏：${ec.rhythm}）`);
        continue;
      }
      const annualLabel = /^(\d{4}年（[^）]+)）/u.exec(ec.timeSpan)?.[1];
      const annualPrefix = annualLabel ? `${annualLabel}太岁）` : undefined;
      const triggerFact =
        annualPrefix && ec.triggerFact.startsWith(annualPrefix)
          ? `太岁${ec.triggerFact.slice(annualPrefix.length)}`
          : ec.triggerFact;
      lines.push(
        `${ec.timeSpan}${stageLabel} ${isDailyRelation ? `共${triggerDates.length}个日辰` : triggerFact}（节奏：${ec.rhythm}）`,
      );
      if (triggerDates.length > 0 && !isDailyVoidFill) {
        lines.push(
          ...(isDailyRelation
            ? formatDailyTriggerDates(triggerDates)
            : formatTriggerDates(triggerDates)),
        );
      }
      if (
        !isDailyRelation &&
        !/^cluster:\d{4}:[^:]+:(?:(?:before|after)-lichun:)?\d+$/u.test(ec.key)
      ) {
        lines.push(`  动态交互：${ec.interactionAnalysis}`);
      }
      if (!isDailyRelation && ec.supportEvidence.length > 0) {
        lines.push(`  增益因素：${ec.supportEvidence.join('；')}`);
      }
      if (ec.counterEvidence.length > 0) {
        lines.push(`  制约因素：${ec.counterEvidence.join('；')}`);
      }
      if (
        !isDailyRelation &&
        !ec.key.includes(':month-clash:') &&
        ec.verificationQuestions.length > 0
      ) {
        lines.push(`  核验要点：${ec.verificationQuestions.join(' ')}`);
      }
    }
    lines.push('');
  }

  // 8. 【任务】
  lines.push(`【任务】`);
  lines.push(QIMEN_IMAGE_INTERPRETATION_TASK);
  lines.push(
    '终身局取象以本命为根，阶段与流年各用本层已列盘面；换象与造象分别说明适用的人生主题和时间层级。',
  );
  lines.push(
    buildPromptTask(
      '请依据奇门遁甲本命局、个人标记、阶段运限与事件动态推演终身格局与大限走向。先综述先天格局底色，再按人生阶段依次展开运限分析，最后结合流年触发窗口回答【问题】。阶段变化分别采用所列干支时段、交接日期与时间层级。',
      'qimen',
    ),
  );
  lines.push('');

  // 9. 【问题】
  lines.push(`【问题】`);
  lines.push(`${q}`);

  return lines.join('\n');
}
