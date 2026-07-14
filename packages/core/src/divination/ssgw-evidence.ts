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

export interface SsgwRitualThrowFact {
  attempt: number;
  firstFace: '阳面' | '阴面' | null;
  secondFace: '阳面' | '阴面' | null;
  result: '圣杯' | '笑杯' | '阴杯';
  promptText: string;
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
  limitation: '掷筊记录只证明项目模拟仪式的执行顺序和确认状态；圣杯、笑杯或阴杯不证明疾病、法律、财务、隐私、未来事件、神意来源或预测有效性';
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

export interface SsgwEvidenceAnalysis {
  signText: {
    number: number;
    title: string;
    poem: string;
  };
  story?: string;
  promptStory?: string;
  interpretations: Array<{
    field: string;
    text: string;
    originalText: string;
    promptText: string;
    role: '核心分类' | '补充条目';
    source: '项目整理的传统分类释义';
    limitation: '仅作象征类比，不是事实结论或结果保证';
  }>;
  missingFields: string[];
  drawFact: SsgwDrawFact;
  ritualFact: SsgwRitualFact;
  randomFact: SsgwRandomFact;
  drawFacts: string[];
  ritualFacts: string[];
  randomFacts: string[];
  sources: Array<{ title: string; evidence: string; role: '传统签本' | '项目资料' | '公共算法' }>;
  counterEvidence: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const DRAW_FACT_LIMITATION =
  '签池大小、随机索引和签号对应关系只证明本次抽签过程及结果一致；不证明签文有效性、神意来源、现实事件或预测结果' as const;

const RITUAL_FACT_LIMITATION =
  '掷筊记录只证明项目模拟仪式的执行顺序和确认状态；圣杯、笑杯或阴杯不证明疾病、法律、财务、隐私、未来事件、神意来源或预测有效性' as const;

const RANDOM_FACT_LIMITATION =
  '随机模式、种子和原始样本只用于复现抽签与掷筊过程；不表示可信度、神意或预测有效性，也不表示事件概率或结果保证' as const;

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
      source: '项目整理的传统分类释义' as const,
      limitation: '仅作象征类比，不是事实结论或结果保证' as const,
    }));
  const missingFields = SSGW_INTERPRETATION_FIELDS.filter((field) => !details[field]?.trim());
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
        sources: ['三山国王九十二签签池', '命语统一随机整数抽取与签号索引'],
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
  const ritualFact: SsgwRitualFact = data.ritual
    ? {
        key: '仪式:掷筊确认',
        status: data.ritual.confirmed ? '已确认' : '未确认',
        confirmed: Boolean(data.ritual.confirmed),
        rejected: Boolean(data.ritual.rejected),
        throws: ritualThrows,
        reason: data.ritual.reason,
        promptText: `掷筊顺序：${ritualThrows.map((item) => item.promptText).join(' → ') || '没有掷筊记录'}；仪式状态：${data.ritual.confirmed ? '已出现圣杯，签文按项目模拟流程确认' : `未获圣杯${data.ritual.reason ? `；${data.ritual.reason}` : ''}`}`,
        sources: ['命语三山国王灵签模拟掷筊流程', '逐次阴阳面与圣杯、笑杯、阴杯判定记录'],
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
          ? '仪式状态：已出现圣杯，签文按项目模拟流程确认'
          : `仪式状态：未获圣杯${data.ritual.reason ? `；${data.ritual.reason}` : ''}`,
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
        promptText: `随机模式：${trace.mode}；原始随机样本数：${trace.samples.length}；随机种子保留在结构化结果中，不写入自然语言提示词；原始随机样本仅保留在结构化结果中`,
        sources: ['命语统一随机轨迹协议', '抽签与掷筊共用随机源的原始样本记录'],
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
  const sources: SsgwEvidenceAnalysis['sources'] = [
    {
      title: '三山国王祖庙九十二签体系',
      evidence: '签号、签题、签诗及求签仪式的传统材料框架',
      role: '传统签本',
    },
    {
      title: '命语三山国王灵签数据集',
      evidence: '所用资料版本收录的签诗、典故与八类分类解读',
      role: '项目资料',
    },
    {
      title: '命语统一随机轨迹协议',
      evidence: '抽签和掷筊使用同一随机源，保留seed或replay所需的原始样本',
      role: '公共算法',
    },
  ];
  const counterEvidence = [
    missingFields.length ? `缺少分类字段：${missingFields.join('、')}` : '',
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
      source: '命语三山国王灵签数据集所用版本',
      tags: ['签诗原文', `第${data.number}签`],
    },
    ...(promptStory
      ? [
          {
            level: '辅证' as const,
            title: '签附典故',
            detail: `${promptStory}；边界：仅作传统类比背景，不是事实结论或结果保证`,
            source: '命语当前签文数据收录典故',
            tags: ['典故类比'],
          },
        ]
      : []),
    ...interpretations.map((item): PromptEvidenceItem => ({
      level: item.field === '核心寓意' ? '主证' : '辅证',
      title: `${item.field}传统分类释义（非事实结论）`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: '命语整理的分类解释资料',
      tags: [item.role, item.field, '条件化表达'],
    })),
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
    `资料来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    signText: { number: data.number, title: data.title, poem: data.poem },
    story,
    promptStory,
    interpretations,
    missingFields,
    drawFact,
    ritualFact,
    randomFact,
    drawFacts,
    ritualFacts,
    randomFacts,
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
