import type { MeihuaData } from '../types/divination';
import { trigramsByIndex } from './hexagram-data';
import { getSeasonState, isKe, isSheng } from '../ganzhi';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type MeihuaEvidenceStageKey = 'origin' | 'process' | 'result';

export interface MeihuaStageEvidence {
  stage: MeihuaEvidenceStageKey;
  label: string;
  hexagram: string;
  ti: { name: string; element: string; seasonState: string };
  yong: { name: string; element: string; seasonState: string };
  relation: string;
  support: string[];
  constraints: string[];
  basis: string;
}

export interface MeihuaEvidenceAnalysis {
  calculationFacts: string[];
  hexagramFacts: string[];
  yaoFacts: string[];
  monthBranch: string;
  movingYao: number;
  stages: MeihuaStageEvidence[];
  transitions: string[];
  timingConditions: string[];
  randomFacts: string[];
  counterEvidence: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const trigramByName = new Map(
  Object.values(trigramsByIndex)
    .filter(Boolean)
    .map((item) => [item.name, item]),
);

function relationOf(yong: string, ti: string) {
  if (yong === ti) return '比和';
  if (isSheng(yong, ti)) return '用生体';
  if (isSheng(ti, yong)) return '体生用';
  if (isKe(yong, ti)) return '用克体';
  if (isKe(ti, yong)) return '体克用';
  return '关系未定';
}

function relationEvidence(relation: string) {
  switch (relation) {
    case '用生体':
      return { support: ['外部条件生扶体卦'], constraints: [] };
    case '比和':
      return { support: ['体用同五行，关系同气'], constraints: ['仍须结合旺衰与现实条件'] };
    case '体克用':
      return { support: ['体卦对用卦具有制约能力'], constraints: ['主动推进可能伴随消耗'] };
    case '体生用':
      return { support: ['体卦向事项一方投入'], constraints: ['体卦存在泄耗'] };
    case '用克体':
      return { support: [], constraints: ['外部事项对体卦形成压力'] };
    default:
      return { support: [], constraints: ['现有资料不足以确定五行关系'] };
  }
}

function stateEvidence(role: '体' | '用', state: string) {
  if (state === '旺' || state === '相')
    return { support: [`${role}卦得月令${state}`], constraints: [] };
  if (state === '休' || state === '囚' || state === '死') {
    return { support: [], constraints: [`${role}卦月令${state}`] };
  }
  return { support: [], constraints: [] };
}

function createStage(params: {
  stage: MeihuaEvidenceStageKey;
  label: string;
  hexagram: string;
  ti: { name: string; element: string };
  yong: { name: string; element: string };
  monthBranch: string;
  basis: string;
}): MeihuaStageEvidence {
  const relation = relationOf(params.yong.element, params.ti.element);
  const relationItems = relationEvidence(relation);
  const tiState = getSeasonState(params.ti.element, params.monthBranch);
  const yongState = getSeasonState(params.yong.element, params.monthBranch);
  const tiItems = stateEvidence('体', tiState);
  const yongItems = stateEvidence('用', yongState);
  return {
    stage: params.stage,
    label: params.label,
    hexagram: params.hexagram,
    ti: { ...params.ti, seasonState: tiState },
    yong: { ...params.yong, seasonState: yongState },
    relation,
    support: [...relationItems.support, ...tiItems.support, ...yongItems.support],
    constraints: [...relationItems.constraints, ...tiItems.constraints, ...yongItems.constraints],
    basis: params.basis,
  };
}

function formatStage(stage: MeihuaStageEvidence) {
  return `${stage.label}${stage.hexagram}：体卦${stage.ti.name}${stage.ti.element}（月令${stage.ti.seasonState}），用卦${stage.yong.name}${stage.yong.element}（月令${stage.yong.seasonState}），关系${stage.relation}`;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function appendResolvedResultFacts(facts: string[], data: MeihuaData) {
  facts.push(
    `已确定起卦结果：上卦${data.mainHexagram.upper}、下卦${data.mainHexagram.lower}、动爻第${data.movingYao.position}爻`,
  );
}

function buildCalculationFacts(data: MeihuaData): string[] {
  const calculation = data.calculation;
  if (!calculation) return ['起卦计算过程未附，无法复核上下卦与动爻索引来源'];
  const facts = [`起卦方式：${calculation.method}`];
  if (calculation.methodKey === 'time' || calculation.methodKey === 'timeTrigram') {
    const hasCompleteTimeInputs =
      hasText(calculation.yearZhi) &&
      hasFiniteNumber(calculation.yearZhiIndex) &&
      hasFiniteNumber(calculation.month) &&
      hasFiniteNumber(calculation.day) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteTimeInputs) {
      facts.push(
        `时间取数：农历年支${calculation.yearZhi}序${calculation.yearZhiIndex}、月数${calculation.month}、日数${calculation.day}、时支${calculation.timeZhi}序${calculation.timeZhiIndex}`,
        `上卦=(${calculation.yearZhiIndex}+${calculation.month}+${calculation.day})除8取余为${calculation.upperTrigramIndex}`,
        `下卦=(${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}+${calculation.timeZhiIndex})除8取余为${calculation.lowerTrigramIndex}`,
        `动爻=(${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}+${calculation.timeZhiIndex})除6取余为${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('当前结果未附完整时间取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'number') {
    if (hasFiniteNumber(calculation.number)) facts.push(`输入数字：${calculation.number}`);
    const hasCompleteNumberInputs =
      hasFiniteNumber(calculation.number) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteNumberInputs) {
      facts.push(
        `数字取数：输入${calculation.number}，时支${calculation.timeZhi}序${calculation.timeZhiIndex}，合计${calculation.totalWithTime}`,
        `上卦=${calculation.number}除8取余为${calculation.upperTrigramIndex}`,
        `下卦=${calculation.totalWithTime}除8取余为${calculation.lowerTrigramIndex}`,
        `动爻=${calculation.totalWithTime}除6取余为${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('当前结果未附完整数字取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'random') {
    if (
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      facts.push(
        `随机取数结果：上卦索引${calculation.upperTrigramIndex}、下卦索引${calculation.lowerTrigramIndex}、动爻${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('当前结果未附完整随机取数索引，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  }
  if (hasText(calculation.compatibilityNote)) {
    facts.push(`兼容口径：${calculation.compatibilityNote}`);
  }
  return facts;
}

export function analyzeMeihuaEvidence(data: MeihuaData): MeihuaEvidenceAnalysis {
  if (!data?.tiGua || !data?.yongGua || !data?.movingYao) {
    throw new Error('梅花体用推进证据缺少完整体用或动爻资料。');
  }
  const monthBranch = data.ganzhi.month.slice(-1);
  const calculationFacts = buildCalculationFacts(data);
  const hexagramFacts = [
    `主卦${data.mainHexagram.name}${data.mainHexagram.symbol}，上${data.mainHexagram.upper}下${data.mainHexagram.lower}：${data.mainHexagram.description}`,
    ...(data.interHexagram
      ? [
          `互卦${data.interHexagram.name}${data.interHexagram.symbol}，上${data.interHexagram.upper}下${data.interHexagram.lower}：${data.interHexagram.description}`,
        ]
      : []),
    ...(data.changedHexagram
      ? [
          `变卦${data.changedHexagram.name}${data.changedHexagram.symbol}，上${data.changedHexagram.upper}下${data.changedHexagram.lower}：${data.changedHexagram.description}`,
        ]
      : []),
  ];
  const yaoFacts = data.yaosDetail.map(
    (item) =>
      `第${item.position}爻为${item.yaoType}爻，属${item.tiYong}${item.isChanging ? '，本爻发动' : ''}`,
  );
  const stages: MeihuaStageEvidence[] = [
    createStage({
      stage: 'origin',
      label: '起因',
      hexagram: data.originalName,
      ti: data.tiGua,
      yong: data.yongGua,
      monthBranch,
      basis: '主卦以动爻所在经卦为用、另一经卦为体。',
    }),
  ];

  const interUpper = data.interHexagram?.upper
    ? trigramByName.get(data.interHexagram.upper)
    : undefined;
  const interLower = data.interHexagram?.lower
    ? trigramByName.get(data.interHexagram.lower)
    : undefined;
  if (interUpper && interLower) {
    const movingInLower = data.movingYao.position <= 3;
    stages.push(
      createStage({
        stage: 'process',
        label: '过程',
        hexagram: data.interHexagram?.name || data.interName || '互卦',
        ti: movingInLower ? interLower : interUpper,
        yong: movingInLower ? interUpper : interLower,
        monthBranch,
        basis: movingInLower
          ? '原动爻在下卦，互卦以下互为体、上互为用。'
          : '原动爻在上卦，互卦以上互为体、下互为用。',
      }),
    );
  }

  if (data.changedTiGua && data.changedYongGua) {
    stages.push(
      createStage({
        stage: 'result',
        label: '结果',
        hexagram: data.changedHexagram?.name || data.changedName || '变卦',
        ti: data.changedTiGua,
        yong: data.changedYongGua,
        monthBranch,
        basis: '变卦沿用原动爻所在经卦为用、另一经卦为体，观察变化后的关系。',
      }),
    );
  }

  const transitions = stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    return `${previous.label}${previous.relation} → ${stage.label}${stage.relation}`;
  });
  const timingConditions = [
    `第${data.movingYao.position}爻为变化触发层位，只用于先后、层次和触发条件`,
    `月建${monthBranch}用于校验各阶段体用旺衰`,
    stages.some(
      (item) =>
        item.ti.seasonState === '休' ||
        item.ti.seasonState === '囚' ||
        item.ti.seasonState === '死',
    )
      ? '体卦有休囚死阶段时，需等待现实阻力缓解或外部条件改变再验'
      : '体卦各阶段未见明显休囚死，仍须等待现实事件验证',
    '动爻、卦数与旺衰不能据此换算绝对日期',
    ...(data.analysis.yingQi ?? []),
  ];
  const counterEvidence = Array.from(new Set(stages.flatMap((item) => item.constraints)));
  const isRandomMethod = data.calculation?.methodKey === 'random';
  const trace = data.meta?.random;
  const randomFacts = isRandomMethod
    ? trace
      ? [
          `随机模式：${trace.mode}`,
          `原始随机样本数：${trace.samples.length}`,
          trace.seed !== undefined ? `随机种子：${String(trace.seed)}` : '',
        ].filter(Boolean)
      : ['随机起卦结果未附随机轨迹，无法核验上下卦与动爻的重放过程']
    : [];
  const promptRandomFacts = randomFacts.filter((item) => !item.startsWith('随机种子：'));
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '起卦方式与取数算式',
      detail: calculationFacts.join('；'),
      source: '当前起卦方式的输入值、取余规则与输出索引',
      tags: ['起卦算式', data.calculation?.methodKey ?? '来源未列'],
    },
    {
      level: '主证',
      title: '主互变卦象事实',
      detail: hexagramFacts.join('；'),
      source: '上下卦索引、六爻序列、互卦取二三四与三四五爻、动爻阴阳翻转',
      tags: [
        '主卦',
        ...(data.interHexagram ? ['互卦'] : []),
        ...(data.changedHexagram ? ['变卦'] : []),
      ],
    },
    {
      level: '辅证',
      title: '六爻阴阳与体用归属',
      detail: yaoFacts.join('；'),
      source: '主卦自下而上六爻数据与动爻所在经卦',
      tags: ['六爻结构', '动爻', '体用'],
    },
    ...(data.mainHexagram.movingYaoCi
      ? [
          {
            level: '辅证' as const,
            title: `${data.movingYao.yaoName}爻辞`,
            detail: data.mainHexagram.movingYaoCi,
            source: '当前主卦逐爻辞数据；仅作动爻取象辅助',
            tags: ['动爻爻辞', data.movingYao.yaoName],
          },
        ]
      : []),
    ...stages.map((stage, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${stage.label}阶段`,
      detail: `${formatStage(stage)}；依据：${stage.basis}；支持：${stage.support.join('、') || '未见额外增强'}；限制：${stage.constraints.join('、') || '未见明显月令限制'}`,
      source: '梅花体用、互卦、变卦与月建旺衰逐阶段核验',
      tags: [stage.stage, stage.relation],
    })),
    ...transitions.map((detail, index): PromptEvidenceItem => ({
      level: '辅证',
      title: `${index === 0 ? '起因至过程' : '过程至结果'}体用转变`,
      detail,
      source: '主卦、互卦、变卦阶段体用关系比较',
      tags: ['阶段推进', index === 0 ? '过程' : '结果'],
    })),
    ...(data.analysis.inter2Relation && data.analysis.inter2Relation !== '无'
      ? [
          {
            level: '辅证' as const,
            title: '互卦对原体辅助关系',
            detail: `辅助关系为${data.analysis.inter2Relation}；该关系不是主互卦体用主线，只作为补充取象。`,
            source: '互卦上卦与原体卦五行关系',
            tags: ['互卦辅助', '非主线'],
          },
        ]
      : []),
    {
      level: '应期',
      title: '变化触发与应期条件',
      detail: timingConditions.join('；'),
      source: '动爻层位、月建旺衰、体用生克与现实触发条件',
      tags: ['应期', '触发条件', '不换算绝对日期'],
    },
    ...counterEvidence.map((detail, index): PromptEvidenceItem => ({
      level: '反证',
      title: `体用限制核验${index + 1}`,
      detail,
      source: '逐阶段体用生克与月令旺衰核验',
      tags: ['反证', '体用限制'],
    })),
  ];
  if (isRandomMethod) {
    items.push({
      level: trace ? '辅证' : '反证',
      title: trace ? '随机起卦重放记录' : '随机轨迹缺失',
      detail: `${promptRandomFacts.join('；')}；随机种子保留在结构化结果中，不写入自然语言提示词；该记录只用于核验起卦过程能否重放，不表示可信度或预测有效性`,
      source: '命语统一随机轨迹协议',
      tags: ['随机起卦', trace ? '可重放' : '不可核验', '不代表预测有效性'],
    });
  }
  items.push({
    level: '限制',
    title: '梅花推进链解释边界',
    detail:
      '体用生克只描述卦内关系，不直接等于现实吉凶；互卦用于过程、变卦用于结果，卦名与爻辞只能结合问题作辅助取象。不得按阶段数量、旺衰或卦数生成总分、成功率和绝对应期。',
    source: '计算事实与解释结论分离原则',
  });
  const evidence: PromptEvidenceBundle = { title: '梅花体用阶段推进结构化证据', items };
  const promptText = [
    '【梅花体用阶段推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `推进关系：${transitions.join('；') || '只有主卦阶段，未形成可核验的互变推进链'}`,
    `触发条件：${timingConditions.join('；')}`,
  ].join('\n');
  return {
    calculationFacts,
    hexagramFacts,
    yaoFacts,
    monthBranch,
    movingYao: data.movingYao.position,
    stages,
    transitions,
    timingConditions,
    randomFacts,
    counterEvidence,
    evidence,
    promptText,
    methodology: [
      '主卦定起因与当前体用，互卦定过程，变卦定变化后的结果关系。',
      '起卦输入、取余算式、六爻阴阳、互卦构造和动爻翻转均作为可复核计算事实保留。',
      '每个阶段分别计算体用生克和月建旺衰，不把某一阶段扩大为全局结论。',
      '动爻只标记变化层位与触发顺序，卦数只保留原始计算资料，不机械换算绝对日期。',
      '只输出支持、反证、限制和触发条件，不生成吉凶总分或成功率。',
    ],
  };
}
