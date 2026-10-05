import type { BaziChartResult } from '../bazi/index.js';

import { isGanZhiPair } from '../ganzhi/validation.js';
import type { TermContextData } from './types.js';
import { getGanZhiRelationTables } from '../ganzhi/relations.js';
import { getGanZhiAttributeTables, getNayinTable } from '../ganzhi/data.js';

const NAYIN_MAP = getNayinTable();
const { STEM_WUXING } = getGanZhiAttributeTables();

const GANZHI_RELATION_TABLES = getGanZhiRelationTables();

const STEMS = new Set(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const BRANCHES = new Set(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

const PILLAR_STAGE_NAMES: Record<string, string> = {
  年柱: '早年祖荫与成长根基',
  月柱: '青年时期与事业门户',
  日柱: '中年立身与夫妻配偶',
  时柱: '晚运归宿与子女后盾',
  大运: '当前十年行运大境',
  流年: '当年岁运引发机缘',
  流月: '当月节令应期节点',
  流日: '当日具体事态交涉',
};

/**
 * 分析特定术语在当前八字排盘中的具体角色与实际作用
 */
export function getBaziTermContext(
  term: string,
  result: BaziChartResult,
  options?: {
    pillarLabel?: string;
    ganZhi?: string;
    wuxing?: string;
  },
): TermContextData | undefined {
  if (!term || !result) return undefined;
  const clean = term.replace(/[[\]【】()（）:：\s]/g, '').trim();
  const dayMaster = result.dayMaster?.gan || result.pillars?.day?.gan || '';
  const usefulGod = result.analysis?.usefulGod;
  const useful = usefulGod?.primaryUseful || usefulGod?.useful || '';
  const avoid = usefulGod?.primaryAvoid || usefulGod?.avoid || '';
  const dmStrength = result.analysis?.dayMasterStrength?.status || '';
  const pattern = result.analysis?.mingGe?.pattern || '';
  const stageDesc = options?.pillarLabel ? PILLAR_STAGE_NAMES[options.pillarLabel] : undefined;

  // 1. 日主/元男/元女
  if (['日元', '元男', '元女', '日主', '日干'].includes(clean)) {
    return {
      chartTitle: `日主自身（${dayMaster} · ${dmStrength}）`,
      roleInChart: `日干${dayMaster || '待定'}代表命主自身，全局气数为【${dmStrength || '待判'}】。论命以日主为核心，结合本盘格局、月令与取用依据解释四柱作用。`,
      dynamicTone: 'neutral',
      pillarOrPalace: '日主太极点',
      relationshipSummary: `月令：${result.monthCommander || '当令'} · 格局：${pattern || '命格'}`,
    };
  }

  // 2. 十神
  if (
    [
      '正官',
      '七杀',
      '偏官',
      '正印',
      '偏印',
      '枭神',
      '正财',
      '偏财',
      '食神',
      '伤官',
      '比肩',
      '劫财',
    ].includes(clean)
  ) {
    const canonicalName = (name: string) =>
      name === '偏官' ? '七杀' : name === '枭神' ? '偏印' : name;
    const tenGod = canonicalName(clean);
    const isUseful = usefulGod?.favorable?.some((name) => canonicalName(name) === tenGod);
    const isAvoid = usefulGod?.unfavorable?.some((name) => canonicalName(name) === tenGod);

    let roleInChart: string;
    let dynamicTone: 'lucky' | 'unlucky' | 'neutral' = 'neutral';

    if (isUseful && !isAvoid) {
      dynamicTone = 'lucky';
      const rank = usefulGod?.primaryFavorable?.some((name) => canonicalName(name) === tenGod)
        ? '主用'
        : usefulGod?.secondaryFavorable?.some((name) => canonicalName(name) === tenGod)
          ? '辅喜'
          : '喜用';
      roleInChart = `此盘【${clean}】在取用中列为${rank}，具体作用结合本盘格局与取用依据。`;
    } else if (isAvoid && !isUseful) {
      dynamicTone = 'unlucky';
      const rank = usefulGod?.primaryUnfavorable?.some((name) => canonicalName(name) === tenGod)
        ? '主忌'
        : usefulGod?.secondaryUnfavorable?.some((name) => canonicalName(name) === tenGod)
          ? '次忌'
          : '所忌';
      roleInChart = `此盘【${clean}】在取用中列为${rank}，具体作用结合本盘格局与取用依据。`;
    } else if (isUseful && isAvoid) {
      roleInChart = `此盘【${clean}】同时列于喜用与所忌，具体作用结合本盘取用依据分别判断。`;
    } else {
      roleInChart = `【${clean}】的作用需结合${options?.pillarLabel || '四柱'}的实际配置、${stageDesc || '对应宫位'}及本盘取用依据。`;
    }

    return {
      chartTitle: `八字十神定位`,
      roleInChart,
      dynamicTone,
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `日主${dmStrength || '待判'} · 主用：${useful || '待判'} · 主忌：${avoid || '待判'}`,
    };
  }

  // 3. 旺衰与格局
  if (
    clean.includes('身旺') ||
    clean.includes('身弱') ||
    clean.includes('从') ||
    clean.includes('专旺')
  ) {
    return {
      chartTitle: `日主旺衰格局`,
      roleInChart: `日干${dayMaster || '待定'}，本盘旺衰为【${dmStrength || '待判'}】，格局为【${pattern || '待判'}】；主用：${useful || '待判'}；主忌：${avoid || '待判'}。`,
      dynamicTone: 'neutral',
      pillarOrPalace: '旺衰权衡',
      relationshipSummary: `月令司权：${result.monthCommander || '未列'} · 格局：${pattern || '待判'}`,
    };
  }

  // 4. 纳音五行（海中金、炉中火等）
  if (options?.pillarLabel && options.ganZhi && NAYIN_MAP[options.ganZhi] === clean) {
    return {
      chartTitle: `柱位纳音气象`,
      roleInChart: `${options.pillarLabel}（${options.ganZhi || ''}）纳音为【${clean}】，主导${stageDesc || '该阶段'}之气象品格与环境基调。`,
      dynamicTone: 'neutral',
      pillarOrPalace: `${options.pillarLabel}纳音`,
      relationshipSummary: `干支：${options.ganZhi || ''} · 纳音：${clean}`,
    };
  }

  // 5. 神煞精确定位
  if (clean.includes('德秀') || clean === '德秀贵人') {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `德秀贵人临${options?.pillarLabel || '柱位'}。月令秀气透出，主为人清雅温厚、聪颖端方，在${stageDesc || '对应人生阶段'}多得人望与逢凶化吉之助。`,
      dynamicTone: 'lucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · 德秀贵人` : '德秀贵人',
      relationshipSummary: `月令秀气所聚，解厄化吉`,
    };
  }

  if (clean.includes('九丑') || clean === '九丑日') {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `九丑煞临${options?.pillarLabel || '日柱'}。主情感风波或婚恋多见波折纠葛，处世宜持身端正、理智沟通，防感情是非与误会。`,
      dynamicTone: 'unlucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · 九丑` : '九丑',
      relationshipSummary: `主情感波折，宜持身端正`,
    };
  }

  if (
    clean.includes('天乙') ||
    clean.includes('太极') ||
    clean.includes('天德') ||
    clean.includes('月德') ||
    clean.includes('天赦') ||
    clean.includes('福星')
  ) {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `${clean}临${options?.pillarLabel || '柱位'}。主遇困逢凶化吉，在${stageDesc || '该阶段'}多得外力相助与庇佑。`,
      dynamicTone: 'lucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `吉星护佑，遇难呈祥`,
    };
  }

  if (clean.includes('文昌') || clean.includes('学堂') || clean.includes('词馆')) {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `文星${clean}临${options?.pillarLabel || '柱位'}。主文思清敏、考运与悟性过人，利于功名著述与专业技艺立身。`,
      dynamicTone: 'lucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `学业文思，功名利器`,
    };
  }

  if (
    clean.includes('将星') ||
    clean.includes('金舆') ||
    clean.includes('国印') ||
    clean.includes('拱禄')
  ) {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `${clean}临${options?.pillarLabel || '柱位'}。主具备统御组织才能或福禄资产，利于职场晋升与掌管关键事务。`,
      dynamicTone: 'lucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `权柄资产，威严立事`,
    };
  }

  if (clean.includes('十恶大败') || clean.includes('阴差阳错')) {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `${clean}临${options?.pillarLabel || '柱位'}。主${clean.includes('阴差阳错') ? '姻缘沟通易生误会龃龉，宜加强包容沟通' : '财气聚散起伏大，理财需防盲目透支冒进'}。`,
      dynamicTone: 'unlucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: clean.includes('阴差阳错') ? '防婚恋误解' : '防财帛虚耗',
    };
  }

  if (clean.includes('孤辰') || clean.includes('寡宿') || clean.includes('孤鸾')) {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `${clean}临${options?.pillarLabel || '柱位'}。主心性清孤自守，不随流俗，宜注重感情沟通与人际融通。`,
      dynamicTone: 'unlucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `清孤自守，宜多融通`,
    };
  }

  if (
    clean.includes('劫煞') ||
    clean.includes('亡神') ||
    clean.includes('灾煞') ||
    clean.includes('元辰') ||
    clean.includes('罗网') ||
    clean.includes('天罗') ||
    clean.includes('地网')
  ) {
    return {
      chartTitle: `神煞实盘作用`,
      roleInChart: `${clean}临${options?.pillarLabel || '柱位'}。主${clean.includes('亡神') ? '谋略深沉机敏，防思虑内耗' : clean.includes('劫煞') ? '行事果断刚决，遇事需防冲动争端' : '行事需守规蹈矩，防羁绊阻滞'}。`,
      dynamicTone: 'unlucky',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `暗藏煞气，宜修身慎行`,
    };
  }

  // 6. 干支组合与单天干地支（精确区分）
  const isGanzhiPair = clean.length === 2 && isGanZhiPair(clean[0], clean[1]);
  if (isGanzhiPair) {
    return {
      chartTitle: `四柱干支气数`,
      roleInChart: `${options?.pillarLabel || '柱位'}干支【${clean}】（天干${clean[0]} · 地支${clean[1]}）。天干显露外在气象，地支承载地气根基。${stageDesc ? `在${stageDesc}阶段主导人生气象格局。` : ''}`,
      dynamicTone: 'neutral',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel}干支` : `干支${clean}`,
      relationshipSummary: `干支：${clean} · 日主：${dayMaster}`,
    };
  }

  const isSingleStem =
    STEMS.has(clean) || (clean.length === 2 && STEM_WUXING[clean[0]!] === clean[1]);
  if (isSingleStem) {
    const stemChar = clean[0];
    return {
      chartTitle: `天干实盘作用`,
      roleInChart: `天干${clean}居于${options?.pillarLabel || '柱位'}，本五行属${STEM_WUXING[stemChar]}，参与全盘天干生克化合。`,
      dynamicTone: 'neutral',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel}天干` : clean,
      relationshipSummary: `天干：${stemChar} · 日主：${dayMaster}`,
    };
  }

  const isSingleBranch =
    BRANCHES.has(clean) ||
    (clean.length === 2 && GANZHI_RELATION_TABLES.BRANCH_WUXING[clean[0]!] === clean[1]);
  if (isSingleBranch) {
    const branchChar = clean[0];
    return {
      chartTitle: `地支实盘作用`,
      roleInChart: `地支${clean}居于${options?.pillarLabel || '柱位'}，本五行属${GANZHI_RELATION_TABLES.BRANCH_WUXING[branchChar]}，承载地气根基与支藏十神，参与全盘地支刑冲合会。`,
      dynamicTone: 'neutral',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel}地支` : clean,
      relationshipSummary: `地支：${branchChar} · 日主：${dayMaster}`,
    };
  }

  return undefined;
}

/**
 * 分析特定术语在当前六爻卦盘中的具体角色与实际作用
 */
export function getLiuyaoTermContext(
  term: string,
  data: {
    originalName: string;
    changedName?: string;
    palace?: { name: string };
    worldPosition?: number;
    responsePosition?: number;
    changingPositions?: number[];
    voidBranches?: string[];
  },
  yaoInfo?: {
    position: number;
    sixGod?: string;
    sixRelative?: string;
    najia?: string;
    isWorld?: boolean;
    isResponse?: boolean;
    isChanging?: boolean;
  },
): TermContextData | undefined {
  if (!term || !data) return undefined;
  const clean = term.replace(/[[\]【】()（）:：\s]/g, '').trim();
  const hexTitle = `${data.originalName}${data.changedName && data.changedName !== data.originalName ? ` 之 ${data.changedName}` : '（静卦）'}`;

  if (clean === '世爻' || (yaoInfo?.isWorld && clean === yaoInfo.sixRelative)) {
    return {
      chartTitle: hexTitle,
      roleInChart: `世爻居第${yaoInfo?.position || '世'}爻（${yaoInfo?.sixRelative || '六亲'} · ${yaoInfo?.sixGod || '六神'}），为自身立足点与主事基石。${yaoInfo?.isChanging ? '动而化变，主事态正在生变，行事需关注变卦走向。' : '临静爻，具体作用结合日月旺衰与生克关系。'}`,
      dynamicTone: 'neutral',
      pillarOrPalace: `世爻（第${yaoInfo?.position || ''}爻）`,
      relationshipSummary: `宫属：${data.palace?.name || '本'}宫 · 状态：${yaoInfo?.isChanging ? '动爻' : '静爻'}`,
    };
  }

  if (clean === '应爻' || (yaoInfo?.isResponse && clean === yaoInfo.sixRelative)) {
    return {
      chartTitle: hexTitle,
      roleInChart: `应爻居第${yaoInfo?.position || '应'}爻（${yaoInfo?.sixRelative || '六亲'} · ${yaoInfo?.sixGod || '六神'}），代表对方与客体环境，与世爻构成主客互动关系。`,
      dynamicTone: 'neutral',
      pillarOrPalace: `应爻（第${yaoInfo?.position || ''}爻）`,
      relationshipSummary: `世应相生则和，相克则防争端`,
    };
  }

  if (clean === '旬空') {
    return {
      chartTitle: hexTitle,
      roleInChart: `卦中旬空地支为【${data.voidBranches?.join('、') || '无'}】。用神落空主事出虚妄或时机未至；凶煞落空反减凶势，待出空填实冲实之期见分晓。`,
      dynamicTone: 'neutral',
      pillarOrPalace: '旬空气数',
      relationshipSummary: `旬空支：${data.voidBranches?.join('、') || '无'}`,
    };
  }

  if (['官鬼', '父母', '兄弟', '妻财', '子孙'].includes(clean)) {
    const isWorld = yaoInfo?.isWorld;
    const isChanging = yaoInfo?.isChanging;
    return {
      chartTitle: hexTitle,
      roleInChart: `第${yaoInfo?.position || ''}爻临${clean}（${yaoInfo?.najia || ''} · ${yaoInfo?.sixGod || ''}）${isWorld ? '持世，主导当前主事心态' : ''}${isChanging ? '发动，主事态生变之引线' : ''}。`,
      dynamicTone: 'neutral',
      pillarOrPalace: yaoInfo?.position ? `第${yaoInfo.position}爻` : undefined,
      relationshipSummary: `六神：${yaoInfo?.sixGod || '六神'} · 纳甲：${yaoInfo?.najia || ''}`,
    };
  }

  if (['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'].includes(clean)) {
    const pos = yaoInfo?.position ? `第${yaoInfo.position}爻` : '本爻';
    let godDesc = '';
    let godTone: 'lucky' | 'unlucky' | 'neutral' = 'neutral';
    if (clean === '青龙') {
      godDesc = '附临吉庆木神，主喜事临门、财帛官禄进益与人际和美。';
      godTone = 'lucky';
    } else if (clean === '朱雀') {
      godDesc = '附临文书火神，利升学文书与言辞宣讲，动则防口舌是非争执。';
      godTone = 'neutral';
    } else if (clean === '勾陈') {
      godDesc = '附临土神，主田土房屋与工程事项，行事易有迟滞牵连。';
      godTone = 'neutral';
    } else if (clean === '螣蛇') {
      godDesc = '附临阴神，主虚惊怪异、梦寐疑心与暗生隐忧。';
      godTone = 'unlucky';
    } else if (clean === '白虎') {
      godDesc = '附临西方金煞，主刚勇执法威严，动则需防血光伤病与激烈争斗。';
      godTone = 'unlucky';
    } else if (clean === '玄武') {
      godDesc = '附临北方水神，主暗昧智谋机心，行事谨防盗贼欺瞒与暗箱损失。';
      godTone = 'unlucky';
    }

    return {
      chartTitle: hexTitle,
      roleInChart: `${pos}配六神【${clean}】（临${yaoInfo?.sixRelative || '六亲'} · ${yaoInfo?.najia || ''}）。${godDesc}`,
      dynamicTone: godTone,
      pillarOrPalace: pos,
      relationshipSummary: `六亲：${yaoInfo?.sixRelative || '六亲'} · 纳甲：${yaoInfo?.najia || ''}`,
    };
  }

  return undefined;
}

/**
 * 分析特定术语在当前紫微斗数命盘中的具体角色与实际作用
 */
export function getZiweiTermContext(
  term: string,
  options?: {
    palaceName?: string;
    starName?: string;
    mutagen?: string;
    brightness?: string;
  },
): TermContextData | undefined {
  if (!term) return undefined;

  if (options?.palaceName && options?.starName) {
    const mutagen = options.mutagen?.replace(/^化/, '') || '';
    const mutagenText = mutagen ? `化${mutagen}` : '';
    const brightnessText = options.brightness ? `${options.brightness}地` : '';
    const isLucky =
      mutagen === '禄' ||
      mutagen === '权' ||
      mutagen === '科' ||
      options.brightness === '庙' ||
      options.brightness === '旺';

    return {
      chartTitle: `紫微命盘星曜配置`,
      roleInChart: `${options.starName}坐落${options.palaceName}${brightnessText ? `（${brightnessText}）` : ''}${mutagenText ? `，逢${mutagenText}` : ''}。主导${options.palaceName}之运势吉凶与心性模式。`,
      dynamicTone: mutagen === '忌' ? 'unlucky' : isLucky ? 'lucky' : 'neutral',
      pillarOrPalace: `${options.palaceName} · ${options.starName}`,
      relationshipSummary: `宫位：${options.palaceName} · 四化：${mutagenText || '无'} · 庙陷：${options.brightness || '未列'}`,
    };
  }

  return undefined;
}
