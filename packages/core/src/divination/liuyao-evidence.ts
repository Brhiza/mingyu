import type { LiuyaoData, LiuyaoHiddenSpirit, LiuyaoYaoDetail } from '../types/divination';
import { isKe, isLiuhai, isLiuhe, isSanxing, isSheng } from '../ganzhi';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';

export type LiuyaoEvidenceTopic = 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';
export type LiuyaoGodRole = '用神' | '原神' | '忌神' | '仇神';

export interface LiuyaoEvidenceOptions {
  topic?: LiuyaoEvidenceTopic;
  /** 用户或上层明确指定的用神六亲；优先于主题默认候选。 */
  usefulGodRelative?: string;
}

export interface LiuyaoYaoReference {
  source: '本卦' | '伏神';
  position: number;
  sixRelative: string;
  branch: string;
  wuxing: string;
  isWorld?: boolean;
  isResponse?: boolean;
  isChanging?: boolean;
  isVoid: boolean;
  support: string[];
  constraints: string[];
  changedYao?: {
    sixRelative: string;
    branch: string;
    wuxing: string;
    isVoid: boolean;
    relation: LiuyaoYaoDetail['changeRelation'];
    direction: LiuyaoYaoDetail['changeDirection'];
  };
}

export interface LiuyaoUsefulGodCandidate {
  label: string;
  relative?: string;
  position?: number;
  reason: string;
  references: LiuyaoYaoReference[];
  support: string[];
  constraints: string[];
}

export interface LiuyaoGodChainItem {
  role: LiuyaoGodRole;
  wuxing: string;
  relation: string;
  references: LiuyaoYaoReference[];
}

export interface LiuyaoTraditionalSymbolFact {
  relative: string;
  positions: number[];
  originalText: string;
  promptText: string;
  source: '传统六亲类象表与当前六亲排布';
  limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果';
}

export interface LiuyaoLineFact {
  key: string;
  position: number;
  rawValue: number;
  yaoType: LiuyaoYaoDetail['yaoType'];
  changeType: string;
  sixGod: string;
  sixRelative: string;
  najia: {
    branch: string;
    wuxing: string;
  };
  roles: Array<'世爻' | '应爻'>;
  activity: '静爻' | '明动' | '暗动';
  monthState: {
    branch: string;
    seasonState?: LiuyaoYaoDetail['seasonState'];
    relations: string[];
  };
  dayState: {
    branch: string;
    relations: string[];
  };
  traditionalRelations: {
    twelveStage?: string;
    sanxingType?: string;
    liuhePartner?: string;
    isLiuhai: boolean;
    isRuMu: boolean;
  };
  isVoid: boolean;
  support: string[];
  constraints: string[];
  changedYao?: {
    sixRelative: string;
    branch: string;
    wuxing: string;
    isVoid: boolean;
    relation: LiuyaoYaoDetail['changeRelation'];
    direction: LiuyaoYaoDetail['changeDirection'];
  };
  promptText: string;
  sources: string[];
  limitation: '逐爻字段是纳甲、世应、月日旺衰与动变规则的计算事实，只限定六爻取证条件，不单独证明现实吉凶、事件、身份、疾病、官非、关系或财务结果';
}

export interface LiuyaoHiddenSpiritFact {
  key: string;
  position: number;
  sixRelative: string;
  najia: {
    branch: string;
    wuxing: string;
  };
  isVoid: boolean;
  coveringLine: LiuyaoHiddenSpirit['underYao'];
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '伏神结构只证明本卦六亲排布中存在伏藏关系；透出、受制或得助仍须结合飞神、月日、动变与现实进展复核';
}

export interface LiuyaoGenerationFact {
  key: string;
  status: '可核验' | '来源链缺失';
  method: NonNullable<LiuyaoData['generation']>['method'] | '未记录';
  methodLabel: string;
  yaoValues: number[];
  coinThrows: NonNullable<NonNullable<LiuyaoData['generation']>['coinThrows']>;
  expectedLineCount: 6;
  recordedLineCount: number;
  promptText: string;
  sources: string[];
  limitation: '起卦来源只说明卦象如何生成以及六个爻值如何录入或生成，不提高卦象证据等级，也不证明预测有效性或现实结果';
}

export interface LiuyaoEvidenceAnalysis {
  topic: LiuyaoEvidenceTopic;
  monthBranch: string;
  dayBranch: string;
  candidates: LiuyaoUsefulGodCandidate[];
  selectedCandidate: LiuyaoUsefulGodCandidate | null;
  godChain: LiuyaoGodChainItem[];
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  generationFact: LiuyaoGenerationFact;
  generationFacts: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  timingConditions: string[];
  counterEvidence: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const ELEMENTS = ['木', '火', '土', '金', '水'];

const LINE_FACT_LIMITATION =
  '逐爻字段是纳甲、世应、月日旺衰与动变规则的计算事实，只限定六爻取证条件，不单独证明现实吉凶、事件、身份、疾病、官非、关系或财务结果' as const;

const HIDDEN_SPIRIT_FACT_LIMITATION =
  '伏神结构只证明本卦六亲排布中存在伏藏关系；透出、受制或得助仍须结合飞神、月日、动变与现实进展复核' as const;
const GENERATION_FACT_LIMITATION =
  '起卦来源只说明卦象如何生成以及六个爻值如何录入或生成，不提高卦象证据等级，也不证明预测有效性或现实结果' as const;

const TRADITIONAL_RELATIVE_IMAGES: Record<string, string> = {
  父母: '传统常取文书、消息、单位、房屋、长辈、辛劳等类象',
  兄弟: '传统常取同辈、竞争、合作分配、朋友、资源消耗等类象',
  官鬼: '传统常取职责、职位、压力、忧虑、疾病、官非等类象',
  妻财: '传统常取财物、交易、资源、伴侣或关系对象等类象',
  子孙: '传统常取产出、子女、放松、解忧、医药、财源等类象',
};

export function conditionLiuyaoTraditionalText(text: string): string {
  return text
    .replace(/事势增强/g, '传统上视为合局条件较集中')
    .replace(/事体不虚/g, '传统上可作为事项线索')
    .replace(/主(?!(?:卦|轴|证|判|要|动|客))/g, '传统类象提示')
    .replace(/必然/g, '可能')
    .replace(/必定/g, '较可能');
}

function branchOf(ganzhi: string) {
  return ganzhi.slice(1, 2);
}

function formatYao(reference: LiuyaoYaoReference) {
  const changed = reference.changedYao
    ? `→${reference.changedYao.sixRelative}${reference.changedYao.branch}${reference.changedYao.wuxing}${reference.changedYao.relation ? `（${reference.changedYao.relation}）` : ''}${reference.changedYao.direction ? `（${reference.changedYao.direction}）` : ''}${reference.changedYao.isVoid ? '（变爻空亡）' : ''}`
    : '';
  return `${reference.source}${reference.position}爻${reference.sixRelative}${reference.branch}${reference.wuxing}${changed}`;
}

function buildGenerationFact(data: LiuyaoData): LiuyaoGenerationFact {
  const method = data.generation?.method ?? '未记录';
  const methodLabel =
    method === 'coins'
      ? '模拟三钱起卦'
      : method === 'manual'
        ? '手工录入六爻值'
        : method === 'time'
          ? '时间起卦'
          : '旧结果未记录起卦方式';
  const coinThrows = (data.generation?.coinThrows ?? []).map((item) => ({
    coins: [...item.coins] as [2 | 3, 2 | 3, 2 | 3],
    total: item.total,
  }));
  const recordedLineCount = method === 'manual' ? data.yaoArray.length : coinThrows.length;
  const status =
    method !== '未记录' && recordedLineCount === 6 ? ('可核验' as const) : ('来源链缺失' as const);
  const detail =
    method === 'manual'
      ? `手工爻值为${data.yaoArray.join('、') || '未列'}`
      : coinThrows.length
        ? coinThrows
            .map(
              (item, index) =>
                `第${index + 1}爻计算样本${item.coins.join('+')}=${item.total}（${item.total === 6 ? '老阴' : item.total === 7 ? '少阳' : item.total === 8 ? '少阴' : '老阳'}）`,
            )
            .join('；')
        : '未附逐爻生成记录';
  return {
    key: `generation:liuyao:${method}`,
    status,
    method,
    methodLabel,
    yaoValues: [...data.yaoArray],
    coinThrows,
    expectedLineCount: 6,
    recordedLineCount,
    promptText: `起卦方式为${methodLabel}；${detail}${status === '来源链缺失' ? `；当前仅记录${recordedLineCount}/6爻来源，不能完整核验起卦链` : ''}`,
    sources: [
      method === 'manual' ? '调用方手工录入的六个爻值' : '六爻逐爻三钱生成记录',
      '六爻起卦方式与原始爻值结果',
    ],
    limitation: GENERATION_FACT_LIMITATION,
  };
}

function buildVisibleReference(
  yao: LiuyaoYaoDetail,
  monthBranch: string,
  dayBranch: string,
): LiuyaoYaoReference {
  const support = [
    yao.isWorld ? '临世' : '',
    yao.isResponse ? '临应' : '',
    yao.isChanging ? '发动' : '',
    yao.isHiddenMove ? '暗动' : '',
    yao.seasonState === '旺' || yao.seasonState === '相' ? `月令${yao.seasonState}` : '',
    yao.najiaDizhi === monthBranch ? '值月建' : '',
    yao.najiaDizhi === dayBranch ? '值日辰' : '',
    isLiuhe(yao.najiaDizhi, monthBranch) ? '合月建' : '',
    isLiuhe(yao.najiaDizhi, dayBranch) ? '合日辰' : '',
    yao.changeRelation === '回头生' ? '回头生' : '',
    yao.changeDirection === '化进神' ? '化进神' : '',
  ].filter(Boolean);
  const constraints = [
    yao.isVoid ? '本爻空亡' : '',
    yao.isMonthBreak ? '月破' : '',
    yao.isDayBreak && !yao.isHiddenMove ? '日破' : '',
    yao.seasonState === '休' || yao.seasonState === '囚' || yao.seasonState === '死'
      ? `月令${yao.seasonState}`
      : '',
    yao.isYueMu ? '入月墓' : '',
    yao.isRiMu ? '入日墓' : '',
    yao.changeRelation === '回头克' ? '回头克' : '',
    yao.changeRelation === '回头冲' ? '回头冲' : '',
    yao.changeRelation === '化空' || yao.changedYao?.isVoid ? '变爻空亡' : '',
    yao.changeDirection === '化退神' ? '化退神' : '',
  ].filter(Boolean);
  return {
    source: '本卦',
    position: yao.position,
    sixRelative: yao.sixRelative,
    branch: yao.najiaDizhi,
    wuxing: yao.wuxing,
    isWorld: yao.isWorld,
    isResponse: yao.isResponse,
    isChanging: yao.isChanging,
    isVoid: yao.isVoid,
    support,
    constraints,
    ...(yao.changedYao
      ? {
          changedYao: {
            sixRelative: yao.changedYao.liuqin,
            branch: yao.changedYao.dizhi,
            wuxing: yao.changedYao.wuxing,
            isVoid: yao.changedYao.isVoid,
            relation: yao.changeRelation,
            direction: yao.changeDirection,
          },
        }
      : {}),
  };
}

function buildHiddenReference(spirit: LiuyaoHiddenSpirit): LiuyaoYaoReference {
  return {
    source: '伏神',
    position: spirit.position,
    sixRelative: spirit.sixRelative,
    branch: spirit.najiaDizhi,
    wuxing: spirit.wuxing,
    isVoid: spirit.isVoid,
    support: [],
    constraints: [
      '伏藏待透',
      `受飞神${spirit.underYao.sixRelative}${spirit.underYao.najiaDizhi}${spirit.underYao.wuxing}覆盖`,
      spirit.isVoid ? '伏神空亡' : '',
    ].filter(Boolean),
  };
}

function allReferences(data: LiuyaoData, monthBranch: string, dayBranch: string) {
  return [
    ...data.yaosDetail.map((yao) => buildVisibleReference(yao, monthBranch, dayBranch)),
    ...(data.hiddenSpirits ?? []).map(buildHiddenReference),
  ];
}

function buildLineFacts(
  data: LiuyaoData,
  monthBranch: string,
  dayBranch: string,
): LiuyaoLineFact[] {
  return data.yaosDetail.map((yao) => {
    const reference = buildVisibleReference(yao, monthBranch, dayBranch);
    const roles: LiuyaoLineFact['roles'] = [
      ...(yao.isWorld ? (['世爻'] as const) : []),
      ...(yao.isResponse ? (['应爻'] as const) : []),
    ];
    const monthRelations = [
      yao.najiaDizhi === monthBranch ? '值月建' : '',
      isLiuhe(yao.najiaDizhi, monthBranch) ? '合月建' : '',
      yao.isMonthBreak ? '月破' : '',
      yao.isYueMu ? '入月墓' : '',
      isLiuhai(yao.najiaDizhi, monthBranch) ? '与月建相害' : '',
      isSanxing(yao.najiaDizhi, monthBranch) ? '与月建成刑' : '',
    ].filter(Boolean);
    const dayRelations = [
      yao.najiaDizhi === dayBranch ? '值日辰' : '',
      isLiuhe(yao.najiaDizhi, dayBranch) ? '合日辰' : '',
      yao.isHiddenMove ? '日冲暗动' : yao.isDayBreak ? '日冲成破' : '',
      yao.isRiMu ? '入日墓' : '',
      isLiuhai(yao.najiaDizhi, dayBranch) ? '与日辰相害' : '',
      isSanxing(yao.najiaDizhi, dayBranch) ? '与日辰成刑' : '',
    ].filter(Boolean);
    const activity: LiuyaoLineFact['activity'] = yao.isChanging
      ? '明动'
      : yao.isHiddenMove
        ? '暗动'
        : '静爻';
    const changedYao = yao.changedYao
      ? {
          sixRelative: yao.changedYao.liuqin,
          branch: yao.changedYao.dizhi,
          wuxing: yao.changedYao.wuxing,
          isVoid: yao.changedYao.isVoid,
          relation: yao.changeRelation,
          direction: yao.changeDirection,
        }
      : undefined;
    const promptText = [
      `第${yao.position}爻${yao.sixRelative}${yao.najiaDizhi}${yao.wuxing}`,
      `六神${yao.sixGod}`,
      roles.length ? roles.join('、') : '',
      activity,
      yao.seasonState ? `月令${yao.seasonState}` : '',
      monthRelations.join('、'),
      dayRelations.join('、'),
      yao.isVoid ? '本爻空亡' : '',
      yao.shiErGong ? `十二宫${yao.shiErGong}` : '',
      changedYao
        ? `化${changedYao.sixRelative}${changedYao.branch}${changedYao.wuxing}${changedYao.direction ? `、${changedYao.direction}` : ''}${changedYao.relation ? `、${changedYao.relation}` : ''}${changedYao.isVoid ? '、变爻空亡' : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('；');
    return {
      key: `本卦:第${yao.position}爻`,
      position: yao.position,
      rawValue: yao.rawValue,
      yaoType: yao.yaoType,
      changeType: yao.changeType,
      sixGod: yao.sixGod,
      sixRelative: yao.sixRelative,
      najia: { branch: yao.najiaDizhi, wuxing: yao.wuxing },
      roles,
      activity,
      monthState: {
        branch: monthBranch,
        seasonState: yao.seasonState,
        relations: monthRelations,
      },
      dayState: { branch: dayBranch, relations: dayRelations },
      traditionalRelations: {
        twelveStage: yao.shiErGong,
        sanxingType: yao.isSanxing ? yao.sanxingType : undefined,
        liuhePartner: yao.isLiuhe ? yao.liuhePartner : undefined,
        isLiuhai: Boolean(yao.isLiuhai),
        isRuMu: Boolean(yao.isRuMu),
      },
      isVoid: yao.isVoid,
      support: reference.support,
      constraints: reference.constraints,
      ...(changedYao ? { changedYao } : {}),
      promptText,
      sources: [
        '京房八宫纳甲与六亲排布',
        '日干起六神与八宫安世应',
        '起卦月建、日辰、旬空与动变计算',
      ],
      limitation: LINE_FACT_LIMITATION,
    };
  });
}

function buildHiddenSpiritFacts(data: LiuyaoData): LiuyaoHiddenSpiritFact[] {
  return (data.hiddenSpirits ?? []).map((spirit) => {
    const reference = buildHiddenReference(spirit);
    return {
      key: `伏神:第${spirit.position}爻:${spirit.sixRelative}`,
      position: spirit.position,
      sixRelative: spirit.sixRelative,
      najia: { branch: spirit.najiaDizhi, wuxing: spirit.wuxing },
      isVoid: spirit.isVoid,
      coveringLine: spirit.underYao,
      support: reference.support,
      constraints: reference.constraints,
      promptText: `第${spirit.position}爻伏神${spirit.sixRelative}${spirit.najiaDizhi}${spirit.wuxing}，飞神${spirit.underYao.sixRelative}${spirit.underYao.najiaDizhi}${spirit.underYao.wuxing}覆盖${spirit.isVoid ? '，伏神空亡' : ''}`,
      sources: ['本宫首卦六亲全集与当前本卦六亲差集', '当前爻位飞伏配对与旬空计算'],
      limitation: HIDDEN_SPIRIT_FACT_LIMITATION,
    };
  });
}

function findGeneratingElement(target: string) {
  return ELEMENTS.find((element) => isSheng(element, target)) ?? '';
}

function findControllingElement(target: string) {
  return ELEMENTS.find((element) => isKe(element, target)) ?? '';
}

function candidateSpecs(data: LiuyaoData, options: LiuyaoEvidenceOptions) {
  const topic = options.topic ?? 'general';
  const world = data.yaosDetail.find((item) => item.isWorld);
  const response = data.yaosDetail.find((item) => item.isResponse);
  if (options.usefulGodRelative) {
    return [
      {
        label: '指定用神',
        relative: options.usefulGodRelative,
        reason: '由调用方根据实际问题明确指定，盘面只负责检索与验证。',
      },
    ];
  }
  if (topic === 'shiye') {
    return [
      { label: '事业用神', relative: '官鬼', reason: '事业工作以官鬼为主要事项候选。' },
      { label: '文书辅证', relative: '父母', reason: '父母爻辅助观察单位、合同、文书与消息。' },
    ];
  }
  if (topic === 'caifu') {
    return [
      { label: '财运用神', relative: '妻财', reason: '财运交易以妻财为主要事项候选。' },
      { label: '财源辅证', relative: '子孙', reason: '子孙生财，可作为财源与经营能力辅证。' },
    ];
  }
  if (topic === 'guaishen') {
    return [
      {
        label: '怪异事项候选',
        relative: '官鬼',
        reason: '仅按传统取官鬼为候选，不能据此证明超自然原因。',
      },
      ...(world
        ? [
            {
              label: '求测者主轴',
              position: world.position,
              reason: '仍须先检查世爻状态与现实因素。',
            },
          ]
        : []),
    ];
  }
  if (topic === 'ganqing') {
    return [
      ...(world
        ? [
            {
              label: '关系我方',
              position: world.position,
              reason: '感情关系先以世爻代表求测者一方。',
            },
          ]
        : []),
      ...(response
        ? [
            {
              label: '关系对方',
              position: response.position,
              reason: '应爻代表对方或关系外部条件。',
            },
          ]
        : []),
    ];
  }
  return [
    ...(world
      ? [
          {
            label: '通用主轴',
            position: world.position,
            reason: '问题未明确取用时，先以世爻作为求测者主轴。',
          },
        ]
      : []),
    ...(response
      ? [{ label: '应爻辅轴', position: response.position, reason: '应爻用于观察对方或外部条件。' }]
      : []),
    ...data.yaosDetail
      .filter((item) => item.isChanging)
      .slice(0, 2)
      .map((item) => ({
        label: `动爻触发第${item.position}爻`,
        position: item.position,
        reason: '动爻只作为事件变化触发候选，仍须回扣世应与实际问题。',
      })),
  ];
}

export function analyzeLiuyaoEvidence(
  data: LiuyaoData,
  options: LiuyaoEvidenceOptions = {},
): LiuyaoEvidenceAnalysis {
  if (!data?.yaosDetail?.length) throw new Error('六爻证据分析缺少完整爻位资料。');
  const topic = options.topic ?? 'general';
  const monthBranch = branchOf(data.ganzhi.month);
  const dayBranch = branchOf(data.ganzhi.day);
  const references = allReferences(data, monthBranch, dayBranch);
  const lineFacts = buildLineFacts(data, monthBranch, dayBranch);
  const hiddenSpiritFacts = buildHiddenSpiritFacts(data);
  const candidates = candidateSpecs(data, options).map((spec): LiuyaoUsefulGodCandidate => {
    const matched = references.filter((reference) =>
      spec.position
        ? reference.position === spec.position && reference.source === '本卦'
        : reference.sixRelative === spec.relative,
    );
    return {
      ...spec,
      references: matched,
      support: Array.from(new Set(matched.flatMap((item) => item.support))),
      constraints: matched.length
        ? Array.from(new Set(matched.flatMap((item) => item.constraints)))
        : [`${spec.relative ?? '指定爻位'}未在本卦或伏神中找到，不能硬取为主证`],
    };
  });
  const selectedCandidate = candidates[0]?.references.length ? candidates[0] : null;
  const usefulElement = selectedCandidate?.references[0]?.wuxing ?? '';
  const sourceElement = usefulElement ? findGeneratingElement(usefulElement) : '';
  const tabooElement = usefulElement ? findControllingElement(usefulElement) : '';
  const enemyElement = tabooElement ? findGeneratingElement(tabooElement) : '';
  const chainSpecs: Array<[LiuyaoGodRole, string, string]> = usefulElement
    ? [
        ['用神', usefulElement, '当前首个可见或伏藏候选的五行'],
        ['原神', sourceElement, `${sourceElement}生${usefulElement}`],
        ['忌神', tabooElement, `${tabooElement}克${usefulElement}`],
        ['仇神', enemyElement, `${enemyElement}生${tabooElement}并克${sourceElement}`],
      ]
    : [];
  const godChain = chainSpecs.map(([role, wuxing, relation]) => ({
    role,
    wuxing,
    relation,
    references: references.filter((item) => item.wuxing === wuxing),
  }));
  const traditionalSymbols = Array.from(new Set(references.map((item) => item.sixRelative))).map(
    (relative): LiuyaoTraditionalSymbolFact => {
      const originalText = TRADITIONAL_RELATIVE_IMAGES[relative] ?? '传统类象未单列';
      return {
        relative,
        positions: references
          .filter((item) => item.sixRelative === relative)
          .map((item) => item.position),
        originalText,
        promptText: `${originalText}；须先结合问题主题、求测者身份、世应、动变、月日旺衰与空破墓判断`,
        source: '传统六亲类象表与当前六亲排布',
        limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果',
      };
    },
  );
  const generationFact = buildGenerationFact(data);
  const generationMethod = data.generation?.method;
  const methodLabel = generationFact.methodLabel;
  const generationFacts = [
    `起卦方式：${methodLabel}`,
    ...generationFact.coinThrows.map(
      (item, index) =>
        `第${index + 1}爻计算样本：${item.coins.join('+')}=${item.total}（${item.total === 6 ? '老阴' : item.total === 7 ? '少阳' : item.total === 8 ? '少阴' : '老阳'}）`,
    ),
    generationMethod === 'manual' ? `手工爻值：${data.yaoArray.join('、')}` : '',
  ].filter(Boolean);
  const trace = data.meta?.random;
  const expectsRandomTrace = generationMethod === 'coins' || generationMethod === 'time';
  const randomFact = buildRandomTraceFact({
    key: `random:liuyao:${generationMethod ?? 'unknown'}`,
    applicable: expectsRandomTrace,
    trace,
    processLabel: `${methodLabel}的六爻生成过程`,
    sources: ['六爻起卦方式记录', '逐次随机投币样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const timingConditions = [
    ...data.yaosDetail
      .filter((item) => item.isChanging)
      .map(
        (item) =>
          `第${item.position}爻${item.sixRelative}${item.najiaDizhi}发动${item.changedYao ? `化${item.changedYao.liuqin}${item.changedYao.dizhi}` : ''}`,
      ),
    ...(data.voidBranches?.length
      ? [`空亡${data.voidBranches.join('、')}须待出空、冲实或透出再验`]
      : []),
    ...(data.hiddenSpirits?.length ? ['伏神须待透出、飞神受冲或得月日生扶再验'] : []),
  ];
  const counterEvidence = Array.from(
    new Set(candidates.flatMap((candidate) => candidate.constraints)),
  );
  const items: PromptEvidenceItem[] = candidates.map((candidate, index) => ({
    level: candidate.references.length ? (index === 0 ? '主证' : '辅证') : '限制',
    title: candidate.label,
    detail: candidate.references.length
      ? `${candidate.reason}；盘面${candidate.references.map(formatYao).join('、')}；支持${candidate.support.join('、') || '未见额外增强'}；限制${candidate.constraints.join('、') || '未见明显空破墓退'}`
      : `${candidate.reason}；${candidate.constraints.join('、')}`,
    source: '六爻世应、六亲、月日、动变、空伏逐项核验',
    tags: [candidate.relative ?? '爻位候选'],
  }));
  items.push(
    {
      level: '主证',
      title: '六爻逐爻计算事实',
      detail: `${lineFacts.map((item) => item.promptText).join('；')}；统一边界：${LINE_FACT_LIMITATION}`,
      source: '京房八宫纳甲、安世应、月日旺衰、旬空与动变规则逐爻计算',
      tags: ['逐爻事实', '纳甲', '世应', '月日', '动变'],
    },
    ...(hiddenSpiritFacts.length
      ? [
          {
            level: '辅证' as const,
            title: '伏神与飞神配对事实',
            detail: `${hiddenSpiritFacts.map((item) => item.promptText).join('；')}；统一边界：${HIDDEN_SPIRIT_FACT_LIMITATION}`,
            source: '本宫首卦六亲全集、当前六亲差集与飞伏配对',
            tags: ['伏神', '飞神', '伏藏条件'],
          },
        ]
      : []),
    {
      level: '辅证',
      title: '六亲传统类象映射（非事实结论）',
      detail: traditionalSymbols
        .map(
          (item) =>
            `${item.relative}见于第${item.positions.join('、')}爻：${item.promptText}；边界：${item.limitation}`,
        )
        .join('；'),
      source: '传统六亲类象表与当前六亲排布逐项映射',
      tags: ['六亲类象', '条件化表达', '非事实结论'],
    },
    {
      level: generationFact.status === '可核验' ? '辅证' : '反证',
      title: generationFact.status === '可核验' ? `起卦来源：${methodLabel}` : '起卦来源缺失',
      detail: `${generationFact.promptText}；边界：${generationFact.limitation}`,
      source: generationFact.sources.join('、'),
      tags: ['起卦来源', generationFact.method, generationFact.status],
    },
    ...(expectsRandomTrace
      ? [
          {
            level: randomFact.status === '可重放' ? ('辅证' as const) : ('反证' as const),
            title: randomFact.status === '可重放' ? '六爻随机重放记录' : '随机轨迹缺失',
            detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
            source: randomFact.sources.join('、'),
            tags: ['随机轨迹', randomFact.status, '不代表预测有效性'],
          },
        ]
      : []),
    {
      level: '限制',
      title: '六爻取用与作用链解释边界',
      detail:
        '主题默认用神只是候选；实际问题语义、求测者身份与所问对象可能改变取用。不得按候选数量或支持项数量生成吉凶总分，也不得仅凭官鬼、白虎、螣蛇等单项证明疾病、灾祸或超自然原因。模拟三钱和随机重放只记录生成过程，不等同于现实投掷或预测有效性。',
      source: '计算事实与解释结论分离原则',
    },
  );
  const evidence: PromptEvidenceBundle = { title: '六爻用神作用链结构化证据', items };
  const promptText = [
    '【六爻用神作用链结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    godChain.length
      ? `作用链：${godChain.map((item) => `${item.role}${item.wuxing}（${item.relation}；${item.references.map(formatYao).join('、') || '盘中未见'}）`).join('；')}`
      : '作用链：当前没有可用候选，不能强定原神、忌神与仇神。',
    timingConditions.length
      ? `触发条件：${timingConditions.join('；')}`
      : '触发条件：静卦先看世应用神与月日，不补造绝对日期。',
  ].join('\n');
  return {
    topic,
    monthBranch,
    dayBranch,
    candidates,
    selectedCandidate,
    godChain,
    traditionalSymbols,
    lineFacts,
    hiddenSpiritFacts,
    generationFact,
    generationFacts,
    randomFact,
    randomFacts,
    timingConditions,
    counterEvidence,
    evidence,
    promptText,
    methodology: [
      '先由明确指定或问题主题提出用神候选，再在本卦与伏神中检索，不把候选当成已证实结论。',
      '逐爻保留世应、发动、暗动、月令、月日同支合冲、空破墓、回头生克和进退神证据。',
      '原神取生用神者，忌神取克用神者，仇神取生忌神并克原神者。',
      '六亲类象保留传统原始范围，提示词只把它作为随问题变化的候选，不把单一持世六亲写成现实事件。',
      '只输出支持、反证、限制和触发条件，不生成吉凶总分或成功率。',
    ],
  };
}
