import type { LiuyaoData, LiuyaoHiddenSpirit, LiuyaoYaoDetail } from '../types/divination';
import { isKe, isLiuhe, isSheng } from '../ganzhi';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

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

export interface LiuyaoEvidenceAnalysis {
  topic: LiuyaoEvidenceTopic;
  monthBranch: string;
  dayBranch: string;
  candidates: LiuyaoUsefulGodCandidate[];
  selectedCandidate: LiuyaoUsefulGodCandidate | null;
  godChain: LiuyaoGodChainItem[];
  timingConditions: string[];
  counterEvidence: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const ELEMENTS = ['木', '火', '土', '金', '水'];

function branchOf(ganzhi: string) {
  return ganzhi.slice(1, 2);
}

function formatYao(reference: LiuyaoYaoReference) {
  return `${reference.source}${reference.position}爻${reference.sixRelative}${reference.branch}${reference.wuxing}`;
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
    weight: candidates.length - index,
    tags: [candidate.relative ?? '爻位候选'],
  }));
  items.push({
    level: '限制',
    title: '六爻取用与作用链解释边界',
    detail:
      '主题默认用神只是候选；实际问题语义、求测者身份与所问对象可能改变取用。不得按候选数量或支持项数量生成吉凶总分，也不得仅凭官鬼、白虎、螣蛇等单项证明疾病、灾祸或超自然原因。',
    source: '计算事实与解释结论分离原则',
    weight: 100,
  });
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
    timingConditions,
    counterEvidence,
    evidence,
    promptText,
    methodology: [
      '先由明确指定或问题主题提出用神候选，再在本卦与伏神中检索，不把候选当成已证实结论。',
      '逐爻保留世应、发动、暗动、月令、月日同支合冲、空破墓、回头生克和进退神证据。',
      '原神取生用神者，忌神取克用神者，仇神取生忌神并克原神者。',
      '只输出支持、反证、限制和触发条件，不生成吉凶总分或成功率。',
    ],
  };
}
