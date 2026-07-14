import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { XiaoliurenData, XiaoliurenPalaceDetail } from '../types/divination';

export interface XiaoliurenStageEvidence {
  stage: '起因' | '过程' | '结果';
  palace: XiaoliurenPalaceDetail;
  seasonState: string;
  role: string;
  support: string[];
  constraints: string[];
}

export interface XiaoliurenTraditionalFact {
  key: string;
  palace: XiaoliurenPalaceDetail['name'];
  stages: Array<'起因' | '过程' | '结果'>;
  kind: '宫位解释' | '传统属性';
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '六宫宫义与传统属性只用于当前课式的近事情境分类，不证明现实中的结果、疾病、身体问题、方位吉凶或固定应期';
}

export interface XiaoliurenCalculationStep {
  key: string;
  stage: '起因' | '过程' | '结果';
  expression: string;
  seed: number;
  modulo: 6;
  palaceIndex: number;
  palace: string;
  promptText: string;
}

export interface XiaoliurenCalculationFact {
  key: string;
  status: '完整' | '缺少中间参数';
  method: XiaoliurenData['method'];
  methodLabel: string;
  inputBase?: number;
  inputBaseSource?: string;
  lunarDay: number;
  hourNumber?: number;
  steps: XiaoliurenCalculationStep[];
  promptText: string;
  sources: string[];
  limitation: '逐宫顺数只证明起课基数、农历日数和时辰数如何定位起因、过程、结果三宫，不证明宫义预测有效性、现实吉凶或固定应期';
}

export interface XiaoliurenEvidenceAnalysis {
  sources: Array<{ title: string; evidence: string; role: '传统规则来源' | '历法计算来源' }>;
  calculationFact: XiaoliurenCalculationFact;
  calculationFacts: string[];
  calculationChain: string[];
  stages: XiaoliurenStageEvidence[];
  transitions: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidence: string[];
  timingBasis: string[];
  triggerConditions: string[];
  limitations: string[];
  traditionalFacts: XiaoliurenTraditionalFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const SUPPORT_TENDENCIES = new Set(['宜推进', '有助力']);
const CONSTRAINT_TENDENCIES = new Set(['宜等待', '易反复', '易争执', '易落空']);
const TRADITIONAL_FACT_LIMITATION =
  '六宫宫义与传统属性只用于当前课式的近事情境分类，不证明现实中的结果、疾病、身体问题、方位吉凶或固定应期' as const;
const CALCULATION_FACT_LIMITATION =
  '逐宫顺数只证明起课基数、农历日数和时辰数如何定位起因、过程、结果三宫，不证明宫义预测有效性、现实吉凶或固定应期' as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function conditionXiaoliurenTraditionalText(text: string): string {
  return text
    .replace(/吉凶凶（大凶）/g, '传统分类高风险')
    .replace(/吉凶平（偏凶）/g, '传统分类混合偏风险')
    .replace(/吉凶凶/g, '传统分类风险')
    .replace(/吉凶吉/g, '传统分类有利')
    .replace(/身体部位/g, '传统身体类象')
    .replace(/(^|；)方位/g, '$1传统方位')
    .replace(/(^|；)神煞/g, '$1传统神煞标签')
    .replace(/传统应期/g, '传统节奏属性')
    .replace(/局势偏稳/g, '传统宫义提示局势偏稳')
    .replace(/事情容易拖延反复/g, '传统宫义提示事情可能拖延反复')
    .replace(/消息与进展来得较快/g, '传统宫义提示消息与进展可能较快出现')
    .replace(
      /容易出现争执、误会、口舌或情绪冲撞/g,
      '传统宫义提示可能出现争执、误会、口舌或情绪冲撞',
    )
    .replace(/事情整体可成/g, '传统宫义提示具备推进线索')
    .replace(
      /当前信息虚、时机虚或目标虚，容易白忙一场/g,
      '传统宫义提示信息、时机或目标可能尚未落实，投入可能暂未形成有效结果',
    )
    .replace(/当前容易落空或判断失真/g, '传统宫义提示线索可能尚未落实或判断依据不足')
    .replace(/当前有较快起色/g, '传统宫义提示可留意较快出现的进展线索')
    .replace(/当前整体偏可成/g, '传统宫义提示可关注渐进推进条件')
    .replace(/凶（大凶）/g, '传统高风险分类')
    .replace(/平（偏凶）/g, '传统混合偏风险分类')
    .replace(/(^|[；，。])凶(?=$|[；，。])/g, '$1传统风险分类')
    .replace(/(^|[；，。])吉(?=$|[；，。])/g, '$1传统有利分类')
    .replace(/应期不定或落空，需重新评估/g, '传统节奏不定，须以目标、信息和承诺是否落实为复核条件')
    .replace(/必然/g, '可能')
    .replace(/必定/g, '较可能');
}

function buildTraditionalFacts(stages: XiaoliurenStageEvidence[]): XiaoliurenTraditionalFact[] {
  const facts = new Map<string, XiaoliurenTraditionalFact>();
  for (const stage of stages) {
    const meaningKey = `${stage.palace.name}:meaning`;
    const previousMeaning = facts.get(meaningKey);
    facts.set(meaningKey, {
      key: `palace:${stage.palace.name}:meaning`,
      palace: stage.palace.name,
      stages: [...(previousMeaning?.stages ?? []), stage.stage],
      kind: '宫位解释',
      originalText: stage.palace.meaning,
      promptText: conditionXiaoliurenTraditionalText(stage.palace.meaning),
      sources: ['《小六壬金口诀》《李淳风六壬时课》六宫取象'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
    const attributeKey = `${stage.palace.name}:attributes`;
    const previousAttribute = facts.get(attributeKey);
    const originalText = [
      stage.palace.fortune ? `吉凶${stage.palace.fortune}` : '',
      stage.palace.direction ? `方位${stage.palace.direction}` : '',
      stage.palace.shenSha ? `神煞${stage.palace.shenSha}` : '',
      stage.palace.yinYang ? `${stage.palace.yinYang}宫` : '',
      stage.palace.number ? `传统宫数${stage.palace.number}` : '',
      stage.palace.seasonProsper ? `传统旺季${stage.palace.seasonProsper}` : '',
      stage.palace.bodyPart ? `身体部位${stage.palace.bodyPart}` : '',
      stage.palace.timing ? `传统应期${stage.palace.timing}` : '',
    ]
      .filter(Boolean)
      .join('；');
    facts.set(attributeKey, {
      key: `palace:${stage.palace.name}:attributes`,
      palace: stage.palace.name,
      stages: [...(previousAttribute?.stages ?? []), stage.stage],
      kind: '传统属性',
      originalText: originalText || '未列传统属性',
      promptText: originalText
        ? `${conditionXiaoliurenTraditionalText(originalText)}；身体部位仅为传统类象，不作健康判断；方位与应期须结合现实条件复核`
        : '未列传统属性',
      sources: ['小六壬六宫传统吉凶、方位、神煞、身体部位与应期属性表'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  }
  return Array.from(facts.values());
}

function buildStage(
  stage: XiaoliurenStageEvidence['stage'],
  palace: XiaoliurenPalaceDetail,
  seasonState: string,
): XiaoliurenStageEvidence {
  const role =
    stage === '起因'
      ? '说明事情的起点与既有条件'
      : stage === '过程'
        ? '说明推进方式与中段变化'
        : '作为当前课式的主要落点';
  const support = unique([
    SUPPORT_TENDENCIES.has(palace.tendency) ? `宫位倾向为${palace.tendency}` : '',
    seasonState === '旺' || seasonState === '相' ? `月令${seasonState}` : '',
    palace.keywords.length ? `关键词${palace.keywords.join('、')}` : '',
  ]);
  const constraints = unique([
    CONSTRAINT_TENDENCIES.has(palace.tendency) ? `宫位倾向为${palace.tendency}` : '',
    seasonState === '休' || seasonState === '囚' || seasonState === '死'
      ? `月令${seasonState}`
      : '',
    palace.name === '空亡' ? '空亡提示信息、目标或时机可能尚未落实，须先核实' : '',
    palace.name === '赤口' ? '赤口提示沟通冲突风险，须以现实互动复核' : '',
  ]);
  return { stage, palace, seasonState, role, support, constraints };
}

function buildXiaoliurenCalculationFact(data: XiaoliurenData): XiaoliurenCalculationFact {
  const calculation = data.calculation;
  const steps: XiaoliurenCalculationStep[] = calculation
    ? [
        {
          key: 'xiaoliuren:calculation:start',
          stage: '起因',
          expression: `${calculation.startSeed}-1`,
          seed: calculation.startSeed,
          modulo: 6,
          palaceIndex: calculation.startPalaceIndex,
          palace: data.sequence.start.name,
          promptText: `起因宫：基数${calculation.startSeed}，减1后按6取余为${calculation.startPalaceIndex}，落${data.sequence.start.name}`,
        },
        {
          key: 'xiaoliuren:calculation:process',
          stage: '过程',
          expression: `${calculation.inputBase}+${calculation.lunarDay}-1`,
          seed: calculation.processSeed,
          modulo: 6,
          palaceIndex: calculation.processPalaceIndex,
          palace: data.sequence.process.name,
          promptText: `过程宫：${calculation.inputBase}+农历日数${calculation.lunarDay}-1=${calculation.processSeed}，减1后按6取余为${calculation.processPalaceIndex}，落${data.sequence.process.name}`,
        },
        {
          key: 'xiaoliuren:calculation:result',
          stage: '结果',
          expression: `${calculation.inputBase}+${calculation.lunarDay}+${calculation.hourNumber}-2`,
          seed: calculation.resultSeed,
          modulo: 6,
          palaceIndex: calculation.resultPalaceIndex,
          palace: data.sequence.result.name,
          promptText: `结果宫：${calculation.inputBase}+农历日数${calculation.lunarDay}+时辰数${calculation.hourNumber}-2=${calculation.resultSeed}，减1后按6取余为${calculation.resultPalaceIndex}，落${data.sequence.result.name}`,
        },
      ]
    : [];
  const promptText = calculation
    ? `起课方式：${data.methodLabel}；起课基数取${calculation.inputBaseSource}${calculation.inputBase}；时辰换算：${data.hourLabel}对应传统时辰数${calculation.hourNumber}（子1至亥12）；${steps.map((item) => item.promptText).join('；')}`
    : `${data.methodLabel}确定起课基数；当前结果未附逐宫顺数中间参数，仅保留已确定三宫${data.sequence.start.name}、${data.sequence.process.name}、${data.sequence.result.name}`;
  return {
    key: `calculation:xiaoliuren:${data.method}`,
    status: calculation ? '完整' : '缺少中间参数',
    method: data.method,
    methodLabel: data.methodLabel,
    inputBase: calculation?.inputBase,
    inputBaseSource: calculation?.inputBaseSource,
    lunarDay: data.lunarDay,
    hourNumber: calculation?.hourNumber,
    steps,
    promptText,
    sources: ['起课方式、农历日数与传统时辰数', '大安至空亡六宫循环取余规则'],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

export function analyzeXiaoliurenEvidence(data: XiaoliurenData): XiaoliurenEvidenceAnalysis {
  const sources: XiaoliurenEvidenceAnalysis['sources'] = [
    {
      title: '《小六壬金口诀》《李淳风六壬时课》传统掌诀体系',
      evidence: '月、日、时或数字顺数六宫及大安、留连、速喜、赤口、小吉、空亡取象',
      role: '传统规则来源',
    },
    {
      title: '公共干支与五行关系',
      evidence: '时辰序、月支及五行旺相休囚死关系的统一计算',
      role: '历法计算来源',
    },
  ];
  const stages = [
    buildStage('起因', data.sequence.start, data.seasonStates?.start ?? '未定'),
    buildStage('过程', data.sequence.process, data.seasonStates?.process ?? '未定'),
    buildStage('结果', data.sequence.result, data.seasonStates?.result ?? '未定'),
  ];
  const traditionalFacts = buildTraditionalFacts(stages);
  const transitions = [
    `起因${data.sequence.start.name}${data.sequence.start.element} → 过程${data.sequence.process.name}${data.sequence.process.element}：${data.wuxingRelations.startToProcess}`,
    `过程${data.sequence.process.name}${data.sequence.process.element} → 结果${data.sequence.result.name}${data.sequence.result.element}：${data.wuxingRelations.processToResult}`,
  ];
  const calculationFact = buildXiaoliurenCalculationFact(data);
  const calculationFacts = data.calculation
    ? [
        `起课方式：${data.methodLabel}；起课基数取${data.calculation.inputBaseSource}${data.calculation.inputBase}`,
        `时辰换算：${data.hourLabel}对应传统时辰数${data.calculation.hourNumber}（子1至亥12）`,
        `起因宫：基数${data.calculation.startSeed}，减1后按6取余为${data.calculation.startPalaceIndex}，落${data.sequence.start.name}`,
        `过程宫：${data.calculation.inputBase}+农历日数${data.calculation.lunarDay}-1=${data.calculation.processSeed}，减1后按6取余为${data.calculation.processPalaceIndex}，落${data.sequence.process.name}`,
        `结果宫：${data.calculation.inputBase}+农历日数${data.calculation.lunarDay}+时辰数${data.calculation.hourNumber}-2=${data.calculation.resultSeed}，减1后按6取余为${data.calculation.resultPalaceIndex}，落${data.sequence.result.name}`,
      ]
    : [
        `${data.methodLabel}确定起课基数；当前课式记录农历${data.lunarMonth}月${data.lunarDay}日、${data.hourLabel}`,
        `当前结果未附逐宫顺数中间参数，仅保留已确定三宫${data.sequence.start.name}、${data.sequence.process.name}、${data.sequence.result.name}`,
      ];
  const calculationChain = [
    ...calculationFacts,
    '按六宫顺序分别定位起因、过程与结果三宫',
    `三宫定位为${data.sequence.start.name} → ${data.sequence.process.name} → ${data.sequence.result.name}`,
    `比较起因至过程、过程至结果的五行关系：${data.wuxingRelations.startToProcess}、${data.wuxingRelations.processToResult}`,
    '以结果宫为主要落点，月令旺衰、方位、神煞和传统应期属性只作辅助资料',
  ];
  const counterEvidence = unique(stages.flatMap((item) => item.constraints));
  const isRandomMethod = data.method === 'random';
  const trace = data.meta?.random;
  const randomFact = buildRandomTraceFact({
    key: `random:xiaoliuren:${data.method}`,
    applicable: isRandomMethod,
    trace,
    processLabel: `${data.methodLabel}的起课基数生成过程`,
    sources: ['小六壬起课方式与基数记录', '随机起课样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const timingBasis = unique(data.timingEvidence?.primaryBasis ?? []);
  const triggerConditions = unique([
    ...(data.timingEvidence?.triggerConditions ?? []),
    data.timingEvidence ? `盘内相对节奏为${data.timingEvidence.rhythm}` : '',
    '以消息、沟通、资源、手续或目标是否落实等现实事件复核，不只依据宫名判断',
  ]);
  const limitations = unique([
    ...(data.timingEvidence?.limitations ?? []),
    '六宫、五行、旺衰、方位和神煞属于传统取象规则，不是现代统计预测模型',
    '时间、数字与随机起课只改变起课输入，不代表其中一种方式具有更高预测准确率',
    '结果宫是当前课式主轴，不得跳过起因与过程直接套用固定吉凶断语',
    '方位、身体部位、传统吉凶标签和神煞不得单独证明现实事件，也不得换算成功率或唯一日期',
  ]);
  const items: PromptEvidenceItem[] = [
    {
      level: calculationFact.status === '完整' ? '主证' : '反证',
      title: '起课输入与逐宫顺数',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起课算式', data.method, calculationFact.status],
    },
    ...stages.map((item, index): PromptEvidenceItem => ({
      level: index === 2 ? '主证' : '辅证',
      title: `${item.stage}${item.palace.name}`,
      detail: `${item.role}；五行${item.palace.element}，月令${item.seasonState}；宫义${traditionalFacts.find((fact) => fact.palace === item.palace.name && fact.kind === '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(item.palace.meaning)}；传统辅证${traditionalFacts.find((fact) => fact.palace === item.palace.name && fact.kind === '传统属性')?.promptText ?? '未列'}；支持${item.support.join('、') || '未见独立增强条件'}；限制${item.constraints.join('、') || '未见明确限制标签'}；边界${TRADITIONAL_FACT_LIMITATION}。`,
      source: '六宫顺数定位、三段课式与月令五行旺衰',
      tags: [item.stage, item.palace.name, item.palace.element],
    })),
  ];
  items.push(
    {
      level: '主证',
      title: '三宫五行推进',
      detail: `${transitions.join('；')}；综合描述：${data.wuxingRelations.description}。`,
      source: '三宫五行生克逐段比较',
      tags: ['五行推进'],
    },
    ...(timingBasis.length
      ? [
          {
            level: '辅证' as const,
            title: '盘内节奏依据',
            detail: `${timingBasis.join('；')}；节奏标签${data.timingEvidence?.rhythm ?? '未定'}。`,
            source: '结果宫、三宫推进与传统快慢属性逐项整理',
            tags: ['节奏', data.timingEvidence?.rhythm ?? '未定'],
          },
        ]
      : []),
    ...(isRandomMethod
      ? [
          {
            level: randomFact.status === '可重放' ? ('辅证' as const) : ('反证' as const),
            title: randomFact.status === '可重放' ? '随机起课重放记录' : '随机轨迹缺失',
            detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
            source: randomFact.sources.join('、'),
            tags: ['随机起课', randomFact.status, '不代表预测有效性'],
          },
        ]
      : []),
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: detail.split('，')[0],
      detail,
      source: '宫位倾向、月令状态与现实条件核验',
    })),
    {
      level: '限制',
      title: '小六壬解释边界',
      detail: limitations.join('；'),
      source: '计算事实与解释结论分离原则',
      tags: ['传统模型', '证据边界'],
    },
  );
  const evidence: PromptEvidenceBundle = {
    title: '小六壬三宫推进结构化证据',
    items,
  };
  const promptText = [
    '【小六壬三宫推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `推进关系：${transitions.join('；')}。`,
    `反证限制：${counterEvidence.join('；') || '未见明确休囚、争执、反复或落空标签，仍须现实进展复核'}。`,
    `触发条件：${triggerConditions.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');

  return {
    sources,
    calculationFact,
    calculationFacts,
    calculationChain,
    stages,
    transitions,
    randomFact,
    randomFacts,
    counterEvidence,
    timingBasis,
    triggerConditions,
    limitations,
    traditionalFacts,
    evidence,
    promptText,
    methodology: [
      '先按起课方式复核输入，再依六宫顺序定位起因、过程和结果。',
      '结果宫作为主要落点，起因与过程用于解释来源和推进过程。',
      '逐段比较三宫五行关系，并以月令旺衰补充条件成熟度。',
      '宫位限制与不利状态作为反证明确列出，不只罗列支持信息。',
      '方位、神煞、身体部位与应期属性只作传统辅助，不生成概率、总分或绝对日期。',
    ],
  };
}
