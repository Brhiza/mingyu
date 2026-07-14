import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { SsgwData } from '../types/divination';
import { SSGW_INTERPRETATION_FIELDS } from './ssgw-data';

export interface SsgwDrawFact {
  key: '抽签:签池索引';
  status: '可核验' | '缺少索引';
  poolSize: number | null;
  selectedIndex: number | null;
  selectedNumber: number;
  resultNumber: number;
  resultTitle: string;
  promptText: string;
  sources: string[];
  limitation: '签池大小、随机索引和签号对应关系只证明本次抽签过程及结果一致；不证明签文有效性、神意来源、现实事件或预测结果';
}

export interface SsgwSignFact {
  key: 'ssgw:sign-text';
  status: '完整' | '签诗为空';
  number: number;
  title: string;
  poem: string;
  promptText: string;
  sources: string[];
  limitation: '签号、签题和签诗只证明当前采用资料版本中的文本对应关系；不证明神意来源、预测有效性、现实事件或唯一解释';
}

export interface SsgwRitualThrowFact {
  attempt: number;
  firstFace: '阳面' | '阴面' | null;
  secondFace: '阳面' | '阴面' | null;
  result: '圣杯' | '笑杯' | '阴杯';
  promptText: string;
}

export interface SsgwRitualThrowEvidenceFact extends SsgwRitualThrowFact {
  key: string;
  sources: string[];
  limitation: '单次掷筊事实只记录两枚筊杯的阴阳面及其对应结果；不证明神意来源、现实吉凶、事件概率或预测有效性';
}

export interface SsgwRitualFact {
  key: '仪式:掷筊确认';
  status: '已确认' | '未确认' | '缺少记录';
  confirmed: boolean | null;
  rejected: boolean | null;
  throws: SsgwRitualThrowFact[];
  reason?: string;
  promptText: string;
  sources: string[];
  limitation: '掷筊记录只证明模拟仪式的执行顺序和确认状态；圣杯、笑杯或阴杯不证明疾病、法律、财务、隐私、未来事件、神意来源或预测有效性';
}

export interface SsgwRandomFact {
  key: '随机:重放轨迹';
  status: '可重放' | '缺少轨迹';
  mode: 'system' | 'seeded' | 'custom' | 'replay' | null;
  seed?: string | number;
  samples: number[];
  sampleCount: number;
  promptText: string;
  sources: string[];
  limitation: '随机模式、种子和原始样本只用于复现抽签与掷筊过程；不表示可信度、神意或预测有效性，也不表示事件概率或结果保证';
}

export interface SsgwInterpretationFact {
  key: string;
  status: '已收录';
  field: string;
  text: string;
  originalText: string;
  promptText: string;
  role: '核心分类' | '补充条目';
  source: '传统分类释义资料';
  sources: string[];
  limitation: '仅作象征类比，不是事实结论或结果保证';
}

export interface SsgwMissingFieldFact {
  key: string;
  field: string;
  status: '缺失';
  promptText: string;
  sources: string[];
  limitation: '字段缺失只表示当前资料版本未提供该分类释义；不得依据其他字段反推、补造或宣称该领域已有结论';
}

export interface SsgwCoverageFact {
  key: 'ssgw:interpretation-coverage';
  status: '完整' | '存在缺口';
  expectedFields: string[];
  availableFieldKeys: string[];
  missingFieldKeys: string[];
  storyStatus: '已提供' | '缺少';
  promptText: string;
  sources: string[];
  limitation: '资料覆盖状态只说明签诗、典故和分类释义是否齐备；完整不代表解释正确，缺失时也不得从签号、签诗或其他分类反推缺失内容';
}

export interface SsgwSourceFact {
  key: string;
  status: '已声明';
  title: string;
  evidence: string;
  role: '传统签本' | '整理资料' | '随机协议';
  promptText: string;
  limitation: '来源声明只标明文本、分类释义或随机记录的出处层级；不等于现代实证验证、神意证明或现实结果保证';
}

export interface SsgwEvidenceAnalysis {
  signText: {
    number: number;
    title: string;
    poem: string;
  };
  story?: string;
  promptStory?: string;
  signFact: SsgwSignFact;
  interpretations: SsgwInterpretationFact[];
  interpretationFacts: SsgwInterpretationFact[];
  missingFields: string[];
  missingFieldFacts: SsgwMissingFieldFact[];
  coverageFact: SsgwCoverageFact;
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  ritualThrowFacts: SsgwRitualThrowEvidenceFact[];
  randomFact: SsgwRandomFact;
  drawFacts: string[];
  ritualFacts: string[];
  randomFacts: string[];
  sourceFacts: SsgwSourceFact[];
  sources: Array<{
    title: string;
    evidence: string;
    role: '传统签本' | '整理资料' | '随机协议';
  }>;
  counterEvidence: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const DRAW_FACT_LIMITATION =
  '签池大小、随机索引和签号对应关系只证明本次抽签过程及结果一致；不证明签文有效性、神意来源、现实事件或预测结果' as const;

const SIGN_FACT_LIMITATION =
  '签号、签题和签诗只证明当前采用资料版本中的文本对应关系；不证明神意来源、预测有效性、现实事件或唯一解释' as const;

const RITUAL_FACT_LIMITATION =
  '掷筊记录只证明模拟仪式的执行顺序和确认状态；圣杯、笑杯或阴杯不证明疾病、法律、财务、隐私、未来事件、神意来源或预测有效性' as const;

const RITUAL_THROW_FACT_LIMITATION =
  '单次掷筊事实只记录两枚筊杯的阴阳面及其对应结果；不证明神意来源、现实吉凶、事件概率或预测有效性' as const;

const RANDOM_FACT_LIMITATION =
  '随机模式、种子和原始样本只用于复现抽签与掷筊过程；不表示可信度、神意或预测有效性，也不表示事件概率或结果保证' as const;

const MISSING_FIELD_FACT_LIMITATION =
  '字段缺失只表示当前资料版本未提供该分类释义；不得依据其他字段反推、补造或宣称该领域已有结论' as const;

const COVERAGE_FACT_LIMITATION =
  '资料覆盖状态只说明签诗、典故和分类释义是否齐备；完整不代表解释正确，缺失时也不得从签号、签诗或其他分类反推缺失内容' as const;

const SOURCE_FACT_LIMITATION =
  '来源声明只标明文本、分类释义或随机记录的出处层级；不等于现代实证验证、神意证明或现实结果保证' as const;

function conditionSsgwRitualReason(reason?: string) {
  return reason
    ?.replace(/完成项目模拟求签流程/g, '完成本次模拟求签流程')
    .replace(/按项目仪式规则/g, '按本次模拟流程');
}

export function conditionSsgwInterpretation(text: string): string {
  return text
    .replace(/成功是必然的结果/g, '传统象意偏向成功，但结果仍取决于现实条件')
    .replace(/结果必然失败/g, '失败风险很高')
    .replace(/必然两败俱伤/g, '容易两败俱伤')
    .replace(/必然会/g, '很可能会')
    .replace(/必然是/g, '容易形成')
    .replace(/必然走向/g, '可能走向')
    .replace(/必然失败/g, '失败风险很高')
    .replace(/必然后悔/g, '后悔风险很高')
    .replace(/必定成功/g, '较有机会成功')
    .replace(/必能/g, '较有机会')
    .replace(/必败/g, '失败风险很高')
    .replace(/必然/g, '往往');
}

export function analyzeSsgwEvidence(data: SsgwData): SsgwEvidenceAnalysis {
  const details = data.details ?? {};
  const story = data.story?.trim() || details['典故']?.trim() || undefined;
  const promptStory = story ? conditionSsgwInterpretation(story) : undefined;
  const signFact: SsgwSignFact = {
    key: 'ssgw:sign-text',
    status: data.poem.trim() ? '完整' : '签诗为空',
    number: data.number,
    title: data.title,
    poem: data.poem,
    promptText: data.poem.trim()
      ? `第${data.number}签《${data.title}》已记录签诗原文`
      : `第${data.number}签《${data.title}》未提供签诗原文，不得补造签诗`,
    sources: ['当前采用的三山国王九十二签资料版本'],
    limitation: SIGN_FACT_LIMITATION,
  };
  const interpretations = Object.entries(details)
    .filter(([field, text]) => field !== '典故' && text?.trim())
    .map(([field, text]) => ({
      field,
      text: text.trim(),
      originalText: text.trim(),
      promptText: conditionSsgwInterpretation(text.trim()),
      role: SSGW_INTERPRETATION_FIELDS.includes(field as never)
        ? ('核心分类' as const)
        : ('补充条目' as const),
      key: `ssgw:interpretation:${field}`,
      status: '已收录' as const,
      source: '传统分类释义资料' as const,
      sources: ['当前采用的分类释义资料', `第${data.number}签《${data.title}》${field}字段`],
      limitation: '仅作象征类比，不是事实结论或结果保证' as const,
    }));
  const missingFields = SSGW_INTERPRETATION_FIELDS.filter((field) => !details[field]?.trim());
  const missingFieldFacts: SsgwMissingFieldFact[] = missingFields.map((field) => ({
    key: `ssgw:missing-interpretation:${field}`,
    field,
    status: '缺失',
    promptText: `当前资料未提供“${field}”分类释义，不得由其他字段反推`,
    sources: ['当前签文分类字段完整性核验'],
    limitation: MISSING_FIELD_FACT_LIMITATION,
  }));
  const coverageFact: SsgwCoverageFact = {
    key: 'ssgw:interpretation-coverage',
    status: signFact.status !== '完整' || missingFields.length || !story ? '存在缺口' : '完整',
    expectedFields: [...SSGW_INTERPRETATION_FIELDS],
    availableFieldKeys: interpretations.map((item) => item.key),
    missingFieldKeys: missingFieldFacts.map((item) => item.key),
    storyStatus: story ? '已提供' : '缺少',
    promptText: `资料覆盖：签诗${signFact.status === '完整' ? '已提供' : '缺少'}；典故${story ? '已提供' : '缺少'}；分类释义${missingFields.length ? `缺少${missingFields.join('、')}` : '完整'}`,
    sources: ['签诗、典故与八类分类字段逐项核验'],
    limitation: COVERAGE_FACT_LIMITATION,
  };
  const drawFact: SsgwDrawFact = data.draw
    ? {
        key: '抽签:签池索引',
        status: '可核验',
        poolSize: data.draw.poolSize,
        selectedIndex: data.draw.selectedIndex,
        selectedNumber: data.draw.selectedNumber,
        resultNumber: data.number,
        resultTitle: data.title,
        promptText: `签池共${data.draw.poolSize}签，随机索引${data.draw.selectedIndex}（从0起）对应第${data.draw.selectedNumber}签；结果核验为第${data.number}签《${data.title}》`,
        sources: ['三山国王九十二签签池', '统一随机整数抽取与签号索引记录'],
        limitation: DRAW_FACT_LIMITATION,
      }
    : {
        key: '抽签:签池索引',
        status: '缺少索引',
        poolSize: null,
        selectedIndex: null,
        selectedNumber: data.number,
        resultNumber: data.number,
        resultTitle: data.title,
        promptText: `当前结果未附签池索引过程，仅保留已确定的第${data.number}签《${data.title}》`,
        sources: ['当前已确定签号与签题'],
        limitation: DRAW_FACT_LIMITATION,
      };
  const drawFacts = data.draw
    ? [
        `签池共${data.draw.poolSize}签，随机索引${data.draw.selectedIndex}（从0起）对应第${data.draw.selectedNumber}签`,
        `抽签结果核验：第${data.number}签《${data.title}》`,
      ]
    : [`当前结果未附签池索引过程，仅保留已确定的第${data.number}签《${data.title}》`];
  const ritualThrows: SsgwRitualThrowFact[] =
    data.ritual?.throws.map((item, index) => ({
      attempt: index + 1,
      firstFace: item.firstFace ?? null,
      secondFace: item.secondFace ?? null,
      result: item.result,
      promptText: `第${index + 1}次${item.firstFace && item.secondFace ? `${item.firstFace}+${item.secondFace}=` : ''}${item.result}`,
    })) ?? [];
  const ritualThrowFacts: SsgwRitualThrowEvidenceFact[] = ritualThrows.map((item) => ({
    ...item,
    key: `ssgw:ritual-throw:${item.attempt}`,
    sources: ['逐次阴阳面记录', '圣杯、笑杯与阴杯判定规则'],
    limitation: RITUAL_THROW_FACT_LIMITATION,
  }));
  const ritualReason = conditionSsgwRitualReason(data.ritual?.reason);
  const ritualFact: SsgwRitualFact = data.ritual
    ? {
        key: '仪式:掷筊确认',
        status: data.ritual.confirmed ? '已确认' : '未确认',
        confirmed: Boolean(data.ritual.confirmed),
        rejected: Boolean(data.ritual.rejected),
        throws: ritualThrows,
        reason: ritualReason,
        promptText: `掷筊顺序：${ritualThrows.map((item) => item.promptText).join(' → ') || '没有掷筊记录'}；仪式状态：${data.ritual.confirmed ? '已出现圣杯，签文按本次模拟流程确认' : `未获圣杯${ritualReason ? `；${ritualReason}` : ''}`}`,
        sources: ['三山国王灵签模拟掷筊流程', '逐次阴阳面与圣杯、笑杯、阴杯判定记录'],
        limitation: RITUAL_FACT_LIMITATION,
      }
    : {
        key: '仪式:掷筊确认',
        status: '缺少记录',
        confirmed: null,
        rejected: null,
        throws: [],
        promptText: '仪式状态：旧结果或外部数据未提供掷筊记录，不得补写圣杯确认',
        sources: ['当前结果字段完整性核验'],
        limitation: RITUAL_FACT_LIMITATION,
      };
  const ritualFacts = data.ritual
    ? [
        `掷筊顺序：${
          data.ritual.throws
            .map(
              (item, index) =>
                `第${index + 1}次${item.firstFace && item.secondFace ? `${item.firstFace}+${item.secondFace}=` : ''}${item.result}`,
            )
            .join(' → ') || '没有掷筊记录'
        }`,
        data.ritual.confirmed
          ? '仪式状态：已出现圣杯，签文按本次模拟流程确认'
          : `仪式状态：未获圣杯${ritualReason ? `；${ritualReason}` : ''}`,
      ]
    : ['仪式状态：旧结果或外部数据未提供掷筊记录，不得补写圣杯确认'];
  const trace = data.meta?.random;
  const randomFact: SsgwRandomFact = trace
    ? {
        key: '随机:重放轨迹',
        status: '可重放',
        mode: trace.mode,
        ...(trace.seed !== undefined ? { seed: trace.seed } : {}),
        samples: [...trace.samples],
        sampleCount: trace.samples.length,
        promptText: `随机模式：${trace.mode}；原始随机样本数：${trace.samples.length}；随机种子与原始样本仅保存在机器可读记录中，不在本段提示词展开`,
        sources: ['统一随机轨迹协议', '抽签与掷筊共用随机源的原始样本记录'],
        limitation: RANDOM_FACT_LIMITATION,
      }
    : {
        key: '随机:重放轨迹',
        status: '缺少轨迹',
        mode: null,
        samples: [],
        sampleCount: 0,
        promptText: '当前结果未附随机轨迹，无法验证抽签与掷筊的重放过程',
        sources: ['当前结果随机元数据完整性核验'],
        limitation: RANDOM_FACT_LIMITATION,
      };
  const randomFacts = trace
    ? [
        `随机模式：${trace.mode}`,
        `原始随机样本数：${trace.samples.length}`,
        trace.seed !== undefined ? `随机种子：${String(trace.seed)}` : '',
      ].filter(Boolean)
    : ['当前结果未附随机轨迹，无法验证抽签与掷筊的重放过程'];
  const sourceFacts: SsgwSourceFact[] = [
    {
      key: 'ssgw:source:traditional-signbook',
      status: '已声明',
      title: '三山国王祖庙九十二签体系',
      evidence: '签号、签题、签诗及求签仪式的传统材料框架',
      role: '传统签本',
      promptText: '传统签本来源：三山国王祖庙九十二签体系，提供签号、签题、签诗及仪式材料框架',
      limitation: SOURCE_FACT_LIMITATION,
    },
    {
      key: 'ssgw:source:compiled-material',
      status: '已声明',
      title: '当前采用的九十二签资料版本',
      evidence: '所用资料版本收录的签诗、典故与八类分类解读',
      role: '整理资料',
      promptText: '整理资料来源：当前采用的九十二签资料版本，收录签诗、典故与八类分类解读',
      limitation: SOURCE_FACT_LIMITATION,
    },
    {
      key: 'ssgw:source:random-trace',
      status: '已声明',
      title: '可重放随机轨迹记录',
      evidence: '抽签和掷筊使用同一随机源，保留seed或replay所需的原始样本',
      role: '随机协议',
      promptText: '随机记录来源：抽签和掷筊使用同一随机源，并保留重放所需的原始样本',
      limitation: SOURCE_FACT_LIMITATION,
    },
  ];
  const sources: SsgwEvidenceAnalysis['sources'] = sourceFacts.map(({ title, evidence, role }) => ({
    title,
    evidence,
    role,
  }));
  const counterEvidence = [
    signFact.status === '完整' ? '' : signFact.promptText,
    ...missingFieldFacts.map((item) => item.promptText),
    story ? '' : '当前资料没有典故，不得自行补造人物或事件',
  ].filter(Boolean);
  const limitations = [
    '签诗、典故、分类解读与掷筊仪式属于传统象征材料，不是现代统计或因果证据',
    '签诗原文是文本主证；典故只提供类比背景，不得覆盖或改写签诗原意',
    'seed或replay只能证明随机过程可以重放，不证明预测有效性或神意来源',
    '圣杯只表示本次模拟仪式已完成，不证明疾病、法律、财务、隐私或未来事实',
    '不得由签号、诗句数字或典故年代换算绝对日期、成功率、灾祸概率或保证有效的化解方案',
    '不同庙本可能存在签序、题名和字句差异，引用时应注明所用签文资料版本',
  ];
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: '签池抽取索引事实',
      detail: `${drawFact.promptText}；边界：${drawFact.limitation}`,
      source: drawFact.sources.join('；'),
      tags: ['签池', '抽签索引', '可重放'],
    },
    {
      level: '主证',
      title: `第${data.number}签《${data.title}》签诗原文`,
      detail: data.poem,
      source: '当前采用的三山国王九十二签资料版本',
      tags: ['签诗原文', `第${data.number}签`],
    },
    ...(promptStory
      ? [
          {
            level: '辅证' as const,
            title: '签附典故',
            detail: `${promptStory}；边界：仅作传统类比背景，不是事实结论或结果保证`,
            source: '当前采用的签文资料所收录典故',
            tags: ['典故类比'],
          },
        ]
      : []),
    ...interpretations.map((item): PromptEvidenceItem => ({
      level: item.field === '核心寓意' ? '主证' : '辅证',
      title: `${item.field}传统分类释义（非事实结论）`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('；'),
      tags: [item.role, item.field, '条件化表达'],
    })),
    {
      level: coverageFact.status === '完整' ? '辅证' : '反证',
      title: '签文资料覆盖状态',
      detail: `${coverageFact.promptText}；边界：${coverageFact.limitation}`,
      source: coverageFact.sources.join('；'),
      tags: ['资料覆盖', coverageFact.status],
    },
    {
      level: data.ritual?.confirmed ? '辅证' : '反证',
      title: data.ritual?.confirmed ? '模拟求签仪式完成记录' : '模拟求签仪式未完成',
      detail: `${ritualFact.promptText}；边界：${ritualFact.limitation}`,
      source: ritualFact.sources.join('；'),
      tags: ['仪式流程', data.ritual?.confirmed ? '已确认' : '未确认', '不代表现实结论'],
    },
    {
      level: trace ? '辅证' : '反证',
      title: trace ? '随机过程重放记录' : '随机轨迹缺失',
      detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
      source: randomFact.sources.join('；'),
      tags: ['随机轨迹', trace ? '可重放' : '不可核验', '不代表预测有效性'],
    },
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: '当前资料或仪式缺口',
      detail,
      source: '签文字段与掷筊记录逐项核验',
    })),
    {
      level: '限制',
      title: '灵签文本与仪式证据边界',
      detail: limitations.join('；'),
      source: '传统象征材料、随机事实与现实结论分离原则',
      tags: ['传统材料', '现实复核'],
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '三山国王灵签文本与仪式结构化证据', items };
  const promptEvidence: PromptEvidenceBundle = {
    ...evidence,
    items: items.map((item) => {
      if (item.title.includes('签诗原文')) {
        return { ...item, detail: '原文见上方“签诗”，此处只标记其主证地位。' };
      }
      if (item.title === '签附典故') {
        return { ...item, detail: '典故全文见上方“典故”，此处只标记其辅证地位。' };
      }
      return item;
    }),
  };
  const promptText = [
    '【三山国王灵签文本与仪式结构化证据】',
    ...formatPromptEvidenceBundle(promptEvidence),
    `仪式事实：${ritualFact.promptText}。`,
    `抽签事实：${drawFact.promptText}。`,
    `随机事实：${randomFact.promptText}。`,
    `资料来源：${sourceFacts.map((item) => item.promptText).join('；')}。`,
  ].join('\n');
  return {
    signText: { number: data.number, title: data.title, poem: data.poem },
    story,
    promptStory,
    signFact,
    interpretations,
    interpretationFacts: interpretations,
    missingFields,
    missingFieldFacts,
    coverageFact,
    drawFact,
    ritualFact,
    ritualThrowFacts,
    randomFact,
    drawFacts,
    ritualFacts,
    randomFacts,
    sourceFacts,
    sources,
    counterEvidence,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先核对签号、签题和签诗原文，再读取典故与分类字段。',
      '签诗作为文本主证，典故与分类解读只作分层辅助，不互相替代。',
      '分类释义保留原始资料文本，同时另生成条件化提示词文本，避免把传统断语包装成结果保证。',
      '独立记录抽签随机轨迹和掷筊仪式状态；未获圣杯时停止签文解释。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
