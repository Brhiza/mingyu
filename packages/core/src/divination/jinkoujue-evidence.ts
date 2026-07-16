import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { JinkoujueData, JinkoujueFourPosition } from '../types/divination';

export interface JinkoujuePositionFact {
  key: string;
  status: '已计算';
  position: JinkoujueFourPosition['name'];
  role: string;
  branch: string;
  stem?: string;
  god?: string;
  element: string;
  seasonState: string;
  isVoid: boolean;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '四位事实只记录地分、将神、贵神、人元的落点、五行、月令与空亡；不得直接写成现实吉凶、人物身份或事件保证';
}

export interface JinkoujueRelationFact {
  key: string;
  status: '支持' | '限制' | '中性';
  from: string;
  to: string;
  relation: string;
  promptText: string;
  sources: string[];
  limitation: '四位生克关系只说明盘内作用方向；不得把生克直接写成现实必然顺利、受阻、成功或失败';
}

export interface JinkoujueFocusFact {
  key: string;
  target: string;
  role: string;
  level: '主证' | '辅证';
  evidence: string[];
  limitations: string[];
  promptText: string;
  sources: string[];
  limitation: '焦点事实只记录当前课盘已选出的主事对象与依据；不得另立与四位主线冲突的断法';
}

export interface JinkoujueCounterEvidenceFact {
  key: string;
  ownerKey: string;
  type: '旬空' | '月令限制' | '受克' | '主证受限';
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '反证只表示当前四位存在空亡、休囚死或受克条件；不得把单项反证直接写成现实失败或灾祸';
}

export interface JinkoujueEvidenceSummaryFact {
  key: 'jinkoujue:evidence-summary';
  status: '证据链完整' | '主线受限';
  positionCount: number;
  relationCount: number;
  focusCount: number;
  counterCount: number;
  promptText: string;
  sources: string[];
  limitation: '证据汇总只统计四位、关系、焦点与反证覆盖，不得按数量生成吉凶总分或成功率';
}

export interface JinkoujueEvidenceAnalysis {
  key: 'jinkoujue:evidence';
  status: '已计算';
  mainLine: string;
  calculationFact: {
    key: 'jinkoujue:calculation';
    status: '完整';
    method: string;
    methodLabel: string;
    inputBase: number;
    inputBaseSource: string;
    diFenNote: string;
    monthLeaderRule: string;
    yuanDunRule: string;
    noblemanRule: string;
    promptText: string;
    sources: string[];
    limitation: '计算事实只证明地分、月将、贵人与人元如何形成当前四位；不证明现实结论';
  };
  positions: JinkoujuePositionFact[];
  relations: JinkoujueRelationFact[];
  focusFacts: JinkoujueFocusFact[];
  counterEvidenceFacts: JinkoujueCounterEvidenceFact[];
  summaryFact: JinkoujueEvidenceSummaryFact;
  randomTraceFact: RandomTraceFact;
  randomFacts: string[];
  promptText: string;
  evidence: PromptEvidenceBundle;
}

const POSITION_LIMITATION =
  '四位事实只记录地分、将神、贵神、人元的落点、五行、月令与空亡；不得直接写成现实吉凶、人物身份或事件保证' as const;
const RELATION_LIMITATION =
  '四位生克关系只说明盘内作用方向；不得把生克直接写成现实必然顺利、受阻、成功或失败' as const;
const FOCUS_LIMITATION =
  '焦点事实只记录当前课盘已选出的主事对象与依据；不得另立与四位主线冲突的断法' as const;
const COUNTER_LIMITATION =
  '反证只表示当前四位存在空亡、休囚死或受克条件；不得把单项反证直接写成现实失败或灾祸' as const;

function buildPositionFact(position: JinkoujueFourPosition): JinkoujuePositionFact {
  return {
    key: `jinkoujue:position:${position.name}`,
    status: '已计算',
    position: position.name,
    role: position.role,
    branch: position.branch,
    stem: position.stem,
    god: position.god,
    element: position.element,
    seasonState: position.seasonState,
    isVoid: position.isVoid,
    support: [...position.support],
    constraints: [...position.constraints],
    promptText: position.promptText,
    sources: ['月将加时天盘', '昼夜贵人法', '五子元遁', '日旬空亡', '月令旺衰'],
    limitation: POSITION_LIMITATION,
  };
}

function buildRelationFact(
  key: string,
  from: string,
  to: string,
  relation: string,
): JinkoujueRelationFact {
  const status =
    relation === '克' || relation === '被克'
      ? '限制'
      : relation === '生' || relation === '被生' || relation === '比和'
        ? '支持'
        : '中性';
  return {
    key,
    status,
    from,
    to,
    relation,
    promptText: `${from}对${to}为${relation}`,
    sources: ['四位五行生克'],
    limitation: RELATION_LIMITATION,
  };
}

export function analyzeJinkoujueEvidence(data: JinkoujueData): JinkoujueEvidenceAnalysis {
  const positions = [
    data.positions.diFen,
    data.positions.jiangShen,
    data.positions.guiShen,
    data.positions.renYuan,
  ].map(buildPositionFact);

  const relations = [
    buildRelationFact(
      'jinkoujue:relation:gui-jiang',
      `贵神${data.positions.guiShen.god || ''}${data.positions.guiShen.branch}`,
      `将神${data.positions.jiangShen.branch}`,
      data.relations.guiToJiang,
    ),
    buildRelationFact(
      'jinkoujue:relation:gui-ren',
      `贵神${data.positions.guiShen.god || ''}${data.positions.guiShen.branch}`,
      `人元${data.positions.renYuan.stem || ''}${data.positions.renYuan.branch}`,
      data.relations.guiToRen,
    ),
    buildRelationFact(
      'jinkoujue:relation:jiang-di',
      `将神${data.positions.jiangShen.branch}`,
      `地分${data.positions.diFen.branch}`,
      data.relations.jiangToDi,
    ),
    buildRelationFact(
      'jinkoujue:relation:ren-di',
      `人元${data.positions.renYuan.stem || ''}${data.positions.renYuan.branch}`,
      `地分${data.positions.diFen.branch}`,
      data.relations.renToDi,
    ),
    buildRelationFact(
      'jinkoujue:relation:gui-di',
      `贵神${data.positions.guiShen.god || ''}${data.positions.guiShen.branch}`,
      `地分${data.positions.diFen.branch}`,
      data.relations.guiToDi,
    ),
  ];

  const focusFacts: JinkoujueFocusFact[] = (data.focusEvidence ?? []).map((item, index) => ({
    key: `jinkoujue:focus:${index + 1}:${item.target}`,
    target: item.target,
    role: item.role,
    level: item.level,
    evidence: [...item.evidence],
    limitations: [...item.limitations],
    promptText: `${item.target}${item.role}：依据${item.evidence.join('、') || '未列'}；限制${item.limitations.join('、') || '未见'}`,
    sources: ['四位取用主线', '月将加时', '昼夜贵人', '五子元遁'],
    limitation: FOCUS_LIMITATION,
  }));

  const counterEvidenceFacts: JinkoujueCounterEvidenceFact[] = [];
  for (const position of positions) {
    if (position.isVoid) {
      counterEvidenceFacts.push({
        key: `jinkoujue:counter:void:${position.position}`,
        ownerKey: position.key,
        type: '旬空',
        status: '已触发',
        detail: `${position.position}${position.branch}落日旬空`,
        promptText: `${position.position}${position.branch}旬空，相关信息需待填实后再作主断`,
        sources: ['日柱旬空'],
        limitation: COUNTER_LIMITATION,
      });
    }
    if (position.constraints.some((item) => item.startsWith('月令'))) {
      counterEvidenceFacts.push({
        key: `jinkoujue:counter:season:${position.position}`,
        ownerKey: position.key,
        type: '月令限制',
        status: '已触发',
        detail: `${position.position}月令${position.seasonState}`,
        promptText: `${position.position}处月令${position.seasonState}，力量条件偏弱`,
        sources: ['月令旺衰'],
        limitation: COUNTER_LIMITATION,
      });
    }
  }
  for (const relation of relations) {
    if (relation.status === '限制') {
      counterEvidenceFacts.push({
        key: `jinkoujue:counter:relation:${relation.key}`,
        ownerKey: relation.key,
        type: '受克',
        status: '已触发',
        detail: relation.promptText,
        promptText: `${relation.promptText}，主线推进时需并看限制条件`,
        sources: ['四位五行生克'],
        limitation: COUNTER_LIMITATION,
      });
    }
  }
  for (const focus of focusFacts) {
    if (focus.limitations.length) {
      counterEvidenceFacts.push({
        key: `jinkoujue:counter:focus:${focus.key}`,
        ownerKey: focus.key,
        type: '主证受限',
        status: '已触发',
        detail: focus.limitations.join('、'),
        promptText: `${focus.target}存在限制：${focus.limitations.join('、')}`,
        sources: ['焦点限制'],
        limitation: COUNTER_LIMITATION,
      });
    }
  }

  const summaryFact: JinkoujueEvidenceSummaryFact = {
    key: 'jinkoujue:evidence-summary',
    status: counterEvidenceFacts.length ? '主线受限' : '证据链完整',
    positionCount: positions.length,
    relationCount: relations.length,
    focusCount: focusFacts.length,
    counterCount: counterEvidenceFacts.length,
    promptText: `金口诀证据：四位${positions.length}项、关系${relations.length}项、焦点${focusFacts.length}项、反证${counterEvidenceFacts.length}项；主线${data.mainLine}`,
    sources: ['四位一体取用', '生克空亡月令核验'],
    limitation: '证据汇总只统计四位、关系、焦点与反证覆盖，不得按数量生成吉凶总分或成功率',
  };

  const calculationFact = {
    key: 'jinkoujue:calculation' as const,
    status: '完整' as const,
    method: data.calculation.method,
    methodLabel: data.calculation.methodLabel,
    inputBase: data.calculation.inputBase,
    inputBaseSource: data.calculation.inputBaseSource,
    diFenNote: data.calculation.diFenNote,
    monthLeaderRule: data.calculation.monthLeaderRule,
    yuanDunRule: data.calculation.yuanDunRule,
    noblemanRule: data.calculation.noblemanRule,
    promptText: [
      `起课方式${data.calculation.methodLabel}`,
      data.calculation.diFenNote,
      data.calculation.monthLeaderRule,
      data.calculation.noblemanRule,
      data.calculation.yuanDunRule,
    ].join('；'),
    sources: ['金口诀起课规则', '月将加时', '昼夜贵人', '五子元遁'],
    limitation: '计算事实只证明地分、月将、贵人与人元如何形成当前四位；不证明现实结论' as const,
  };

  const randomTraceFact = buildRandomTraceFact({
    key: 'jinkoujue:random-trace',
    applicable: data.method === 'random',
    trace: data.randomTrace,
    processLabel: '金口诀随机起课',
    sources: ['随机起课抽样过程'],
  });

  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '金口诀取用主线',
      detail: `${data.mainLine}；边界：${FOCUS_LIMITATION}`,
      source: '贵神主事、将神主事体、人元主人情、地分主落点',
      tags: ['取用主线', '四位一体'],
    },
    {
      level: '主证',
      title: '起课计算',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起课', data.method, calculationFact.status],
    },
    ...positions.map((item): PromptEvidenceItem => ({
      level: item.position === '贵神' || item.position === '将神' ? '主证' : '辅证',
      title: `${item.position}位`,
      detail: `${item.promptText}；角色${item.role}；支持${item.support.join('、') || '无'}；限制${item.constraints.join('、') || '无'}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.position, item.element, item.seasonState],
    })),
    ...relations.map((item): PromptEvidenceItem => ({
      level: item.status === '限制' ? '反证' : item.status === '支持' ? '主证' : '辅证',
      title: '四位关系',
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['生克', item.relation],
    })),
    ...focusFacts.map((item): PromptEvidenceItem => ({
      level: item.level,
      title: `焦点：${item.target}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['焦点', item.role],
    })),
    ...(data.method === 'random'
      ? [
          {
            level: randomTraceFact.status === '可重放' ? ('辅证' as const) : ('反证' as const),
            title: randomTraceFact.status === '可重放' ? '随机起课重放记录' : '随机轨迹缺失',
            detail: `${randomTraceFact.promptText}；边界：${randomTraceFact.limitation}`,
            source: randomTraceFact.sources.join('、'),
            tags: ['随机起课', randomTraceFact.status],
          },
        ]
      : []),
    ...counterEvidenceFacts.map((item): PromptEvidenceItem => ({
      level: '反证',
      title: item.type,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['反证', item.type],
    })),
    {
      level: '辅证',
      title: `金口诀证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '金口诀解释边界',
      detail:
        '不得输出吉凶总分或成功率；未给具体问题时仍须先按贵神—将神—人元—地分主线组织判断；空亡、休囚死与受克只作条件限制。',
      source: '金口诀四位一体取用规则',
      tags: ['解释边界'],
    },
  ];

  const evidence: PromptEvidenceBundle = {
    title: '金口诀四位一体结构化证据',
    items,
  };

  const promptText = [
    '【金口诀取用主线结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `主线：${data.mainLine}。`,
    `计算：${calculationFact.promptText}。`,
    `四位：${positions.map((item) => item.promptText).join('；')}。`,
    `关系：${relations.map((item) => item.promptText).join('；')}。`,
    `反证：${counterEvidenceFacts.map((item) => item.promptText).join('；') || '未见明确空亡、休囚死或受克限制'}。`,
    `证据汇总：${summaryFact.promptText}。`,
  ].join('\n');

  return {
    key: 'jinkoujue:evidence',
    status: '已计算',
    mainLine: data.mainLine,
    calculationFact,
    positions,
    relations,
    focusFacts,
    counterEvidenceFacts,
    summaryFact,
    randomTraceFact,
    randomFacts: formatLegacyRandomFacts(randomTraceFact),
    promptText,
    evidence,
  };
}
