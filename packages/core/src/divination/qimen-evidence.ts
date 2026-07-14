import type { QimenData, QimenJiuGongGe } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type QimenCandidateSource =
  '值符落宫' | '值使落宫' | '日干落宫' | '时干落宫' | '盘面洞察' | '经典格局';

export interface QimenPalaceEvidence {
  gong: number;
  name: string;
  direction: string;
  element: string;
  sources: QimenCandidateSource[];
  palace: QimenJiuGongGe;
  patterns: string[];
  stemRelations: string[];
  support: string[];
  constraints: string[];
  isVoid: boolean;
  hasHorse: boolean;
}

export interface QimenPalaceRelationEvidence {
  from: string;
  to: string;
  relation: string;
  meaning: string;
}

export interface QimenEvidenceAnalysis {
  calculationFacts: string[];
  ruleSources: string[];
  candidates: QimenPalaceEvidence[];
  relations: QimenPalaceRelationEvidence[];
  counterEvidence: string[];
  timingConditions: string[];
  directionConditions: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const GENERATING: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLLING: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function describeRelation(from: QimenJiuGongGe, to: QimenJiuGongGe) {
  if (from.element === to.element) {
    return {
      relation: '比和',
      meaning: `${from.name}与${to.name}同属${from.element}，可作同类并行证据`,
    };
  }
  if (GENERATING[from.element] === to.element) {
    return {
      relation: '前宫生后宫',
      meaning: `${from.name}${from.element}生${to.name}${to.element}`,
    };
  }
  if (GENERATING[to.element] === from.element) {
    return {
      relation: '后宫生前宫',
      meaning: `${to.name}${to.element}生${from.name}${from.element}`,
    };
  }
  if (CONTROLLING[from.element] === to.element) {
    return {
      relation: '前宫克后宫',
      meaning: `${from.name}${from.element}克${to.name}${to.element}`,
    };
  }
  if (CONTROLLING[to.element] === from.element) {
    return {
      relation: '后宫克前宫',
      meaning: `${to.name}${to.element}克${from.name}${from.element}`,
    };
  }
  return { relation: '关系待核验', meaning: `${from.name}与${to.name}的宫间关系未能归类` };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const SCOPE_LABELS = {
  hour: '时家奇门',
  day: '日家奇门',
  month: '月家奇门',
  year: '年家奇门',
} as const;

function getActiveGanZhi(data: QimenData): string {
  switch (data.scope) {
    case 'year':
      return data.ganzhi.year;
    case 'month':
      return data.ganzhi.month;
    case 'day':
      return data.ganzhi.day;
    default:
      return data.ganzhi.hour;
  }
}

function collectCandidateSources(data: QimenData) {
  const sourceMap = new Map<number, QimenCandidateSource[]>();
  const add = (gong: number | undefined, source: QimenCandidateSource) => {
    if (gong === undefined) return;
    sourceMap.set(gong, unique([...(sourceMap.get(gong) ?? []), source]) as QimenCandidateSource[]);
  };
  const dayStem = data.ganzhi.day.charAt(0);
  const hourStem = data.ganzhi.hour.charAt(0);
  data.jiuGongGe.forEach((palace) => {
    if (palace.tianPan.star === data.zhiFu) add(palace.gong, '值符落宫');
    if (palace.renPan.door === data.zhiShi) add(palace.gong, '值使落宫');
    if (palace.tianPan.stem === dayStem || palace.diPan.stem === dayStem)
      add(palace.gong, '日干落宫');
    if (palace.tianPan.stem === hourStem || palace.diPan.stem === hourStem)
      add(palace.gong, '时干落宫');
  });
  data.palaceInsights?.forEach((item) => add(item.gong, '盘面洞察'));
  data.classicPatterns?.forEach((item) => item.palaces.forEach((gong) => add(gong, '经典格局')));
  return sourceMap;
}

function buildPalaceEvidence(
  data: QimenData,
  palace: QimenJiuGongGe,
  sources: QimenCandidateSource[],
): QimenPalaceEvidence {
  const isVoid = Boolean(data.voidPalaces?.some((item) => item.palace === palace.gong));
  const hasHorse = data.horseStar?.palace === palace.gong;
  const patterns = unique([
    ...(data.classicPatterns ?? [])
      .filter((item) => item.palaces.includes(palace.gong))
      .map((item) => `${item.name}：${item.summary}`),
    ...(data.patternCombos ?? [])
      .filter((item) => item.palace === palace.gong)
      .map((item) => `${item.name}：${item.summary}`),
  ]);
  const stemRelations = unique(
    (data.stemRelations ?? [])
      .filter((item) => item.gong === palace.gong)
      .map(
        (item) =>
          `${item.heavenStem}临${item.earthStem}为${item.relation}${item.pattern ? `，见${item.pattern}` : ''}`,
      ),
  );
  const insights = (data.palaceInsights ?? []).filter((item) => item.gong === palace.gong);
  const support = unique([
    ...insights.filter((item) => item.level === '有利').map((item) => item.summary),
    ...patterns.filter((item) => !/凶|迫|刑|墓|逃|猖狂|投江|夭矫|入荧|大格|小格/.test(item)),
    hasHorse ? '马星同宫，具移动、变动或外部推动信号' : '',
  ]);
  const constraints = unique([
    isVoid ? '宫位逢空，相关信息可能尚未落实，须等待现实条件或填实信号复核' : '',
    ...insights.filter((item) => item.level === '风险').map((item) => item.summary),
    ...patterns.filter((item) => /凶|迫|刑|墓|逃|猖狂|投江|夭矫|入荧|大格|小格/.test(item)),
    ...(data.specialConditions?.description ? [data.specialConditions.description] : []),
  ]);
  return {
    gong: palace.gong,
    name: palace.name,
    direction: palace.direction,
    element: palace.element,
    sources,
    palace,
    patterns,
    stemRelations,
    support,
    constraints,
    isVoid,
    hasHorse,
  };
}

export function analyzeQimenEvidence(data: QimenData): QimenEvidenceAnalysis {
  if (!data.jiuGongGe.length) {
    throw new Error('奇门证据分析至少需要一个宫位数据。');
  }
  const sourceMap = collectCandidateSources(data);
  const scope = data.scope ?? 'hour';
  const scopeLabel = SCOPE_LABELS[scope];
  const activeGanZhi = getActiveGanZhi(data);
  const zhiFuPalace = data.jiuGongGe.find((item) => item.tianPan.star === data.zhiFu);
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const calculationFacts = unique([
    `排盘范围：${scopeLabel}，以${activeGanZhi}作为本盘主动干支`,
    `定局结果：${data.timeInfo.solarTerm}${data.timeInfo.epoch}，${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局`,
    `值符定位：${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未检出'}`,
    `值使定位：${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未检出'}`,
    `四柱干支：年${data.ganzhi.year}、月${data.ganzhi.month}、日${data.ganzhi.day}、时${data.ganzhi.hour}`,
  ]);
  const ruleSources = unique([
    `${scopeLabel}定局规则：节气、三元与主动干支共同确定阴阳遁和局数`,
    '旬首值符值使规则：由主动干支、遁局和旬首体系定位值符星与值使门',
    '转盘九宫规则：门、星、神及天地盘干按同一局盘排列后逐宫核验',
    '五行生克规则：候选宫之间只按宫五行陈述比和、生、克关系',
  ]);
  const sourcePriority: QimenCandidateSource[] = [
    '值符落宫',
    '值使落宫',
    '日干落宫',
    '时干落宫',
    '盘面洞察',
    '经典格局',
  ];
  const candidates = Array.from(sourceMap.entries())
    .map(([gong, sources]) => {
      const palace = data.jiuGongGe.find((item) => item.gong === gong);
      return palace ? buildPalaceEvidence(data, palace, sources) : null;
    })
    .filter((item): item is QimenPalaceEvidence => Boolean(item))
    .sort((left, right) => {
      const leftPriority = Math.min(...left.sources.map((item) => sourcePriority.indexOf(item)));
      const rightPriority = Math.min(...right.sources.map((item) => sourcePriority.indexOf(item)));
      return leftPriority - rightPriority || left.gong - right.gong;
    });
  const primary = candidates[0];
  const relations = primary
    ? candidates.slice(1).map((candidate): QimenPalaceRelationEvidence => {
        const relation = describeRelation(primary.palace, candidate.palace);
        return { from: primary.name, to: candidate.name, ...relation };
      })
    : [];
  const counterEvidence = unique(candidates.flatMap((item) => item.constraints));
  const timingConditions = unique([
    ...(data.yingQi?.triggerConditions ?? []),
    ...(data.voidPalaces?.length
      ? [
          `逢空宫位${unique(data.voidPalaces.map((item) => item.name)).join('、')}须先观察填实或现实条件落实`,
        ]
      : []),
    ...(data.horseStar
      ? [`马星落${data.horseStar.name}，以实际移动、变动或外部推动作为触发验证`]
      : []),
    ...(data.patternTags?.some((item) => item.includes('伏吟'))
      ? ['伏吟只提示节奏可能偏静或重复，须由现实进展复核']
      : []),
    ...(data.patternTags?.some((item) => item.includes('反吟'))
      ? ['反吟只提示变化或反复信号，须由现实事件复核']
      : []),
    ...(data.yingQi?.limitations ?? []),
    '未给目标期限时不把宫数、局数或盘内快慢换算成唯一日期',
  ]);
  const directionConditions = candidates
    .slice(0, 4)
    .map(
      (item) =>
        `${item.direction}${item.name}来自${item.sources.join('、')}；方位仅在现实路线、安全和事项用神均匹配时采用`,
    );
  const patternItems: PromptEvidenceItem[] = (data.patternCombos ?? []).map(
    (pattern): PromptEvidenceItem => ({
      level: pattern.tone === 'super-bad' ? '反证' : '辅证',
      title: `复合格局：${pattern.name}`,
      detail: `${pattern.summary}；组成来源：${pattern.sources.join('、') || '未列明'}`,
      source: '复合格局规则命中链',
      tags: ['复合格局', pattern.tone, ...(pattern.palace ? [`${pattern.palace}宫`] : [])],
    }),
  );
  const relationItems: PromptEvidenceItem[] = relations.map((item) => ({
    level: '辅证',
    title: `${item.from}与${item.to}宫间作用`,
    detail: `${item.relation}；${item.meaning}`,
    source: '候选宫五行生克关系',
    tags: ['宫间关系', item.relation, item.from, item.to],
  }));
  const counterItems: PromptEvidenceItem[] = counterEvidence.map((detail, index) => ({
    level: '反证',
    title: `奇门限制核验${index + 1}`,
    detail,
    source: '空亡、特殊条件、风险洞察与格局限制逐项汇总',
    tags: ['反证', '风险限制'],
  }));
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '定局计算事实',
      detail: calculationFacts.join('；'),
      source: ruleSources.slice(0, 2).join('；'),
      tags: [scopeLabel, data.isYangDun ? '阳遁' : '阴遁', `${data.juShu}局`],
    },
    {
      level: '主证',
      title: '值符值使定位事实',
      detail: `${calculationFacts[2]}；${calculationFacts[3]}。这是盘面中心定位事实，不自动等同于事项吉凶。`,
      source: ruleSources[1],
      tags: ['值符', '值使', data.zhiFu, data.zhiShi],
    },
    ...candidates.slice(0, 6).map((item, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${item.name}用神宫候选`,
      detail: `候选来源${item.sources.join('、')}；门${item.palace.renPan.door}、星${item.palace.tianPan.star}、神${item.palace.shenPan.god}、天盘${item.palace.tianPan.stem}、地盘${item.palace.diPan.stem}；天地盘干${item.stemRelations.join('、') || '未见另列特殊关系'}；格局${item.patterns.join('、') || '未见另列格局'}；支持${item.support.join('、') || '未见独立增强证据'}；限制${item.constraints.join('、') || '未见空亡或明确风险标签'}`,
      source: '值符、值使、日干、时干及九宫门星神干逐项定位',
      tags: [item.name, ...item.sources],
    })),
    ...patternItems,
    ...relationItems,
    ...counterItems,
    ...(data.seasonality
      ? [
          {
            level: '辅证' as const,
            title: '节令与四柱背景事实',
            detail: `${data.seasonality.currentJieQi}${data.seasonality.jieQiPhase.phase}；季节五行${data.seasonality.seasonalElement}；日干${data.seasonality.dayStem}属${data.seasonality.dayElement}，${data.seasonality.seasonRelationDescription}；月相${data.seasonality.lunarPhase}（${data.seasonality.lunarPhaseDetail}）；建除${data.seasonality.dayOfficer}（${data.seasonality.dayOfficerFortuneLabel}）；四柱互动${data.seasonality.ganzhiInteractions.map((item) => item.description).join('、') || '未检出明确合冲刑害'}`,
            source: '节气历表、月相证据、建除规则与四柱关系逐项计算',
            tags: ['节令', '月相', '建除', '四柱互动'],
          },
        ]
      : []),
    {
      level: '应期',
      title: '应期触发与验证条件',
      detail: timingConditions.join('；'),
      source: `盘内相对节奏${data.yingQi ? `为${data.yingQi.rhythm}` : '未单列'}；仅保留触发条件和限制`,
      tags: ['应期', '触发条件', '不换算固定日期'],
    },
    {
      level: '辅证',
      title: '候选方位使用条件',
      detail: directionConditions.join('；') || '未定位候选方位，须结合现实路线与安全条件',
      source: '候选宫方位与来源映射',
      tags: ['方位', '现实条件'],
    },
    {
      level: '限制',
      title: '奇门用神与方位解释边界',
      detail:
        '以上宫位均为盘面候选，不等于已经按具体问题选定用神。宫位排序不得替代门、星、神、天地盘干、旺衰、空亡、入墓、击刑和门迫的逐项判断；方位和时间只给条件，不输出吉凶总分、成功率或绝对日期。',
      source: '计算事实与解释结论分离原则',
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '奇门用神宫与宫间作用结构化证据', items };
  const promptText = [
    '【奇门用神宫与宫间作用结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `触发条件：${timingConditions.join('；')}`,
  ].join('\n');
  return {
    calculationFacts,
    ruleSources,
    candidates,
    relations,
    counterEvidence,
    timingConditions,
    directionConditions,
    evidence,
    promptText,
    methodology: [
      '先定位值符、值使、日干和时干落宫，再补充盘面洞察与经典格局候选。',
      '逐宫保留门、星、神、天地盘干、空亡、马星、格局、支持与限制。',
      '定局、值符值使、复合格局来源、宫间作用、应期和方位条件全部进入统一证据条目。',
      '候选宫之间只陈述可复核的五行生克关系，不用数字分数代替判断。',
      '未按问题选定用神时明确保留候选性质，不输出吉凶总分、成功率或绝对日期。',
    ],
  };
}
