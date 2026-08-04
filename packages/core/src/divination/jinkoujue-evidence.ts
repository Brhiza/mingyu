import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { JinkoujueData, JinkoujueFourPosition, JinkoujueMovement } from '../types/divination';

export interface JinkoujuePositionFact {
  key: string;
  status: '已计算';
  position: JinkoujueFourPosition['name'];
  role: string;
  branch: string;
  stem?: string;
  stemElement?: string;
  god?: string;
  element: string;
  elementBasis: JinkoujueFourPosition['elementBasis'];
  yinYang: JinkoujueFourPosition['yinYang'];
  seasonState: string;
  isVoid: boolean;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '四位事实只记录地分、将神、贵神、人元的落点、五行、月令与空亡；不得直接写成现实吉凶、人物身份或事件保证';
}

export interface JinkoujueMovementFact extends JinkoujueMovement {
  key: string;
  status: '已触发';
  promptText: string;
  sources: string[];
  limitation: '动爻只记录四位之间满足的五行触发条件；具体人事须结合所问事项与主客用位，不得按动名直接断定现实结果';
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
  limitation: '焦点事实只记录阴阳次第选出的发用位与其依据；不得把固定贵神或将神另立为用';
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
    dayNightRule: string;
    noblemanRule: string;
    noblemanDirection: string;
    guiShenRule: string;
    yinYangUseRule: string;
    promptText: string;
    sources: string[];
    limitation: '计算事实只证明地分、月将、贵神、遁干与发用如何形成当前课体；不证明现实结论';
  };
  positions: JinkoujuePositionFact[];
  relations: JinkoujueRelationFact[];
  movementFacts: JinkoujueMovementFact[];
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
  '焦点事实只记录阴阳次第选出的发用位与其依据；不得把固定贵神或将神另立为用' as const;
const COUNTER_LIMITATION =
  '反证只表示当前四位存在空亡、休囚死或受克条件；不得把单项反证直接写成现实失败或灾祸' as const;
const MOVEMENT_LIMITATION =
  '动爻只记录四位之间满足的五行触发条件；具体人事须结合所问事项与主客用位，不得按动名直接断定现实结果' as const;

function buildPositionFact(position: JinkoujueFourPosition): JinkoujuePositionFact {
  return {
    key: `jinkoujue:position:${position.name}`,
    status: '已计算',
    position: position.name,
    role: position.role,
    branch: position.branch,
    stem: position.stem,
    stemElement: position.stemElement,
    god: position.god,
    element: position.element,
    elementBasis: position.elementBasis,
    yinYang: position.yinYang,
    seasonState: position.seasonState,
    isVoid: position.isVoid,
    support: [...position.support],
    constraints: [...position.constraints],
    promptText: position.promptText,
    sources: [
      '《六壬神课金口诀古本》“入式歌解”',
      '《六壬神课金口诀古本》“十二贵神所属”',
      '《六壬神课金口诀古本》“五子元遁起例”',
      '日旬空亡与月令旺衰',
    ],
    limitation: POSITION_LIMITATION,
  };
}

function buildRelationFact(
  key: string,
  from: string,
  to: string,
  relation: string,
): JinkoujueRelationFact {
  return {
    key,
    status: '中性',
    from,
    to,
    relation,
    promptText: `${from}对${to}为${relation}`,
    sources: ['《六壬神课金口诀古本》“干类、神类、将类、方类”'],
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
      `将神${data.positions.jiangShen.stem || ''}${data.positions.jiangShen.branch}`,
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
      `将神${data.positions.jiangShen.stem || ''}${data.positions.jiangShen.branch}`,
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

  const movementFacts: JinkoujueMovementFact[] = data.movements.map((item, index) => ({
    ...item,
    key: `jinkoujue:movement:${item.category}:${index + 1}:${item.name}`,
    status: '已触发',
    promptText: `${item.name}：${item.trigger}`,
    sources: [item.source],
    limitation: MOVEMENT_LIMITATION,
  }));

  const focusFacts: JinkoujueFocusFact[] = (data.focusEvidence ?? []).map((item, index) => ({
    key: `jinkoujue:focus:${index + 1}:${item.target}`,
    target: item.target,
    role: item.role,
    level: item.level,
    evidence: [...item.evidence],
    limitations: [...item.limitations],
    promptText: `${item.target}${item.role}：依据${item.evidence.join('、') || '未列'}；限制${item.limitations.join('、') || '未见'}`,
    sources: ['《六壬神课金口诀古本》“阴阳次第五用”', '《六壬神课金口诀古本》“四象所属图”'],
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
    sources: ['阴阳次第五用', '五动三动', '四位生克与空亡月令核验'],
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
    dayNightRule: data.calculation.dayNightRule,
    noblemanRule: data.calculation.noblemanRule,
    noblemanDirection: data.calculation.noblemanDirection,
    guiShenRule: data.calculation.guiShenRule,
    yinYangUseRule: `${data.yinYangUse.pattern}：${data.yinYangUse.rule}`,
    promptText: [
      `起课方式${data.calculation.methodLabel}`,
      data.calculation.diFenNote,
      data.calculation.monthLeaderRule,
      data.calculation.dayNightRule,
      data.calculation.noblemanRule,
      data.calculation.guiShenRule,
      data.calculation.yuanDunRule,
      `${data.yinYangUse.pattern}，${data.yinYangUse.rule}`,
    ].join('；'),
    sources: [
      '《六壬神课金口诀古本》“入式歌解”',
      '《六壬神课金口诀古本》“贵神治旦暮”',
      '《六壬神课金口诀古本》“贵神起例”',
      '《六壬神课金口诀古本》“五子元遁起例”',
      '《六壬神课金口诀古本》“阴阳次第五用”',
    ],
    limitation:
      '计算事实只证明地分、月将、贵神、遁干与发用如何形成当前课体；不证明现实结论' as const,
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
      title: '金口诀阴阳发用主线',
      detail: `${data.mainLine}；边界：${FOCUS_LIMITATION}`,
      source: '《六壬神课金口诀古本》“阴阳次第五用”“四象所属图”',
      tags: ['阴阳发用', '四位一体'],
    },
    {
      level: '主证',
      title: '起课计算',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起课', data.method, calculationFact.status],
    },
    ...positions.map((item): PromptEvidenceItem => ({
      level: item.position === data.yinYangUse.usePosition ? '主证' : '辅证',
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
    ...movementFacts.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: `${item.category}：${item.name}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.category, item.name, item.relation],
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
        '不得输出吉凶总分或成功率；先按阴阳次第确认发用位，再结合五动三动与四位关系；生克和动名须结合具体所问，不得直接判成现实吉凶。',
      source: '《六壬神课金口诀古本》“阴阳次第五用”“五动爻诵”“三动”',
      tags: ['解释边界'],
    },
  ];

  const evidence: PromptEvidenceBundle = {
    title: '金口诀阴阳发用与四位一体结构化证据',
    items,
  };

  const promptText = [
    '【金口诀阴阳发用结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `主线：${data.mainLine}。`,
    `计算：${calculationFact.promptText}。`,
    `四位：${positions.map((item) => item.promptText).join('；')}。`,
    `关系：${relations.map((item) => item.promptText).join('；')}。`,
    `动爻：${movementFacts.map((item) => item.promptText).join('；') || '未触发五动或三动'}。`,
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
    movementFacts,
    focusFacts,
    counterEvidenceFacts,
    summaryFact,
    randomTraceFact,
    randomFacts: formatLegacyRandomFacts(randomTraceFact),
    promptText,
    evidence,
  };
}
