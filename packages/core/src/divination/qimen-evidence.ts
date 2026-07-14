import type { QimenData, QimenJiuGongGe } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type QimenCandidateSource =
  '值符落宫' | '值使落宫' | '日干落宫' | '时干落宫' | '盘面洞察' | '经典格局';

export interface QimenPalaceEvidence {
  gong: number;
  palaceFactKey: string;
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

export interface QimenPalaceFact {
  key: string;
  gong: number;
  name: string;
  direction: string;
  element: string;
  tianPan: QimenJiuGongGe['tianPan'];
  diPan: QimenJiuGongGe['diPan'];
  renPan: QimenJiuGongGe['renPan'];
  shenPan: QimenJiuGongGe['shenPan'];
  candidateSources: QimenCandidateSource[];
  isVoid: boolean;
  voidBranches: string[];
  hasHorse: boolean;
  horseSourceBranch?: string;
  patterns: string[];
  stemRelations: string[];
  insights: Array<{
    level: '有利' | '风险' | '关注';
    promptText: string;
  }>;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只限定候选宫取证条件，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期';
}

export interface QimenPalaceRelationEvidence {
  from: string;
  to: string;
  relation: string;
  meaning: string;
}

export interface QimenPatternEvidenceFact {
  key: string;
  name: string;
  kind: '基础格局' | '经典格局' | '复合格局';
  traditionalTone: '有利' | '风险' | '中性' | '混合';
  originalText: string;
  promptText: string;
  palaces: number[];
  sources: string[];
  limitation: '传统格局命中只证明盘面满足项目规则，不是现实结果、吉凶分或事件概率';
}

export interface QimenEvidenceAnalysis {
  calculationFacts: string[];
  ruleSources: string[];
  palaceFacts: QimenPalaceFact[];
  candidates: QimenPalaceEvidence[];
  relations: QimenPalaceRelationEvidence[];
  patternFacts: QimenPatternEvidenceFact[];
  counterEvidence: string[];
  timingConditions: string[];
  directionConditions: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const PALACE_FACT_LIMITATION =
  '逐宫字段是奇门九宫门、星、神、天地盘干、空亡、马星与规则命中的计算事实，只限定候选宫取证条件，不单独证明现实吉凶、事件结果、人物意图、方位安全或固定应期' as const;

export function conditionQimenTraditionalText(text: string): string {
  return text
    .replace(/凶期百日而后或有舒情/g, '古籍另有具体日数说法，但不得据此输出固定日期')
    .replace(/百事吉昌/g, '传统象意偏向有利')
    .replace(/百事称心/g, '传统象意偏向顺遂')
    .replace(/百事顺遂/g, '传统象意偏向顺遂')
    .replace(/百事可为/g, '传统象意提示可具备推进条件')
    .replace(/凡百遂心/g, '传统象意偏向顺遂')
    .replace(/万事破伤/g, '传统象意提示多重阻碍')
    .replace(/万事皆屯/g, '传统象意提示事务易有停滞')
    .replace(/谋为成功/g, '谋事较有推进条件')
    .replace(/事成/g, '事情较有推进条件')
    .replace(/必然会/g, '可能会')
    .replace(/必然/g, '往往')
    .replace(/必定/g, '较可能')
    .replace(/大吉/g, '传统有利分类')
    .replace(/大凶/g, '传统风险分类')
    .replace(/(^|[，；。])主(?!(?:动|客|轴|证|判|要))/g, '$1传统象意提示')
    .replace(/古法主(?!(?:动|客))/g, '古法象意提示');
}

function buildPatternFacts(data: QimenData): QimenPatternEvidenceFact[] {
  const limitation = '传统格局命中只证明盘面满足项目规则，不是现实结果、吉凶分或事件概率' as const;
  const basicFacts = (data.patternDetails ?? []).map((item, index) => ({
    key: `basic:${index}:${item.tag}`,
    name: item.tag,
    kind: '基础格局' as const,
    traditionalTone: /迫|刑|墓|空|凶|反吟/.test(item.tag) ? ('风险' as const) : ('中性' as const),
    originalText: item.summary,
    promptText: conditionQimenTraditionalText(item.summary),
    palaces: [],
    sources: ['命语奇门基础格局标签与盘面规则命中结果'],
    limitation,
  }));
  const classicFacts = (data.classicPatterns ?? []).map((item, index) => ({
    key: `classic:${index}:${item.name}:${item.palaces.join('-')}`,
    name: item.name,
    kind: '经典格局' as const,
    traditionalTone:
      item.type === 'good'
        ? ('有利' as const)
        : item.type === 'bad'
          ? ('风险' as const)
          : ('中性' as const),
    originalText: item.summary,
    promptText: conditionQimenTraditionalText(item.summary),
    palaces: item.palaces,
    sources: ['命语奇门经典格局规则命中结果'],
    limitation,
  }));
  const comboFacts = (data.patternCombos ?? []).map((item) => ({
    key: item.key,
    name: item.name,
    kind: '复合格局' as const,
    traditionalTone:
      item.tone === 'super-good'
        ? ('有利' as const)
        : item.tone === 'super-bad'
          ? ('风险' as const)
          : ('混合' as const),
    originalText: item.summary,
    promptText: conditionQimenTraditionalText(item.summary),
    palaces: item.palace ? [item.palace] : [],
    sources: item.sources,
    limitation,
  }));

  return [...basicFacts, ...classicFacts, ...comboFacts];
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
  patternFacts: QimenPatternEvidenceFact[],
): QimenPalaceEvidence {
  const isVoid = Boolean(data.voidPalaces?.some((item) => item.palace === palace.gong));
  const hasHorse = data.horseStar?.palace === palace.gong;
  const patterns = unique(
    patternFacts
      .filter((item) => item.palaces.includes(palace.gong))
      .map((item) => `${item.name}：${item.promptText}`),
  );
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
    ...insights
      .filter((item) => item.level === '有利')
      .map((item) => conditionQimenTraditionalText(item.summary)),
    ...patterns.filter((item) => !/凶|迫|刑|墓|逃|猖狂|投江|夭矫|入荧|大格|小格/.test(item)),
    hasHorse ? '马星同宫，具移动、变动或外部推动信号' : '',
  ]);
  const constraints = unique([
    isVoid ? '宫位逢空，相关信息可能尚未落实，须等待现实条件或填实信号复核' : '',
    ...insights
      .filter((item) => item.level === '风险')
      .map((item) => conditionQimenTraditionalText(item.summary)),
    ...patterns.filter((item) => /凶|迫|刑|墓|逃|猖狂|投江|夭矫|入荧|大格|小格/.test(item)),
    ...(data.specialConditions?.description
      ? [conditionQimenTraditionalText(data.specialConditions.description)]
      : []),
  ]);
  return {
    gong: palace.gong,
    palaceFactKey: `九宫:${palace.gong}:${palace.name}`,
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

function buildPalaceFact(
  data: QimenData,
  palace: QimenJiuGongGe,
  candidateSources: QimenCandidateSource[],
  patternFacts: QimenPatternEvidenceFact[],
): QimenPalaceFact {
  const evidence = buildPalaceEvidence(data, palace, candidateSources, patternFacts);
  const globalSpecialCondition = data.specialConditions?.description
    ? conditionQimenTraditionalText(data.specialConditions.description)
    : '';
  const voidBranches = unique(
    (data.voidPalaces ?? [])
      .filter((item) => item.palace === palace.gong)
      .map((item) => item.branch),
  );
  const insights = (data.palaceInsights ?? [])
    .filter((item) => item.gong === palace.gong)
    .map((item) => ({
      level: item.level,
      promptText: conditionQimenTraditionalText(item.summary),
    }));
  const promptText = [
    `${palace.name}（${palace.direction}，五行${palace.element}）：天盘${palace.tianPan.stem || '无干'}${palace.tianPan.star || '无星'}，地盘${palace.diPan.stem || '无干'}，人盘${palace.renPan.door || '无门'}，神盘${palace.shenPan.god || '无神'}`,
    `组件索引门${palace.renPan.door || '无门'}、星${palace.tianPan.star || '无星'}、神${palace.shenPan.god || '无神'}、天盘${palace.tianPan.stem || '无干'}、地盘${palace.diPan.stem || '无干'}`,
    evidence.stemRelations.length ? `天地盘干${evidence.stemRelations.join('、')}` : '',
    evidence.patterns.length ? `规则命中${evidence.patterns.join('、')}` : '',
    evidence.isVoid ? `空亡${voidBranches.join('、') || '命中但地支未列'}` : '',
    evidence.hasHorse ? `马星同宫（来源支${data.horseStar?.sourceBranch || '未列'}）` : '',
    candidateSources.length ? `候选来源${candidateSources.join('、')}` : '未列为当前候选宫',
  ]
    .filter(Boolean)
    .join('；');
  return {
    key: `九宫:${palace.gong}:${palace.name}`,
    gong: palace.gong,
    name: palace.name,
    direction: palace.direction,
    element: palace.element,
    tianPan: palace.tianPan,
    diPan: palace.diPan,
    renPan: palace.renPan,
    shenPan: palace.shenPan,
    candidateSources,
    isVoid: evidence.isVoid,
    voidBranches,
    hasHorse: evidence.hasHorse,
    horseSourceBranch: evidence.hasHorse ? data.horseStar?.sourceBranch : undefined,
    patterns: evidence.patterns,
    stemRelations: evidence.stemRelations,
    insights,
    support: evidence.support,
    constraints: evidence.constraints.filter((item) => item !== globalSpecialCondition),
    promptText,
    sources: [
      '奇门遁局九宫门、星、神与天地盘干排布',
      '当前旬空落宫、驿马落宫与天地盘干关系计算',
      '基础格局、经典格局、复合格局与宫位洞察规则命中',
    ],
    limitation: PALACE_FACT_LIMITATION,
  };
}

export function analyzeQimenEvidence(data: QimenData): QimenEvidenceAnalysis {
  if (!data.jiuGongGe.length) {
    throw new Error('奇门证据分析至少需要一个宫位数据。');
  }
  const sourceMap = collectCandidateSources(data);
  const patternFacts = buildPatternFacts(data);
  const palaceFacts = [...data.jiuGongGe]
    .sort((left, right) => left.gong - right.gong)
    .map((palace) => buildPalaceFact(data, palace, sourceMap.get(palace.gong) ?? [], patternFacts));
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
      return palace ? buildPalaceEvidence(data, palace, sources, patternFacts) : null;
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
  const patternItems: PromptEvidenceItem[] = patternFacts.map((pattern): PromptEvidenceItem => ({
    level: pattern.traditionalTone === '风险' ? '反证' : '辅证',
    title: `${pattern.kind}：${pattern.name}`,
    detail: `${pattern.promptText}；传统分类：${pattern.traditionalTone}；命中宫位：${pattern.palaces.join('、') || '跨宫或全局'}；组成来源：${pattern.sources.join('、') || '未列明'}；边界：${pattern.limitation}`,
    source: `${pattern.kind}规则命中链；原始传统文字保留在结构化 patternFacts.originalText`,
    tags: [
      pattern.kind,
      pattern.traditionalTone,
      ...pattern.palaces.map((palace) => `${palace}宫`),
    ],
  }));
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
    {
      level: '主证',
      title: '奇门九宫逐宫计算事实',
      detail: `${palaceFacts.map((item) => item.promptText).join('；')}；统一边界：${PALACE_FACT_LIMITATION}`,
      source: '奇门遁局九宫排布、旬空驿马、天地盘干与格局规则逐宫映射',
      tags: ['九宫事实', '门星神干', '空亡', '马星', '规则命中'],
    },
    ...candidates.slice(0, 6).map((item, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${item.name}用神宫候选`,
      detail: `引用逐宫事实${item.palaceFactKey}；候选来源${item.sources.join('、')}；支持${item.support.join('、') || '未见独立增强证据'}；限制${item.constraints.join('、') || '未见空亡或明确风险标签'}`,
      source: '值符、值使、日干、时干、盘面洞察与经典格局候选定位',
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
            detail: `${data.seasonality.currentJieQi}${data.seasonality.jieQiPhase.phase}；季节五行${data.seasonality.seasonalElement}；日干${data.seasonality.dayStem}属${data.seasonality.dayElement}，${conditionQimenTraditionalText(data.seasonality.seasonRelationDescription)}；月相${data.seasonality.lunarPhase}（${data.seasonality.lunarPhaseDetail}）；建除${data.seasonality.dayOfficer}（${data.seasonality.dayOfficerFortuneLabel}）；四柱互动${data.seasonality.ganzhiInteractions.map((item) => conditionQimenTraditionalText(item.description)).join('、') || '未检出明确合冲刑害'}`,
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
    palaceFacts,
    candidates,
    relations,
    patternFacts,
    counterEvidence,
    timingConditions,
    directionConditions,
    evidence,
    promptText,
    methodology: [
      '先定位值符、值使、日干和时干落宫，再补充盘面洞察与经典格局候选。',
      '逐宫保留门、星、神、天地盘干、空亡、马星、格局、支持与限制。',
      '定局、值符值使、复合格局来源、宫间作用、应期和方位条件全部进入统一证据条目。',
      '传统格局原文保留在结构化结果中，提示词只读取条件化副本并注明传统分类与现代实证边界。',
      '候选宫之间只陈述可复核的五行生克关系，不用数字分数代替判断。',
      '未按问题选定用神时明确保留候选性质，不输出吉凶总分、成功率或绝对日期。',
    ],
  };
}
