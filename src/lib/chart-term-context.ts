import type { BaziChartResult } from 'mingyu-core/bazi';
import type { TermContextData } from '@/lib/metaphysics-terms';

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
  const useful =
    result.analysis?.usefulGod?.primaryUseful || result.analysis?.usefulGod?.useful || '';
  const avoid = result.analysis?.usefulGod?.primaryAvoid || result.analysis?.usefulGod?.avoid || '';
  const dmStrength = result.analysis?.dayMasterStrength?.status || '';
  const pattern = result.analysis?.mingGe?.pattern || '';
  const stageDesc = options?.pillarLabel ? PILLAR_STAGE_NAMES[options.pillarLabel] : undefined;

  // 1. 日主/元男/元女
  if (['日元', '元男', '元女', '日主', '日干'].includes(clean)) {
    return {
      chartTitle: `日主自身（${dayMaster} · ${dmStrength}）`,
      roleInChart: `日干${dayMaster}代表命主自身，全局气数为【${dmStrength}】。论命以日主为核心，结合月令司权与四柱生克推求平衡。`,
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
    const isUseful =
      useful.includes(clean) ||
      (clean === '正印' && dmStrength.includes('弱')) ||
      (clean === '七杀' && dmStrength.includes('旺'));
    const isAvoid =
      avoid.includes(clean) ||
      (clean === '七杀' && dmStrength.includes('弱')) ||
      (clean === '正官' && dmStrength.includes('弱'));

    let roleInChart: string;
    let dynamicTone: 'lucky' | 'unlucky' | 'neutral' = 'neutral';

    if (isUseful) {
      dynamicTone = 'lucky';
      roleInChart = `此盘【${clean}】为喜用神。日主${dmStrength}，得${clean}生助调和，主才华施展与机遇开拓之关键着力点。`;
    } else if (isAvoid) {
      dynamicTone = 'unlucky';
      roleInChart = `此盘【${clean}】气盛为忌。日主${dmStrength}，逢${clean}易增添克耗压力，行事需防是非波折，宜以印化或食制。`;
    } else {
      roleInChart = `在${options?.pillarLabel || '四柱'}中临${clean}，主导${stageDesc || '对应宫位'}之人伦机能与心性表达。`;
    }

    return {
      chartTitle: `八字十神定位`,
      roleInChart,
      dynamicTone,
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel} · ${clean}` : clean,
      relationshipSummary: `日主${dmStrength} · 喜用：${useful || '顺应'} · 忌神：${avoid || '中和'}`,
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
      roleInChart: `日干${dayMaster}经月令考量与通根比照判定为【${dmStrength}】，确立“${dmStrength.includes('旺') ? '身强任财官、喜泄克耗' : '身弱喜印比扶身生助'}”的取用原则。`,
      dynamicTone: dmStrength.includes('旺') ? 'lucky' : 'neutral',
      pillarOrPalace: '旺衰权衡',
      relationshipSummary: `月令司权：${result.monthCommander || '当令'} · 格局：${pattern}`,
    };
  }

  // 4. 纳音五行（海中金、炉中火等）
  if (
    options?.pillarLabel &&
    clean.length === 3 &&
    (clean.endsWith('金') ||
      clean.endsWith('木') ||
      clean.endsWith('水') ||
      clean.endsWith('火') ||
      clean.endsWith('土'))
  ) {
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
  const isGanzhiPair = clean.length === 2 && STEMS.has(clean[0]) && BRANCHES.has(clean[1]);
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
    STEMS.has(clean) ||
    (clean.length === 2 && clean.endsWith('木')) ||
    clean.endsWith('火') ||
    clean.endsWith('土') ||
    clean.endsWith('金') ||
    (clean.endsWith('水') && STEMS.has(clean[0]));
  if (isSingleStem) {
    const stemChar = clean[0];
    const isUseful = useful.includes(stemChar);
    const isAvoid = avoid.includes(stemChar);
    return {
      chartTitle: `天干实盘作用`,
      roleInChart: `天干${clean}居于${options?.pillarLabel || '柱位'}。主导外显才能与天时动向。${isUseful ? '为此盘喜用五行，主生扶赋能。' : isAvoid ? '气势偏盛克耗日主，需察干支制化。' : '参与全盘天干生克化合。'}`,
      dynamicTone: isUseful ? 'lucky' : isAvoid ? 'unlucky' : 'neutral',
      pillarOrPalace: options?.pillarLabel ? `${options.pillarLabel}天干` : clean,
      relationshipSummary: `天干：${stemChar} · 日主：${dayMaster}`,
    };
  }

  const isSingleBranch =
    BRANCHES.has(clean) ||
    (clean.length === 2 &&
      (clean.endsWith('水') ||
        clean.endsWith('土') ||
        clean.endsWith('木') ||
        clean.endsWith('火') ||
        clean.endsWith('金')) &&
      BRANCHES.has(clean[0]));
  if (isSingleBranch) {
    const branchChar = clean[0];
    const isUseful = useful.includes(branchChar);
    const isAvoid = avoid.includes(branchChar);
    return {
      chartTitle: `地支实盘作用`,
      roleInChart: `地支${clean}居于${options?.pillarLabel || '柱位'}。承载地气根基与支藏十神。${isUseful ? '地支生旺得地，为命局有力支柱。' : isAvoid ? '地支见克耗刑冲，需防暗生波折。' : '参与全盘地支刑冲合会。'}`,
      dynamicTone: isUseful ? 'lucky' : isAvoid ? 'unlucky' : 'neutral',
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
      roleInChart: `世爻居第${yaoInfo?.position || '世'}爻（${yaoInfo?.sixRelative || '六亲'} · ${yaoInfo?.sixGod || '六神'}），为自身立足点与主事基石。${yaoInfo?.isChanging ? '动而化变，主事态正在生变，行事需关注变卦走向。' : '临静爻，根基稳重。'}`,
      dynamicTone: 'lucky',
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
      dynamicTone: isWorld ? 'lucky' : 'neutral',
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
    const mutagenText = options.mutagen ? `化${options.mutagen.replace('化', '')}` : '';
    const brightnessText = options.brightness ? `${options.brightness}地` : '';
    const isLucky =
      options.mutagen === '化禄' ||
      options.mutagen === '化权' ||
      options.mutagen === '化科' ||
      options.brightness === '庙' ||
      options.brightness === '旺';

    return {
      chartTitle: `紫微命盘星曜配置`,
      roleInChart: `${options.starName}坐落${options.palaceName}${brightnessText ? `（${brightnessText}）` : ''}${mutagenText ? `，逢${mutagenText}` : ''}。主导${options.palaceName}之运势吉凶与心性模式。`,
      dynamicTone: isLucky ? 'lucky' : options.mutagen === '化忌' ? 'unlucky' : 'neutral',
      pillarOrPalace: `${options.palaceName} · ${options.starName}`,
      relationshipSummary: `宫位：${options.palaceName} · 四化：${options.mutagen || '无'} · 庙陷：${options.brightness || '平'}`,
    };
  }

  return undefined;
}
