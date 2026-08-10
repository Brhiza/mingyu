import type {
  LiuyaoChangeRelation,
  LiuyaoData,
  LiuyaoHiddenSpirit,
  LiuyaoYaoDetail,
} from '../types/divination';
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
  key: string;
  factKey: string;
  source: '本卦' | '伏神';
  status: '已匹配';
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
    relations: LiuyaoChangeRelation[];
    direction: LiuyaoYaoDetail['changeDirection'];
  };
}

export interface LiuyaoUsefulGodCandidate {
  key: string;
  status: '已匹配' | '未匹配';
  sourceStatus: '用户指定' | '主题默认' | '盘面补齐';
  label: string;
  relative?: string;
  position?: number;
  reason: string;
  references: LiuyaoYaoReference[];
  referenceKeys: string[];
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '用神候选只记录由明确指定、问题主题或世应动爻提出的取用范围及其盘面匹配；候选不等于已证明现实事项，也不得按候选顺序、数量或匹配数量换算吉凶分与成功率';
}

export interface LiuyaoGodChainItem {
  key: string;
  role: LiuyaoGodRole;
  status: '盘中有对应' | '盘中未见';
  wuxing: string;
  relation: string;
  references: LiuyaoYaoReference[];
  referenceKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '原神、忌神与仇神只按已选候选五行的生克链定义，并记录盘中是否有对应爻；盘中有无对应不直接证明现实助力、阻碍、吉凶或结果';
}

export interface LiuyaoTraditionalSymbolFact {
  key: string;
  status: '已映射';
  relative: string;
  positions: number[];
  originalText: string;
  promptText: string;
  source: '传统六亲类象表与当前六亲排布';
  sources: string[];
  limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果';
}

export interface LiuyaoLineFact {
  key: string;
  status: '已计算';
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
    relations: LiuyaoChangeRelation[];
    direction: LiuyaoYaoDetail['changeDirection'];
  };
  promptText: string;
  sources: string[];
  limitation: '逐爻字段是纳甲、世应、月日旺衰与动变规则的计算事实，只限定六爻取证条件，不单独证明现实吉凶、事件、身份、疾病、官非、关系或财务结果';
}

export interface LiuyaoHiddenSpiritFact {
  key: string;
  status: '已计算';
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

export interface LiuyaoLineCoverageFact {
  key: 'liuyao:line-coverage';
  status: '完整' | '缺少爻位' | '爻位异常';
  expectedPositions: number[];
  actualPositions: number[];
  missingPositions: number[];
  duplicatePositions: number[];
  invalidPositions: number[];
  lineFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '六爻覆盖状态只说明当前结果能否完整核验初爻至上爻；缺少、重复或越界爻位时不得反推纳甲、六亲、六神、世应、空破墓或动变内容';
}

export interface LiuyaoHiddenSpiritCoverageFact {
  key: 'liuyao:hidden-spirit-coverage';
  status: '有伏神' | '无伏神' | '字段缺失';
  hiddenSpiritFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '伏神覆盖状态只说明当前结果是否明确保存伏神数组以及是否检出伏神；字段缺失时不得把无记录解释为无伏神，也不得反推伏神位置与六亲';
}

export interface LiuyaoUsefulGodSelectionFact {
  key: 'liuyao:useful-god-selection';
  status: '已选定候选' | '缺少可用候选';
  topic: LiuyaoEvidenceTopic;
  requestedRelative: string | null;
  selectedCandidateKey: string | null;
  candidateKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '用神选择状态只说明当前候选是否在本卦或伏神中找到匹配；缺少匹配时不得硬取用神，已有匹配也仍须结合具体问题语义、求测者身份与现实资料复核';
}

export interface LiuyaoCounterEvidenceFact {
  key: string;
  ownerCandidateKey: string;
  candidateLabel: string;
  status: '已触发';
  detail: string;
  referenceKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示候选用神命中空亡、月破、日破、休囚死、入墓、回头克冲、化空、化退或未匹配等限制；不得把单项反证直接写成现实失败、灾祸或必然结果';
}

export interface LiuyaoCounterSummaryFact {
  key: 'liuyao:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前候选核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率';
}

export interface LiuyaoTimingFact {
  key: string;
  type: '动爻触发' | '空亡填实' | '伏神透出' | '反吟伏吟节奏' | '静卦边界' | '期限边界';
  sourceStatus: '由盘面生成' | '统一边界';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '六爻应期事实只提供动爻、出空冲实、伏神透出与静卦复核等触发条件；未给期限时不得把爻位、支序或卦数换算唯一日期，也不证明事件必然发生';
}

export interface LiuyaoHexagramStructureFact {
  key: string;
  kind: '整卦六合六冲' | '反吟伏吟' | '特殊卦象' | '日辰三合' | '月建三合';
  status: '已计算';
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '整卦六合六冲、反吟伏吟、特殊卦象与日月三合只描述已计算的卦内结构；不得直接写成现实和合、冲散、反复、成功、失败或固定应期';
}

export interface LiuyaoTimingSummaryFact {
  key: 'liuyao:timing-summary';
  status: '已提供触发条件' | '仅有边界';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前盘面保存了哪些触发与边界条件；不得按条件数量、爻位或地支序换算固定天数、绝对日期或事件概率';
}

export interface LiuyaoCalculationStep {
  key: string;
  stage:
    | '起卦来源核验'
    | '六爻逐爻计算'
    | '伏神资料核验'
    | '用神候选筛选'
    | '原忌仇神作用链'
    | '反证与应期核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明起卦来源、逐爻、伏神、用神候选、五行作用链、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}

export interface LiuyaoSummaryFact {
  key: 'liuyao:evidence-summary';
  status: '证据链完整' | '部分资料缺失' | '缺少可用候选';
  factKeys: string[];
  lineFactCount: number;
  hiddenSpiritFactCount: number;
  candidateCount: number;
  matchedCandidateCount: number;
  godChainFactCount: number;
  structureFactCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '六爻证据汇总只统计起卦、逐爻、伏神、候选、五行作用链、卦内结构、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、超自然判断或唯一日期';
}

export interface LiuyaoLimitationFact {
  key: string;
  type:
    | '起卦与随机来源边界'
    | '逐爻与伏神资料边界'
    | '用神候选与五行链边界'
    | '卦内结构与传统类象边界'
    | '反证与应期边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束六爻起卦、逐爻、伏神、用神、传统类象与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病灾祸、超自然原因、事件概率或固定应期的证据';
}

export interface LiuyaoEvidenceAnalysis {
  key: 'liuyao:evidence';
  status: '已计算';
  topic: LiuyaoEvidenceTopic;
  monthBranch: string;
  dayBranch: string;
  candidates: LiuyaoUsefulGodCandidate[];
  selectedCandidate: LiuyaoUsefulGodCandidate | null;
  godChain: LiuyaoGodChainItem[];
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  structureFacts: LiuyaoHexagramStructureFact[];
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  generationFact: LiuyaoGenerationFact;
  generationFacts: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  timingFacts: LiuyaoTimingFact[];
  timingSummaryFact: LiuyaoTimingSummaryFact;
  timingConditions: string[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  counterSummaryFact: LiuyaoCounterSummaryFact;
  counterEvidence: string[];
  calculationSteps: LiuyaoCalculationStep[];
  calculationChain: string[];
  summaryFact: LiuyaoSummaryFact;
  limitations: string[];
  limitationFacts: LiuyaoLimitationFact[];
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
const CANDIDATE_FACT_LIMITATION =
  '用神候选只记录由明确指定、问题主题或世应动爻提出的取用范围及其盘面匹配；候选不等于已证明现实事项，也不得按候选顺序、数量或匹配数量换算吉凶分与成功率' as const;
const GOD_CHAIN_FACT_LIMITATION =
  '原神、忌神与仇神只按已选候选五行的生克链定义，并记录盘中是否有对应爻；盘中有无对应不直接证明现实助力、阻碍、吉凶或结果' as const;
const LINE_COVERAGE_FACT_LIMITATION =
  '六爻覆盖状态只说明当前结果能否完整核验初爻至上爻；缺少、重复或越界爻位时不得反推纳甲、六亲、六神、世应、空破墓或动变内容' as const;
const HIDDEN_SPIRIT_COVERAGE_FACT_LIMITATION =
  '伏神覆盖状态只说明当前结果是否明确保存伏神数组以及是否检出伏神；字段缺失时不得把无记录解释为无伏神，也不得反推伏神位置与六亲' as const;
const SELECTION_FACT_LIMITATION =
  '用神选择状态只说明当前候选是否在本卦或伏神中找到匹配；缺少匹配时不得硬取用神，已有匹配也仍须结合具体问题语义、求测者身份与现实资料复核' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示候选用神命中空亡、月破、日破、休囚死、入墓、回头克冲、化空、化退或未匹配等限制；不得把单项反证直接写成现实失败、灾祸或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前候选核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率' as const;
const TIMING_FACT_LIMITATION =
  '六爻应期事实只提供动爻、出空冲实、伏神透出与静卦复核等触发条件；未给期限时不得把爻位、支序或卦数换算唯一日期，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前盘面保存了哪些触发与边界条件；不得按条件数量、爻位或地支序换算固定天数、绝对日期或事件概率' as const;
const HEXAGRAM_STRUCTURE_FACT_LIMITATION =
  '整卦六合六冲、反吟伏吟、特殊卦象与日月三合只描述已计算的卦内结构；不得直接写成现实和合、冲散、反复、成功、失败或固定应期' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明起卦来源、逐爻、伏神、用神候选、五行作用链、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '六爻证据汇总只统计起卦、逐爻、伏神、候选、五行作用链、卦内结构、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、超自然判断或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束六爻起卦、逐爻、伏神、用神、传统类象与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病灾祸、超自然原因、事件概率或固定应期的证据' as const;

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

function getChangeRelations(yao: LiuyaoYaoDetail): LiuyaoChangeRelation[] {
  const relations = yao.changeRelations?.length
    ? yao.changeRelations
    : yao.changeRelation
      ? [yao.changeRelation]
      : [];
  return [...new Set(relations)];
}

function formatYao(reference: LiuyaoYaoReference) {
  const changed = reference.changedYao
    ? `→${reference.changedYao.sixRelative}${reference.changedYao.branch}${reference.changedYao.wuxing}${reference.changedYao.relations.length ? `（${reference.changedYao.relations.join('、')}）` : reference.changedYao.isVoid ? '（变爻空亡）' : ''}${reference.changedYao.direction ? `（${reference.changedYao.direction}）` : ''}`
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
  const changeRelations = getChangeRelations(yao);
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
    changeRelations.includes('回头生') ? '回头生' : '',
    yao.changeDirection === '化进神' ? '化进神' : '',
  ].filter(Boolean);
  const constraints = [
    yao.isVoid ? '本爻空亡' : '',
    yao.isMonthBreak ? '月破' : '',
    yao.isDayBreak ? '日破' : '',
    yao.seasonState === '休' || yao.seasonState === '囚' || yao.seasonState === '死'
      ? `月令${yao.seasonState}`
      : '',
    yao.isRiMu ? '入日墓' : '',
    changeRelations.includes('回头克') ? '回头克' : '',
    changeRelations.includes('回头冲') ? '回头冲' : '',
    changeRelations.includes('化空') || yao.changedYao?.isVoid ? '变爻空亡' : '',
    yao.changeDirection === '化退神' ? '化退神' : '',
  ].filter(Boolean);
  return {
    key: `liuyao:reference:line:${yao.position}`,
    factKey: `本卦:第${yao.position}爻`,
    source: '本卦',
    status: '已匹配',
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
            relations: changeRelations,
            direction: yao.changeDirection,
          },
        }
      : {}),
  };
}

function buildHiddenReference(spirit: LiuyaoHiddenSpirit): LiuyaoYaoReference {
  return {
    key: `liuyao:reference:hidden:${spirit.position}:${spirit.sixRelative}`,
    factKey: `伏神:第${spirit.position}爻:${spirit.sixRelative}`,
    source: '伏神',
    status: '已匹配',
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
      isLiuhai(yao.najiaDizhi, monthBranch) ? '与月建相害' : '',
      isSanxing(yao.najiaDizhi, monthBranch) ? '与月建成刑' : '',
    ].filter(Boolean);
    const dayRelations = [
      yao.najiaDizhi === dayBranch ? '值日辰' : '',
      isLiuhe(yao.najiaDizhi, dayBranch) ? '合日辰' : '',
      yao.isHiddenMove
        ? '日冲暗动'
        : yao.isDayBreak
          ? '日冲成破'
          : yao.isChanging && yao.isDayClash
            ? '日辰冲动'
            : '',
      yao.isRiMu ? '入日墓' : '',
      isLiuhai(yao.najiaDizhi, dayBranch) ? '与日辰相害' : '',
      isSanxing(yao.najiaDizhi, dayBranch) ? '与日辰成刑' : '',
    ].filter(Boolean);
    const activity: LiuyaoLineFact['activity'] = yao.isChanging
      ? '明动'
      : yao.isHiddenMove
        ? '暗动'
        : '静爻';
    const changeRelations = getChangeRelations(yao);
    const changedYao = yao.changedYao
      ? {
          sixRelative: yao.changedYao.liuqin,
          branch: yao.changedYao.dizhi,
          wuxing: yao.changedYao.wuxing,
          isVoid: yao.changedYao.isVoid,
          relation: yao.changeRelation,
          relations: changeRelations,
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
        ? `化${changedYao.sixRelative}${changedYao.branch}${changedYao.wuxing}${changedYao.direction ? `、${changedYao.direction}` : ''}${changedYao.relations.length ? `、${changedYao.relations.join('、')}` : changedYao.isVoid ? '、变爻空亡' : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('；');
    return {
      key: `本卦:第${yao.position}爻`,
      status: '已计算',
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
      status: '已计算',
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

function buildLineCoverageFact(lineFacts: LiuyaoLineFact[]): LiuyaoLineCoverageFact {
  const expectedPositions = [1, 2, 3, 4, 5, 6];
  const rawPositions = lineFacts.map((item) => item.position);
  const actualPositions = [...new Set(rawPositions)].sort((left, right) => left - right);
  const missingPositions = expectedPositions.filter(
    (position) => !actualPositions.includes(position),
  );
  const duplicatePositions = actualPositions.filter(
    (position) => rawPositions.filter((item) => item === position).length > 1,
  );
  const invalidPositions = actualPositions.filter(
    (position) => !Number.isInteger(position) || position < 1 || position > 6,
  );
  const status: LiuyaoLineCoverageFact['status'] =
    duplicatePositions.length || invalidPositions.length
      ? '爻位异常'
      : missingPositions.length
        ? '缺少爻位'
        : '完整';
  return {
    key: 'liuyao:line-coverage',
    status,
    expectedPositions,
    actualPositions,
    missingPositions,
    duplicatePositions,
    invalidPositions,
    lineFactKeys: lineFacts.map((item) => item.key),
    promptText:
      status === '完整'
        ? '六爻资料完整覆盖初爻至上爻，可逐爻核验'
        : status === '缺少爻位'
          ? `六爻资料缺少第${missingPositions.join('、')}爻，不得补造缺失爻内容`
          : `六爻位置异常：重复${duplicatePositions.join('、') || '无'}；越界${invalidPositions.join('、') || '无'}`,
    sources: ['当前逐爻详情的位置、数量与唯一性核验'],
    limitation: LINE_COVERAGE_FACT_LIMITATION,
  };
}

function buildHiddenSpiritCoverageFact(
  data: LiuyaoData,
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[],
): LiuyaoHiddenSpiritCoverageFact {
  const status: LiuyaoHiddenSpiritCoverageFact['status'] = Array.isArray(data.hiddenSpirits)
    ? hiddenSpiritFacts.length
      ? '有伏神'
      : '无伏神'
    : '字段缺失';
  return {
    key: 'liuyao:hidden-spirit-coverage',
    status,
    hiddenSpiritFactKeys: hiddenSpiritFacts.map((item) => item.key),
    promptText:
      status === '有伏神'
        ? `当前记录${hiddenSpiritFacts.length}条伏神与飞神配对事实`
        : status === '无伏神'
          ? '当前结果明确记录伏神数组为空，不补造伏神'
          : '旧结果未提供伏神字段，不能据此断定无伏神，也不得反推伏神位置',
    sources: ['当前伏神字段存在性与伏神事实数量核验'],
    limitation: HIDDEN_SPIRIT_COVERAGE_FACT_LIMITATION,
  };
}

function buildHexagramStructureFacts(data: LiuyaoData): LiuyaoHexagramStructureFact[] {
  const facts: LiuyaoHexagramStructureFact[] = [];
  const add = (
    key: string,
    kind: LiuyaoHexagramStructureFact['kind'],
    originalText: string,
    sources: string[],
  ) => {
    if (!originalText.trim()) return;
    facts.push({
      key,
      kind,
      status: '已计算',
      originalText,
      promptText: conditionLiuyaoTraditionalText(originalText),
      sources,
      limitation: HEXAGRAM_STRUCTURE_FACT_LIMITATION,
    });
  };
  if (data.hexagramRelations) {
    add(
      'liuyao:structure:hexagram-relation',
      '整卦六合六冲',
      [
        data.hexagramRelations.original ? `主卦${data.hexagramRelations.original}` : '',
        data.hexagramRelations.changed ? `变卦${data.hexagramRelations.changed}` : '',
        data.hexagramRelations.transition ?? '',
      ]
        .filter(Boolean)
        .join('；'),
      ['主卦与变卦六支六合、六冲完整性核验'],
    );
  }
  [...(data.fanfuRelations?.fanyin ?? []), ...(data.fanfuRelations?.fuyin ?? [])].forEach(
    (item, index) =>
      add(
        `liuyao:structure:fanfu:${index + 1}:${item.kind}:${item.scope}`,
        '反吟伏吟',
        `${item.label}：${item.description}`,
        ['主卦与变卦内外卦纳甲地支反吟伏吟核验'],
      ),
  );
  if (data.specialPattern) {
    add(
      `liuyao:structure:special:${data.specialPattern}`,
      '特殊卦象',
      `${data.specialPattern}${data.specialAdvice ? `：${data.specialAdvice}` : ''}`,
      ['六爻动静数量、乾坤用爻与特殊卦象核验'],
    );
  }
  if (data.isChaotic || data.chaoticReason) {
    add('liuyao:structure:chaotic', '特殊卦象', data.chaoticReason || '当前卦象标记为乱动结构', [
      '动爻数量与乱动条件核验',
    ]);
  }
  if (data.sanheWithDay) {
    add('liuyao:structure:sanhe-day', '日辰三合', data.sanheWithDay.description, [
      '当前动爻、变爻与日支三合成员完整性核验',
    ]);
  }
  if (data.sanheWithMonth) {
    add('liuyao:structure:sanhe-month', '月建三合', data.sanheWithMonth.description, [
      '当前动爻、变爻与月支三合成员完整性核验',
    ]);
  }
  return facts;
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
        reason: '按明确指定的六亲取用，并以盘面检索结果裁定。',
      },
    ];
  }
  if (topic === 'shiye') {
    return [
      { label: '事业用神', relative: '官鬼', reason: '事业工作以官鬼为用神。' },
      { label: '文书辅证', relative: '父母', reason: '父母爻作为文书、单位与消息辅证。' },
    ];
  }
  if (topic === 'caifu') {
    return [
      { label: '财运用神', relative: '妻财', reason: '财运交易以妻财为用神。' },
      { label: '财源辅证', relative: '子孙', reason: '子孙爻作为财源与经营能力辅证。' },
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
              reason: '感情关系以世爻为我方。',
            },
          ]
        : []),
      ...(response
        ? [
            {
              label: '关系对方',
              position: response.position,
              reason: '感情关系以应爻为对方。',
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
            reason: '未另指定用神时，以世爻为求测者主轴。',
          },
        ]
      : []),
    ...(response
      ? [{ label: '应爻辅轴', position: response.position, reason: '应爻用于观察对方与外部条件。' }]
      : []),
    ...data.yaosDetail
      .filter((item) => item.isChanging)
      .slice(0, 2)
      .map((item) => ({
        label: `动爻触发第${item.position}爻`,
        position: item.position,
        reason: '动爻作为事件变化触发点，并回扣世应主线。',
      })),
  ];
}

function buildSummaryFact(params: {
  generationFact: LiuyaoGenerationFact;
  randomFact: RandomTraceFact;
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  candidates: LiuyaoUsefulGodCandidate[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  structureFacts: LiuyaoHexagramStructureFact[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  counterSummaryFact: LiuyaoCounterSummaryFact;
  timingFacts: LiuyaoTimingFact[];
  timingSummaryFact: LiuyaoTimingSummaryFact;
}): LiuyaoSummaryFact {
  const factKeys = Array.from(
    new Set([
      params.generationFact.key,
      params.randomFact.key,
      params.lineCoverageFact.key,
      ...params.lineFacts.map((item) => item.key),
      params.hiddenSpiritCoverageFact.key,
      ...params.hiddenSpiritFacts.map((item) => item.key),
      params.selectionFact.key,
      ...params.candidates.flatMap((item) => [item.key, ...item.referenceKeys]),
      ...params.godChain.flatMap((item) => [item.key, ...item.referenceKeys]),
      ...params.traditionalSymbols.map((item) => item.key),
      ...params.structureFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingFacts.map((item) => item.key),
    ]),
  );
  const status =
    params.generationFact.status === '来源链缺失' ||
    params.lineCoverageFact.status !== '完整' ||
    params.hiddenSpiritCoverageFact.status === '字段缺失'
      ? '部分资料缺失'
      : params.selectionFact.status === '缺少可用候选'
        ? '缺少可用候选'
        : '证据链完整';
  const matchedCandidateCount = params.candidates.filter((item) => item.status === '已匹配').length;
  return {
    key: 'liuyao:evidence-summary',
    status,
    factKeys,
    lineFactCount: params.lineFacts.length,
    hiddenSpiritFactCount: params.hiddenSpiritFacts.length,
    candidateCount: params.candidates.length,
    matchedCandidateCount,
    godChainFactCount: params.godChain.length,
    structureFactCount: params.structureFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    promptText: `证据状态${status}：逐爻${params.lineFacts.length}项、伏神${params.hiddenSpiritFacts.length}项、用神候选${params.candidates.length}项（匹配${matchedCandidateCount}项）、五行作用链${params.godChain.length}项、卦内结构${params.structureFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项`,
    sources: ['全部起卦、逐爻、伏神、候选、五行作用链、卦内结构、反证与应期事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  generationFact: LiuyaoGenerationFact;
  randomFact: RandomTraceFact;
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  candidates: LiuyaoUsefulGodCandidate[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  timingFacts: LiuyaoTimingFact[];
  summaryFact: LiuyaoSummaryFact;
}): LiuyaoCalculationStep[] {
  return [
    {
      key: 'liuyao:calculation:generation',
      stage: '起卦来源核验',
      status: params.generationFact.status === '可核验' ? '已计算' : '资料不足',
      inputs: {
        method: params.generationFact.method,
        expectedLineCount: params.generationFact.expectedLineCount,
      },
      result: {
        generationStatus: params.generationFact.status,
        recordedLineCount: params.generationFact.recordedLineCount,
        randomTraceStatus: params.randomFact.status,
        randomSampleCount: params.randomFact.sampleCount,
      },
      dependsOnStepKeys: [],
      promptText: `${params.generationFact.promptText}；随机轨迹${params.randomFact.status === '不适用' ? '不适用' : params.randomFact.status}`,
      sources: Array.from(
        new Set([...params.generationFact.sources, ...params.randomFact.sources]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:lines',
      stage: '六爻逐爻计算',
      status: params.lineCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        expectedPositions: params.lineCoverageFact.expectedPositions.map(String),
        recordedLineCount: params.lineFacts.length,
      },
      result: {
        coverageStatus: params.lineCoverageFact.status,
        actualPositions: params.lineCoverageFact.actualPositions.map(String),
        missingPositions: params.lineCoverageFact.missingPositions.map(String),
      },
      dependsOnStepKeys: ['liuyao:calculation:generation'],
      promptText: `${params.lineCoverageFact.promptText}；已形成${params.lineFacts.length}项逐爻纳甲、世应、月日与动变事实`,
      sources: ['起卦六个爻值', ...params.lineCoverageFact.sources, '逐爻纳甲与动变计算'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:hidden-spirits',
      stage: '伏神资料核验',
      status: params.hiddenSpiritCoverageFact.status === '字段缺失' ? '资料不足' : '已计算',
      inputs: { lineFactCount: params.lineFacts.length },
      result: {
        coverageStatus: params.hiddenSpiritCoverageFact.status,
        hiddenSpiritFactCount: params.hiddenSpiritFacts.length,
      },
      dependsOnStepKeys: ['liuyao:calculation:lines'],
      promptText: params.hiddenSpiritCoverageFact.promptText,
      sources: params.hiddenSpiritCoverageFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:candidates',
      stage: '用神候选筛选',
      status: params.selectionFact.status === '已选定候选' ? '已计算' : '资料不足',
      inputs: {
        candidateCount: params.candidates.length,
        candidateKeys: params.candidates.map((item) => item.key),
      },
      result: {
        selectionStatus: params.selectionFact.status,
        matchedCandidateCount: params.candidates.filter((item) => item.status === '已匹配').length,
        selectedCandidateKey: params.selectionFact.selectedCandidateKey ?? '无',
      },
      dependsOnStepKeys: ['liuyao:calculation:lines', 'liuyao:calculation:hidden-spirits'],
      promptText: params.selectionFact.promptText,
      sources: params.selectionFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:god-chain',
      stage: '原忌仇神作用链',
      status: params.godChain.length ? '已计算' : '资料不足',
      inputs: { selectionStatus: params.selectionFact.status },
      result: {
        godChainFactCount: params.godChain.length,
        roles: params.godChain.map((item) => item.role),
      },
      dependsOnStepKeys: ['liuyao:calculation:candidates'],
      promptText: params.godChain.length
        ? `按所选候选五行建立${params.godChain.map((item) => item.role).join('、')}作用链`
        : '当前没有可用候选，未强定原神、忌神与仇神',
      sources: ['所选候选五行与五行生克关系', '本卦与伏神逐项五行匹配'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:counter-timing',
      stage: '反证与应期核验',
      status: '已计算',
      inputs: {
        candidateCount: params.candidates.length,
        lineFactCount: params.lineFacts.length,
      },
      result: {
        counterEvidenceCount: params.counterEvidenceFacts.length,
        timingFactCount: params.timingFacts.length,
      },
      dependsOnStepKeys: [
        'liuyao:calculation:lines',
        'liuyao:calculation:candidates',
        'liuyao:calculation:god-chain',
      ],
      promptText: `逐项核验候选限制${params.counterEvidenceFacts.length}项，并记录应期触发与边界${params.timingFacts.length}项`,
      sources: ['候选空破墓退等限制', '动爻、旬空、伏神与反吟伏吟触发条件'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        lineFactCount: params.summaryFact.lineFactCount,
        candidateCount: params.summaryFact.candidateCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
        timingFactCount: params.summaryFact.timingFactCount,
      },
      dependsOnStepKeys: [
        'liuyao:calculation:generation',
        'liuyao:calculation:lines',
        'liuyao:calculation:hidden-spirits',
        'liuyao:calculation:candidates',
        'liuyao:calculation:god-chain',
        'liuyao:calculation:counter-timing',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  generationFact: LiuyaoGenerationFact;
  randomFact: RandomTraceFact;
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  candidates: LiuyaoUsefulGodCandidate[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  structureFacts: LiuyaoHexagramStructureFact[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  counterSummaryFact: LiuyaoCounterSummaryFact;
  timingFacts: LiuyaoTimingFact[];
  timingSummaryFact: LiuyaoTimingSummaryFact;
  summaryFact: LiuyaoSummaryFact;
}): LiuyaoLimitationFact[] {
  const definitions: Array<
    Pick<LiuyaoLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'liuyao:limitation:generation-random',
      type: '起卦与随机来源边界',
      ownerFactKeys: [params.generationFact.key, params.randomFact.key],
      promptText:
        '起卦来源与随机轨迹只用于核验六个爻值如何录入、生成或重放；模拟三钱和随机重放只记录生成过程，不等同于现实投掷，也不提高预测有效性',
      sources: ['起卦方式、原始爻值、三钱记录与随机轨迹'],
    },
    {
      key: 'liuyao:limitation:lines-hidden-spirits',
      type: '逐爻与伏神资料边界',
      ownerFactKeys: [
        params.lineCoverageFact.key,
        ...params.lineFacts.map((item) => item.key),
        params.hiddenSpiritCoverageFact.key,
        ...params.hiddenSpiritFacts.map((item) => item.key),
      ],
      promptText:
        '逐爻与伏神事实只记录纳甲、六亲、六神、世应、月日、空破墓及动变条件；资料缺失时不得补造爻位或伏神，资料完整也不单独证明现实吉凶',
      sources: ['六爻覆盖、逐爻计算与伏神飞神配对事实'],
    },
    {
      key: 'liuyao:limitation:candidates-god-chain',
      type: '用神候选与五行链边界',
      ownerFactKeys: [
        params.selectionFact.key,
        ...params.candidates.map((item) => item.key),
        ...params.godChain.map((item) => item.key),
      ],
      promptText:
        '主题默认用神只是候选；实际问题语义、求测者身份与所问对象可能改变取用。原神、忌神和仇神只按候选五行建立盘内关系，不证明现实助力、阻碍或结果',
      sources: ['用神候选来源、候选匹配与五行生克作用链'],
    },
    {
      key: 'liuyao:limitation:structure-tradition',
      type: '卦内结构与传统类象边界',
      ownerFactKeys: [
        ...params.structureFacts.map((item) => item.key),
        ...params.traditionalSymbols.map((item) => item.key),
      ],
      promptText:
        '整卦六合六冲、反吟伏吟、三合、特殊卦象与六亲类象只提供盘内结构和传统事项候选；不得直接写成现实和合冲散、疾病官非、财运关系或固定应期',
      sources: ['卦内结构事实与传统六亲类象条件化映射'],
    },
    {
      key: 'liuyao:limitation:counter-timing',
      type: '反证与应期边界',
      ownerFactKeys: [
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
        params.timingSummaryFact.key,
        ...params.timingFacts.map((item) => item.key),
      ],
      promptText:
        '空亡、月破、日破、休囚死、入墓、回头克冲、化空化退等反证须与支持证据并列；应期只保留触发条件，未给期限时不得换算唯一日期或事件概率',
      sources: ['候选反证汇总、逐项应期触发与期限边界'],
    },
    {
      key: 'liuyao:limitation:high-risk',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText:
        '不得按候选、支持、反证或动爻数量生成吉凶总分与成功率；不得仅凭官鬼、白虎、螣蛇等单项证明疾病、灾祸或超自然原因，也不得替代医疗、法律、财务与安全核验',
      sources: ['六爻证据汇总与高风险解释约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
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
  const lineCoverageFact = buildLineCoverageFact(lineFacts);
  const hiddenSpiritCoverageFact = buildHiddenSpiritCoverageFact(data, hiddenSpiritFacts);
  const candidateSourceStatus: LiuyaoUsefulGodCandidate['sourceStatus'] = options.usefulGodRelative
    ? '用户指定'
    : topic === 'general'
      ? '盘面补齐'
      : '主题默认';
  const candidates = candidateSpecs(data, options).map((spec, index): LiuyaoUsefulGodCandidate => {
    const matched = references.filter((reference) =>
      spec.position
        ? reference.position === spec.position && reference.source === '本卦'
        : reference.sixRelative === spec.relative,
    );
    const constraints = matched.length
      ? Array.from(new Set(matched.flatMap((item) => item.constraints)))
      : [`${spec.relative ?? '指定爻位'}未在本卦或伏神中找到，不能硬取为主证`];
    const support = Array.from(new Set(matched.flatMap((item) => item.support)));
    return {
      key: `liuyao:candidate:${index + 1}:${spec.label}`,
      status: matched.length ? '已匹配' : '未匹配',
      sourceStatus: candidateSourceStatus,
      ...spec,
      references: matched,
      referenceKeys: matched.map((item) => item.key),
      support,
      constraints,
      promptText: matched.length
        ? `${spec.label}由${candidateSourceStatus}提出：${spec.reason}；匹配${matched.map(formatYao).join('、')}；支持${support.join('、') || '未见额外增强'}；限制${constraints.join('、') || '未见明显空破墓退'}`
        : `${spec.label}由${candidateSourceStatus}提出：${spec.reason}；${constraints.join('、')}`,
      sources: ['当前问题取用范围', '本卦与伏神六亲、爻位及五行逐项匹配'],
      limitation: CANDIDATE_FACT_LIMITATION,
    };
  });
  const selectedCandidate = candidates[0]?.references.length ? candidates[0] : null;
  const selectionFact: LiuyaoUsefulGodSelectionFact = {
    key: 'liuyao:useful-god-selection',
    status: selectedCandidate ? '已选定候选' : '缺少可用候选',
    topic,
    requestedRelative: options.usefulGodRelative ?? null,
    selectedCandidateKey: selectedCandidate?.key ?? null,
    candidateKeys: candidates.map((item) => item.key),
    promptText: selectedCandidate
      ? `本次用神取${selectedCandidate.label}；盘面匹配${selectedCandidate.references.map(formatYao).join('、')}`
      : '本次按既定取用规则检索后，本卦与伏神均未见对应用神爻，改以世应与动变主线裁定',
    sources: ['候选顺序、匹配状态与逐爻引用核验'],
    limitation: SELECTION_FACT_LIMITATION,
  };
  const usefulElement = selectedCandidate?.references[0]?.wuxing ?? '';
  const sourceElement = usefulElement ? findGeneratingElement(usefulElement) : '';
  const tabooElement = usefulElement ? findControllingElement(usefulElement) : '';
  const enemyElement = tabooElement ? findGeneratingElement(tabooElement) : '';
  const chainSpecs: Array<[LiuyaoGodRole, string, string]> = usefulElement
    ? [
        ['用神', usefulElement, '本次用神五行'],
        ['原神', sourceElement, `${sourceElement}生${usefulElement}`],
        ['忌神', tabooElement, `${tabooElement}克${usefulElement}`],
        ['仇神', enemyElement, `${enemyElement}生${tabooElement}并克${sourceElement}`],
      ]
    : [];
  const godChain = chainSpecs.map(([role, wuxing, relation]): LiuyaoGodChainItem => {
    const matched = references.filter((item) => item.wuxing === wuxing);
    return {
      key: `liuyao:god-chain:${role}`,
      role,
      status: matched.length ? '盘中有对应' : '盘中未见',
      wuxing,
      relation,
      references: matched,
      referenceKeys: matched.map((item) => item.key),
      promptText: `${role}${wuxing}：${relation}；${matched.length ? `盘中对应${matched.map(formatYao).join('、')}` : '盘中未见对应爻'}`,
      sources: ['当前选定候选五行', '五行生克公共关系', '本卦与伏神逐爻五行'],
      limitation: GOD_CHAIN_FACT_LIMITATION,
    };
  });
  const traditionalSymbols = Array.from(new Set(references.map((item) => item.sixRelative))).map(
    (relative): LiuyaoTraditionalSymbolFact => {
      const originalText = TRADITIONAL_RELATIVE_IMAGES[relative] ?? '传统类象未单列';
      return {
        key: `liuyao:traditional-symbol:${relative}`,
        status: '已映射',
        relative,
        positions: references
          .filter((item) => item.sixRelative === relative)
          .map((item) => item.position),
        originalText,
        promptText: `${originalText}，须先结合问题主题。`,
        source: '传统六亲类象表与当前六亲排布',
        sources: ['传统六亲类象表', '当前本卦与伏神六亲排布'],
        limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果',
      };
    },
  );
  const structureFacts = buildHexagramStructureFacts(data);
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
  const timingFacts: LiuyaoTimingFact[] = [];
  lineFacts
    .filter((item) => item.activity === '明动')
    .forEach((item) =>
      timingFacts.push({
        key: `liuyao:timing:changing-line:${item.position}`,
        type: '动爻触发',
        sourceStatus: '由盘面生成',
        ownerFactKeys: [item.key],
        promptText: `第${item.position}爻${item.sixRelative}${item.najia.branch}发动${item.changedYao ? `化${item.changedYao.sixRelative}${item.changedYao.branch}` : ''}`,
        sources: ['当前逐爻明动与变爻事实'],
        limitation: TIMING_FACT_LIMITATION,
      }),
    );
  if (data.voidBranches?.length) {
    timingFacts.push({
      key: 'liuyao:timing:void',
      type: '空亡填实',
      sourceStatus: '由盘面生成',
      ownerFactKeys: [
        ...lineFacts.filter((item) => item.isVoid).map((item) => item.key),
        ...hiddenSpiritFacts.filter((item) => item.isVoid).map((item) => item.key),
      ],
      promptText: `空亡${data.voidBranches.join('、')}，传统以出空、冲实或透出为应期触发`,
      sources: ['日柱旬空地支', '本卦与伏神空亡标记'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  if (hiddenSpiritFacts.length) {
    timingFacts.push({
      key: 'liuyao:timing:hidden-spirit',
      type: '伏神透出',
      sourceStatus: '由盘面生成',
      ownerFactKeys: hiddenSpiritFacts.map((item) => item.key),
      promptText: '伏神传统以透出、飞神受冲或得月日生扶为应期触发',
      sources: ['伏神与飞神配对事实', '伏神透出及得助触发口径'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  const fanfuFacts = structureFacts.filter((item) => item.kind === '反吟伏吟');
  if (fanfuFacts.length) {
    timingFacts.push({
      key: 'liuyao:timing:fanfu',
      type: '反吟伏吟节奏',
      sourceStatus: '由盘面生成',
      ownerFactKeys: fanfuFacts.map((item) => item.key),
      promptText: '反吟伏吟传统取象为反复、停滞或原地重复的节奏',
      sources: ['当前反吟伏吟结构事实'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  if (!lineFacts.some((item) => item.activity === '明动')) {
    timingFacts.push({
      key: 'liuyao:timing:static',
      type: '静卦边界',
      sourceStatus: '由盘面生成',
      ownerFactKeys: lineFacts.map((item) => item.key),
      promptText: '静卦以世应用神与月日旺衰为主要资料',
      sources: ['当前六爻动静状态'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  timingFacts.push({
    key: 'liuyao:timing:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    ownerFactKeys: [],
    promptText: '未给现实期限时，不把爻位、地支序、卦数或旬空机械换算成唯一日期',
    sources: ['盘内触发条件与现实日期分离原则'],
    limitation: TIMING_FACT_LIMITATION,
  });
  const timingConditions = timingFacts.map((item) => item.promptText);
  const timingSummaryFact: LiuyaoTimingSummaryFact = {
    key: 'liuyao:timing-summary',
    status: timingFacts.some((item) => !['静卦边界', '期限边界'].includes(item.type))
      ? '已提供触发条件'
      : '仅有边界',
    factKeys: timingFacts.map((item) => item.key),
    promptText: `应期状态：已记录${timingFacts.length}项触发与边界条件，未给期限时不换算唯一日期`,
    sources: ['逐项应期事实汇总'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const counterEvidenceFacts: LiuyaoCounterEvidenceFact[] = candidates.flatMap(
    (candidate, candidateIndex) =>
      candidate.constraints.map((detail, index) => ({
        key: `liuyao:counter:${candidateIndex + 1}:${index + 1}`,
        ownerCandidateKey: candidate.key,
        candidateLabel: candidate.label,
        status: '已触发' as const,
        detail,
        referenceKeys: candidate.referenceKeys,
        promptText: `${candidate.label}限制：${detail}`,
        sources: ['当前用神候选匹配结果', '对应本卦或伏神支持与限制字段'],
        limitation: COUNTER_FACT_LIMITATION,
      })),
  );
  const counterEvidence = Array.from(new Set(counterEvidenceFacts.map((item) => item.detail)));
  const counterSummaryFact: LiuyaoCounterSummaryFact = {
    key: 'liuyao:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `当前${counterEvidenceFacts.length}项候选限制已逐项记录，须与支持证据同时核验`
      : '当前候选未见明确空破墓退限制，但仍须核实现实风险',
    sources: ['候选 constraints 字段逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    generationFact,
    randomFact,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    candidates,
    selectionFact,
    godChain,
    traditionalSymbols,
    structureFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
  });
  const calculationSteps = buildCalculationSteps({
    generationFact,
    randomFact,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    candidates,
    selectionFact,
    godChain,
    counterEvidenceFacts,
    timingFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const limitationFacts = buildLimitationFacts({
    generationFact,
    randomFact,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    candidates,
    selectionFact,
    godChain,
    traditionalSymbols,
    structureFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const items: PromptEvidenceItem[] = candidates.map((candidate, index) => ({
    level: candidate.references.length ? (index === 0 ? '主证' : '辅证') : '限制',
    title: candidate.label,
    detail: `${candidate.promptText}；边界：${candidate.limitation}`,
    source: candidate.sources.join('、'),
    tags: [candidate.relative ?? '爻位候选', candidate.status, candidate.sourceStatus],
  }));
  items.push(
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '六爻计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: selectionFact.status === '已选定候选' ? '主证' : '反证',
      title: '用神候选选择状态',
      detail: `${selectionFact.promptText}；边界：${selectionFact.limitation}`,
      source: selectionFact.sources.join('、'),
      tags: ['用神选择', selectionFact.status, topic],
    },
    {
      level: lineCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '六爻资料覆盖状态',
      detail: `${lineCoverageFact.promptText}；边界：${lineCoverageFact.limitation}`,
      source: lineCoverageFact.sources.join('、'),
      tags: ['六爻覆盖', lineCoverageFact.status],
    },
    {
      level: lineCoverageFact.status === '完整' ? '主证' : '反证',
      title: '六爻逐爻计算事实',
      detail: `${lineFacts.map((item) => item.promptText).join('；')}；统一边界：${LINE_FACT_LIMITATION}`,
      source: '京房八宫纳甲、安世应、月日旺衰、旬空与动变规则逐爻计算',
      tags: ['逐爻事实', '纳甲', '世应', '月日', '动变'],
    },
    {
      level:
        hiddenSpiritCoverageFact.status === '字段缺失'
          ? '反证'
          : hiddenSpiritCoverageFact.status === '有伏神'
            ? '辅证'
            : '限制',
      title: '伏神资料覆盖状态',
      detail: `${hiddenSpiritCoverageFact.promptText}；边界：${hiddenSpiritCoverageFact.limitation}`,
      source: hiddenSpiritCoverageFact.sources.join('、'),
      tags: ['伏神覆盖', hiddenSpiritCoverageFact.status],
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
    ...structureFacts.map((fact): PromptEvidenceItem => ({
      level: fact.kind === '日辰三合' || fact.kind === '月建三合' ? '辅证' : '限制',
      title: `${fact.kind}结构事实`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['卦内结构', fact.kind],
    })),
    ...(godChain.length
      ? [
          {
            level: '辅证' as const,
            title: '用神原神忌神仇神五行作用链',
            detail: `${godChain.map((item) => item.promptText).join('；')}；统一边界：${GOD_CHAIN_FACT_LIMITATION}`,
            source: '当前选定候选五行、五行生克关系与逐爻五行匹配',
            tags: ['五行作用链', ...godChain.map((item) => item.role)],
          },
        ]
      : []),
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
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '候选反证覆盖状态',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: '应期',
      title: '六爻触发与应期边界',
      detail: `${timingSummaryFact.promptText}；${timingFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: Array.from(new Set(timingFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['应期', '触发条件', '不换算固定日期'],
    },
    {
      level: '辅证',
      title: `六爻证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '六爻取用与作用链解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
    },
  );
  const evidence: PromptEvidenceBundle = { title: '六爻用神作用链结构化证据', items };
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const promptText = [
    '【六爻用神作用链结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    godChain.length
      ? `作用链：${godChain.map((item) => item.promptText).join('；')}`
      : '作用链：本次未见可匹配用神爻，按世应与动变主线裁定。',
    `触发条件：${timingConditions.join('；')}`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'liuyao:evidence',
    status: '已计算',
    topic,
    monthBranch,
    dayBranch,
    candidates,
    selectedCandidate,
    godChain,
    traditionalSymbols,
    structureFacts,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    selectionFact,
    generationFact,
    generationFacts,
    randomFact,
    randomFacts,
    timingFacts,
    timingSummaryFact,
    timingConditions,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    calculationSteps,
    calculationChain,
    summaryFact,
    limitations,
    limitationFacts,
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
