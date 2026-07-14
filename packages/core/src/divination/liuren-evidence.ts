import type { LiurenData, LiurenLesson, LiurenTransmission } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export interface LiurenLessonEvidence extends LiurenLesson {
  index: number;
  isInitialSource: boolean;
  constraints: string[];
}

export interface LiurenTransmissionEvidence extends LiurenTransmission {
  index: number;
  label: '起点' | '过程' | '落点';
  support: string[];
  constraints: string[];
}

export interface LiurenTraditionalFact {
  key: string;
  kind: '经典取传规则' | '课体' | '天将属性' | '神煞';
  name: string;
  originalText: string;
  promptText: string;
  sources: string[];
  stages?: string[];
  branches?: string[];
  limitation: '传统规则或类象只用于限定解释方向，不证明现实事件、身份、疾病、死亡、犯罪、婚姻、法律责任或财务结果';
}

export interface LiurenEvidenceAnalysis {
  calculationFacts: string[];
  plateFacts: string[];
  patternEvidence: string[];
  shenShaEvidence: string[];
  rule: string;
  initialBranch: string;
  initialSourceLessons: string[];
  lessons: LiurenLessonEvidence[];
  transmissions: LiurenTransmissionEvidence[];
  transitions: string[];
  counterEvidence: string[];
  timingConditions: string[];
  focusEvidence: NonNullable<LiurenData['focusEvidence']>;
  timingEvidence: string[];
  traditionalFacts: LiurenTraditionalFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const TRADITIONAL_FACT_LIMITATION =
  '传统规则或类象只用于限定解释方向，不证明现实事件、身份、疾病、死亡、犯罪、婚姻、法律责任或财务结果' as const;

export function conditionLiurenTraditionalText(text: string): string {
  return text
    .replace(
      /凶丧之神，主疾病、死丧、血光、刀兵、破财/g,
      '传统属性归为风险类，传统类象涉及健康、损伤、安全与财物风险等议题',
    )
    .replace(
      /争斗纠纷之神，主官非、土地、契约、争执/g,
      '传统属性归为纠纷类，传统类象涉及法律、土地、契约与争议等议题',
    )
    .replace(
      /盗贼隐秘之神，主失窃、欺骗、隐私、阴私/g,
      '传统属性归为隐秘类，传统类象涉及财物安全、信息真实性、隐私与隐情等议题',
    )
    .replace(
      /和合之神，主婚姻、合作、合同、中介、子息/g,
      '传统属性归为和合类，传统类象涉及婚恋、合作、合同、中介与子女等议题',
    )
    .replace(
      /恩泽之神，主婚姻、恩宠、庇护、女性、长辈/g,
      '传统属性归为恩泽类，传统类象涉及婚恋、支持、照护、女性与长辈等议题',
    )
    .replace(
      /财喜之神，主升迁、钱财、喜事、贵人、仁德/g,
      '传统属性归为财喜类，传统类象涉及职位、财物、喜庆、助力与仁德等议题',
    )
    .replace(
      /虚诈孤独之神，主空亡、欺骗、孤寡、无成/g,
      '传统属性归为虚空类，传统类象涉及落空、信息真实性、疏离与推进受阻等议题',
    )
    .replace(/主反复动荡/g, '传统类象涉及反复与变动')
    .replace(/主伏而不动/g, '传统类象涉及停滞与不动')
    .replace(/事情会逐步推进/g, '传统解释可从逐步推进角度核验')
    .replace(/结果更利于/g, '传统上可关注')
    .replace(/必然/g, '可能')
    .replace(/必定/g, '较可能')
    .replace(/主(?!(?:轴|证|线|要|客|动))/g, '传统类象涉及');
}

function buildTraditionalFacts(
  data: LiurenData,
  patternEvidence: string[],
): LiurenTraditionalFact[] {
  const classicalFacts = (data.classicalRules ?? []).map((item, index): LiurenTraditionalFact => ({
    key: `classical:${index}:${item.rule}`,
    kind: '经典取传规则',
    name: item.rule,
    originalText: item.summary,
    promptText: conditionLiurenTraditionalText(item.summary),
    sources: [item.source],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const patternFacts = patternEvidence.map((name, index): LiurenTraditionalFact => ({
    key: `pattern:${index}:${name}`,
    kind: '课体',
    name,
    originalText: name,
    promptText: `盘面命中“${name}”结构标签；该标签须与四课取传、三传、旺衰和空亡互证`,
    sources: ['发用、三传结构、空亡与课体规则逐项命中'],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const tianJiangFacts = Array.from(
    data.threeTransmissions
      .reduce((facts, transmission) => {
        const props = data.tianJiangProps?.[transmission.god];
        if (!props) return facts;
        const previous = facts.get(transmission.god);
        const originalText = props.description || `${props.category}类`;
        facts.set(transmission.god, {
          key: `tianjiang:${transmission.god}`,
          kind: '天将属性',
          name: transmission.god,
          originalText,
          promptText: `${props.wuxing}${props.yinYang}，传统分类为${props.category}；${conditionLiurenTraditionalText(originalText)}`,
          sources: ['《大六壬大全》卷六《天将总论》及《大六壬指南》首卷天将章'],
          stages: [...(previous?.stages ?? []), transmission.stage],
          branches: [...(previous?.branches ?? []), transmission.branch],
          limitation: TRADITIONAL_FACT_LIMITATION,
        });
        return facts;
      }, new Map<string, LiurenTraditionalFact>())
      .values(),
  );
  const shenShaFacts = (data.shenShaSummary ?? []).map((text, index): LiurenTraditionalFact => ({
    key: `shensha:${index}:${text}`,
    kind: '神煞',
    name: text.replace(/在[子丑寅卯辰巳午未申酉戌亥]$/, ''),
    originalText: text,
    promptText: `盘面按年支、月支、日支或日干规则定位到“${conditionLiurenTraditionalText(text)}”`,
    sources: ['年支、月支、日支与日干神煞规则逐项定位'],
    branches: text.match(/[子丑寅卯辰巳午未申酉戌亥]$/)?.[0] ? [text.slice(-1)] : undefined,
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));

  return [...classicalFacts, ...patternFacts, ...tianJiangFacts, ...shenShaFacts];
}

function lessonConstraints(lesson: LiurenLesson, xunKong: string[]) {
  return [
    xunKong.includes(lesson.upper) ? `上神${lesson.upper}空亡` : '',
    xunKong.includes(lesson.lower) ? `下位${lesson.lower}空亡` : '',
    lesson.relation.includes('克') ? `${lesson.relation}形成牵制` : '',
  ].filter(Boolean);
}

function transmissionSupport(item: LiurenTransmission) {
  return [
    item.seasonState === '旺' || item.seasonState === '相' ? `月令${item.seasonState}` : '',
    item.dayRelation === '比和' || item.dayRelation?.includes('生')
      ? `与日支${item.dayRelation}`
      : '',
    item.relation === '比和' || item.relation.includes('生') ? item.relation : '',
  ].filter(Boolean);
}

function transmissionConstraints(item: LiurenTransmission) {
  return [
    item.isVoid ? `${item.stage}${item.branch}空亡` : '',
    item.seasonState === '休' || item.seasonState === '囚' || item.seasonState === '死'
      ? `月令${item.seasonState}`
      : '',
    item.dayRelation?.includes('克') || item.dayRelation?.includes('冲')
      ? `与日支${item.dayRelation}`
      : '',
    item.relation.includes('克') || item.relation.includes('冲') ? item.relation : '',
  ].filter(Boolean);
}

function formatTransmission(item: LiurenTransmissionEvidence) {
  return `${item.stage}${item.branch}乘${item.god}（${item.wuxing || '五行未列'}、月令${item.seasonState || '未定'}${item.isVoid ? '、空亡' : ''}）`;
}

export function analyzeLiurenEvidence(data: LiurenData): LiurenEvidenceAnalysis {
  if (data.fourLessons.length !== 4 || data.threeTransmissions.length !== 3) {
    throw new Error('大六壬证据分析需要完整四课与三传。');
  }
  const initial = data.threeTransmissions[0];
  const xunKong = data.xunKong ?? [];
  const calculationFacts = [
    `四柱干支：年${data.ganzhi.year}、月${data.ganzhi.month}、日${data.ganzhi.day}、时${data.ganzhi.hour}`,
    `月将加时：月将${data.monthLeader}加占时${data.divinationBranch}`,
    `贵人定位：${data.dayNight ?? '昼夜未列'}，日干贵人${data.noblemanBranch ?? '未列'}${data.noblemanGroundBranch ? `临地盘${data.noblemanGroundBranch}` : ''}`,
    `日干寄宫：${data.ganzhi.day.charAt(0)}寄${data.dayStemResidence ?? '未列'}`,
    `日柱旬空：${xunKong.join('、') || '未列'}`,
  ];
  const plateFacts = data.heavenlyPlate.map(
    (item) => `地盘${item.under}上见天盘${item.branch}乘${item.god}`,
  );
  const patternEvidence = Array.from(
    new Set([...(data.patternTags ?? []), ...(data.guaTi ?? [])].filter(Boolean)),
  );
  const shenShaEvidence = Array.from(new Set((data.shenShaSummary ?? []).filter(Boolean)));
  const traditionalFacts = buildTraditionalFacts(data, patternEvidence);
  const lessons = data.fourLessons.map((lesson, index): LiurenLessonEvidence => ({
    ...lesson,
    index: index + 1,
    isInitialSource: lesson.upper === initial.branch,
    constraints: lessonConstraints(lesson, xunKong),
  }));
  const initialSourceLessons = lessons
    .filter((item) => item.isInitialSource)
    .map((item) => item.name);
  const stageLabels = ['起点', '过程', '落点'] as const;
  const transmissions = data.threeTransmissions.map((item, index): LiurenTransmissionEvidence => {
    const normalized = { ...item, isVoid: xunKong.includes(item.branch) };
    return {
      ...normalized,
      index: index + 1,
      label: stageLabels[index],
      support: transmissionSupport(normalized),
      constraints: transmissionConstraints(normalized),
    };
  });
  const transitions = transmissions.slice(1).map((item, index) => {
    const previous = transmissions[index];
    return `${previous.stage}${previous.branch} → ${item.stage}${item.branch}：${item.relation}`;
  });
  const counterEvidence = Array.from(
    new Set([
      ...lessons.flatMap((item) => item.constraints),
      ...transmissions.flatMap((item) => item.constraints),
    ]),
  );
  const focusEvidence = data.focusEvidence ?? [];
  const timingEvidence = (data.timingEvidence ?? []).filter((item) => {
    if (!item.includes(`初传${initial.branch}`)) return true;
    return transmissions[0].isVoid ? !item.includes('不空') : !item.includes('空亡');
  });
  const timingConditions = [
    transmissions[0].isVoid
      ? `初传${initial.branch}空亡，先等待填实、冲实或现实条件落实再验`
      : `初传${initial.branch}不空，可作为当前起始信号，但仍须现实事件验证`,
    `三传顺序${transmissions.map((item) => `${item.stage}${item.branch}`).join(' → ')}只表示阶段推进`,
    `月支${data.ganzhi.month.slice(-1)}与日支${data.ganzhi.day.slice(-1)}用于核验旺衰、同支、冲合及空亡触发`,
    '未给期限时不换算唯一日期，不以神煞或课体单项指定应期',
    ...timingEvidence,
  ];

  const classicalText = data.classicalRules?.length
    ? traditionalFacts
        .filter((item) => item.kind === '经典取传规则')
        .map((item) => `${item.sources.join('、')}《${item.name}》：${item.promptText}`)
        .join('；')
    : '未附经典规则说明';
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '月将加时与贵人起盘事实',
      detail: calculationFacts.join('；'),
      source: '占时四柱、月将加时、昼夜贵人与日干寄宫逐项计算',
      tags: ['月将', '占时', '贵人', '日干寄宫', '旬空'],
    },
    {
      level: '辅证',
      title: '天地盘十二支与天将定位',
      detail: plateFacts.join('；'),
      source: '月将加占时生成天地盘，再按贵人顺逆布十二天将',
      tags: ['天地盘', '十二天将'],
    },
    {
      level: '主证',
      title: '四课取传与初传发用',
      detail: `四课${lessons.map((item) => `${item.name}${item.upper}临${item.lower}（${item.relation}）`).join('；')}；按${data.transmissionRule || '现有取传规则'}取初传${initial.branch}乘${initial.god}${initialSourceLessons.length ? `，对应${initialSourceLessons.join('、')}上神` : '，特殊取传未直接对应单一课上神'}；古籍依据：${classicalText}`,
      source: '四课、九宗门取传结果与经典规则逐项核验',
      tags: ['四课', data.transmissionRule || '取传'],
    },
    ...lessons.map((item): PromptEvidenceItem => ({
      level: item.isInitialSource ? '主证' : '辅证',
      title: `${item.name}上下神关系`,
      detail: `${item.upper}临${item.lower}，乘${item.god}，关系${item.relation}；课注${conditionLiurenTraditionalText(item.note || '未列')}；限制${item.constraints.join('、') || '未见旬空或直接克制'}`,
      source: '日干寄宫、日支与天地盘逐课推导',
      tags: ['四课', item.name, ...(item.isInitialSource ? ['初传来源'] : [])],
    })),
    ...transmissions.map((item, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${item.stage}${item.label}`,
      detail: `${formatTransmission(item)}；与前位关系${item.relation}；与日支关系${item.dayRelation || '未列'}；传注${conditionLiurenTraditionalText(item.note || '未列')}；支持${item.support.join('、') || '未见额外增强'}；限制${item.constraints.join('、') || '未见明显空亡或月令限制'}`,
      source: '三传、天将、月令旺衰、旬空与日支关系核验',
      tags: [item.stage, item.branch],
    })),
    ...transitions.map((detail, index): PromptEvidenceItem => ({
      level: '辅证',
      title: `${index === 0 ? '初传至中传' : '中传至末传'}推进关系`,
      detail,
      source: '三传先后次序与相邻地支关系',
      tags: ['三传推进', index === 0 ? '过程' : '落点'],
    })),
    ...(data.transmissionDetail
      ? [
          {
            level: '辅证' as const,
            title: '取传规则与三传模式说明',
            detail: conditionLiurenTraditionalText(data.transmissionDetail),
            source: '九宗门取传结果、三传结构与经典规则合并说明',
            tags: [
              '取传规则',
              data.transmissionRule || '未命名',
              data.transmissionPattern || '未分类',
            ],
          },
        ]
      : []),
    ...(patternEvidence.length
      ? [
          {
            level: '辅证' as const,
            title: '课体与三传结构标签',
            detail: traditionalFacts
              .filter((item) => item.kind === '课体')
              .map((item) => `${item.promptText}；边界：${item.limitation}`)
              .join('；'),
            source: '发用、三传结构、空亡与经典课体规则逐项命中',
            tags: ['课体', '结构标签'],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((item) => item.kind === '经典取传规则')
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `经典规则：${item.name}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: `${item.sources.join('、')}；原始传统文义仅供资料核对，解读采用条件化表述`,
        tags: ['经典规则', item.name],
      })),
    ...(shenShaEvidence.length
      ? [
          {
            level: '辅证' as const,
            title: '神煞定位事实',
            detail: `${traditionalFacts
              .filter((item) => item.kind === '神煞')
              .map((item) => `${item.promptText}；边界：${item.limitation}`)
              .join('；')}。神煞仅作辅助定位，不覆盖四课取传与三传主线。`,
            source: '年支、月支、日支与日干神煞规则逐项定位',
            tags: ['神煞', '辅助证据'],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((item) => item.kind === '天将属性')
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `${item.stages?.join('、') || ''}${item.name}天将属性`,
        detail: `${item.promptText}；入传位置${item.stages?.join('、') || '未列'}，地支${item.branches?.join('、') || '未列'}；边界：${item.limitation}`,
        source: `${item.sources.join('、')}；原始传统文义仅供资料核对，解读采用条件化表述`,
        tags: ['天将属性', ...(item.stages ?? []), item.name],
      })),
    ...focusEvidence.map((item): PromptEvidenceItem => ({
      level: item.level,
      title: `${item.target}${item.role}`,
      detail: `依据${item.evidence.join('、') || '未列独立证据'}；限制${item.limitations.join('、') || '仍须结合实际问题选择类神'}`,
      source: '盘面焦点对象、类神角色与课传证据逐项整理',
      tags: ['类神焦点', item.target, item.role],
    })),
    ...(timingEvidence.length
      ? [
          {
            level: '应期' as const,
            title: '应期触发证据',
            detail: timingEvidence.join('；'),
            source: '三传、空亡、月日关系与盘面时机条件',
            tags: ['应期', '触发条件'],
          },
        ]
      : []),
    ...counterEvidence.map((detail, index): PromptEvidenceItem => ({
      level: '反证',
      title: `课传限制核验${index + 1}`,
      detail,
      source: '四课、三传、旬空、月令与日支关系逐项核验',
      tags: ['反证', '课传限制'],
    })),
    {
      level: '限制',
      title: '大六壬课传解释边界',
      detail:
        '四课用于背景和取传依据，初传为发用主轴，中末传表示过程与落点；课体、天将和神煞只作辅助证据。未按具体问题选定类神时，不得把日支或任一神煞固定当作用神，也不得按证据数量生成吉凶总分或成功率。',
      source: '计算事实与解释结论分离原则',
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '大六壬四课取传与三传推进结构化证据', items };
  const promptText = [
    '【大六壬四课取传与三传推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `推进关系：${transitions.join('；')}`,
    `反证限制：${counterEvidence.join('；') || '未见明显空亡、休囚或冲克限制'}`,
    `触发条件：${timingConditions.join('；')}`,
  ].join('\n');
  return {
    calculationFacts,
    plateFacts,
    patternEvidence,
    shenShaEvidence,
    rule: data.transmissionRule || '',
    initialBranch: initial.branch,
    initialSourceLessons,
    lessons,
    transmissions,
    transitions,
    counterEvidence,
    timingConditions,
    focusEvidence,
    timingEvidence,
    traditionalFacts,
    evidence,
    promptText,
    methodology: [
      '先核验四课上下关系，再按已计算的九宗门规则确认初传发用。',
      '初传、中传、末传分别作为起点、过程、落点，逐传保留天将、旺衰、旬空和日支关系。',
      '月将加时、昼夜贵人、天地盘、日干寄宫、课体、神煞与天将属性均保留为结构化辅证。',
      '课体与神煞只作辅助标签，不覆盖发用和三传主线。',
      '未按问题选择类神时保留限制，不生成吉凶总分、成功率或绝对日期。',
    ],
  };
}
