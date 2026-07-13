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
  const items: PromptEvidenceItem[] = [
    ...candidates.slice(0, 6).map((item, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${item.name}用神宫候选`,
      detail: `候选来源${item.sources.join('、')}；门${item.palace.renPan.door}、星${item.palace.tianPan.star}、神${item.palace.shenPan.god}、天盘${item.palace.tianPan.stem}、地盘${item.palace.diPan.stem}；天地盘干${item.stemRelations.join('、') || '未见另列特殊关系'}；支持${item.support.join('、') || '未见独立增强证据'}；限制${item.constraints.join('、') || '未见空亡或明确风险标签'}`,
      source: '值符、值使、日干、时干及九宫门星神干逐项定位',
      weight: 100 - index,
      tags: [item.name, ...item.sources],
    })),
    {
      level: '限制',
      title: '奇门用神与方位解释边界',
      detail:
        '以上宫位均为盘面候选，不等于已经按具体问题选定用神。宫位排序不得替代门、星、神、天地盘干、旺衰、空亡、入墓、击刑和门迫的逐项判断；方位和时间只给条件，不输出吉凶总分、成功率或绝对日期。',
      source: '计算事实与解释结论分离原则',
      weight: 120,
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '奇门用神宫与宫间作用结构化证据', items };
  const promptText = [
    '【奇门用神宫与宫间作用结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `宫间关系：${relations.map((item) => `${item.from}→${item.to}为${item.relation}，${item.meaning}`).join('；') || '候选宫不足，暂不比较宫间生克'}`,
    `反证限制：${counterEvidence.join('；') || '未见明确空亡或风险标签，仍须按问题选定用神'}`,
    `触发条件：${timingConditions.join('；')}`,
    `方位条件：${directionConditions.join('；') || '未定位候选方位，须结合现实路线与安全条件'}`,
  ].join('\n');
  return {
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
      '候选宫之间只陈述可复核的五行生克关系，不用数字分数代替判断。',
      '未按问题选定用神时明确保留候选性质，不输出吉凶总分、成功率或绝对日期。',
    ],
  };
}
