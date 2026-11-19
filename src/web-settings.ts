import { setDefaultPromptGuidanceProvider, type PromptReplyStyle } from './prompt-guidance';
import type { Method } from './schema';

const STORAGE_KEY = 'mingyu:global-rules:v1';

export type TarotDeckId =
  | 'danjie-leopard'
  | 'doubao'
  | 'pleasant-goat'
  | 'gg-bond'
  | 'sacred-milk-dragon';

export const TAROT_DECK_OPTIONS: ReadonlyArray<{
  id: TarotDeckId;
  label: string;
  desc: string;
}> = [
  { id: 'danjie-leopard', label: '蛋姐的豹（默认）', desc: '手绘奇幻豹系套牌' },
  { id: 'doubao', label: '豆包塔罗', desc: '细腻绘本插画风套牌' },
  { id: 'pleasant-goat', label: '喜羊羊与灰太狼', desc: '青青草原主题套牌' },
  { id: 'gg-bond', label: '猪猪侠', desc: '童趣奇幻冒险套牌' },
  { id: 'sacred-milk-dragon', label: '神圣奶龙', desc: '软萌圣光主题套牌' },
];

export interface GlobalRulesSettings {
  bazi: {
    yearBoundary: 'lichun' | 'lunar-new-year' | 'dongzhi';
    ziHourMode: '23:00' | 'split-zi';
    nightZiStemMode: 'next-day' | 'current-day';
    solarTermMode: 'exact-instant' | 'civil-day';
    patternMode: 'standard' | 'main-qi-first' | 'special-first';
    kongWangMode: 'day' | 'day-and-year';
    fortuneRule: 'exact-3days' | 'round-day';
    includeExtraPalaces: boolean;
    mingGongMethod: 'traditional' | 'solar-position';
    yangRenMode: 'all-stems' | 'yang-only' | 'all-stems-guandai';
    commanderMode: 'standard' | 'yuanhai';
  };
  ziwei: {
    ageDivide: 'normal' | 'birthday';
    algorithm: 'default' | 'zhongzhou' | 'beipai';
    mutagenSchool: 'default' | 'zhongzhou' | 'quanshu' | 'tianfu';
    leapMonthMode: 'split-15' | 'same' | 'next';
    plateType: 'heaven' | 'earth' | 'human';
    tianmaMode: 'year' | 'month';
    yearDivide: 'normal' | 'exact';
    horoscopeDivide: 'normal' | 'exact';
    dayDivide: 'forward' | 'current';
    includeTimeline: boolean;
  };
  qizheng: {
    mingGongMethod: 'mao-palace' | 'ascendant';
    nodeModel: 'true' | 'mean';
  };
  qimen: {
    juMethod: 'chaibu' | 'zhirun' | 'maoshan';
    centerPalace: 'kun2' | 'yang-gen8-yin-kun2';
    feipanMode: 'star-only' | 'all-fly';
  };
  liuren: {
    guiRenTable: 'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu';
  };
  jinkoujue: {
    guiRenTable: 'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu';
  };
  liuyao: {
    ziHourMode: '23:00' | '00:00';
  };
  xiaoliuren: {
    ziHourMode: '00:00' | '23:00';
    leapMonthMode: 'same' | 'next' | 'split-15';
  };
  astro: {
    houseSystem:
      | 'placidus'
      | 'whole_sign'
      | 'equal'
      | 'koch'
      | 'porphyry'
      | 'regiomontanus'
      | 'campanus'
      | 'alcabitius'
      | 'morinus'
      | 'meridian'
      | 'polich_page'
      | 'vehlow';
  };
  prompt: {
    includeClassics: boolean;
    enableContract: boolean;
    replyStyle: PromptReplyStyle;
    topTaskAnchor: boolean;
    customFramework: string;
  };
  time: {
    defaultDivinationTimeMode: 'current' | 'custom';
    defaultTimeStandard: 'beijing' | 'true-solar';
    defaultPlaceDisplayName: string;
    defaultPlaceLongitude: number;
    defaultPlaceLatitude: number;
    defaultBirthUseTrueSolar: boolean;
  };
  casting: {
    preferManualMode: 'manual' | 'auto';
    liuyaoDefaultMethod: 'coins' | 'manual' | 'yarrow' | 'time';
    meihuaDefaultMethod: 'time' | 'number' | 'character' | 'sound' | 'direction';
    jinkoujueDefaultMethod: 'time' | 'branch' | 'number' | 'random';
    tarotDefaultDrawMode: 'interactive' | 'random' | 'manual';
    tarotDeck: TarotDeckId;
    lenormandDefaultDrawMode: 'interactive' | 'random' | 'manual';
    ssgwDefaultMode: 'interactive' | 'random' | 'manual';
    kongmingDefaultMode: 'manual' | 'random';
    qimenDefaultMethod: 'zhuanpan' | 'feipan';
    xiaoliurenDefaultRule: 'common' | 'duoneng';
  };
}

export const DEFAULT_GLOBAL_RULES: GlobalRulesSettings = {
  bazi: {
    yearBoundary: 'lichun',
    ziHourMode: '23:00',
    nightZiStemMode: 'next-day',
    solarTermMode: 'exact-instant',
    patternMode: 'standard',
    kongWangMode: 'day',
    fortuneRule: 'exact-3days',
    includeExtraPalaces: true,
    mingGongMethod: 'traditional',
    yangRenMode: 'all-stems',
    commanderMode: 'standard',
  },
  ziwei: {
    ageDivide: 'normal',
    algorithm: 'default',
    mutagenSchool: 'default',
    leapMonthMode: 'split-15',
    plateType: 'heaven',
    tianmaMode: 'year',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    dayDivide: 'forward',
    includeTimeline: false,
  },
  qizheng: {
    mingGongMethod: 'mao-palace',
    nodeModel: 'true',
  },
  qimen: {
    juMethod: 'chaibu',
    centerPalace: 'kun2',
    feipanMode: 'star-only',
  },
  liuren: {
    guiRenTable: 'jia-wu-geng-chou-wei',
  },
  jinkoujue: {
    guiRenTable: 'jia-wu-geng-chou-wei',
  },
  liuyao: {
    ziHourMode: '23:00',
  },
  xiaoliuren: {
    ziHourMode: '00:00',
    leapMonthMode: 'same',
  },
  astro: {
    houseSystem: 'placidus',
  },
  prompt: {
    includeClassics: true,
    enableContract: true,
    replyStyle: 'standard',
    topTaskAnchor: true,
    customFramework: '',
  },
  time: {
    defaultDivinationTimeMode: 'current',
    defaultTimeStandard: 'beijing',
    defaultPlaceDisplayName: '北京市 东城区',
    defaultPlaceLongitude: 116.416,
    defaultPlaceLatitude: 39.928,
    defaultBirthUseTrueSolar: false,
  },
  casting: {
    preferManualMode: 'manual',
    liuyaoDefaultMethod: 'coins',
    meihuaDefaultMethod: 'time',
    jinkoujueDefaultMethod: 'time',
    tarotDefaultDrawMode: 'random',
    tarotDeck: 'danjie-leopard',
    lenormandDefaultDrawMode: 'random',
    ssgwDefaultMode: 'interactive',
    kongmingDefaultMode: 'random',
    qimenDefaultMethod: 'zhuanpan',
    xiaoliurenDefaultRule: 'common',
  },
};

type OptionItem = { value: string; label: string };
export type GlobalRuleFieldDescriptor =
  | { kind: 'select'; id: string; group: keyof GlobalRulesSettings; key: string; label: string; options: OptionItem[] }
  | { kind: 'checkbox'; id: string; group: keyof GlobalRulesSettings; key: string; label: string }
  | {
      kind: 'textarea';
      id: string;
      group: keyof GlobalRulesSettings;
      key: string;
      label: string;
      placeholder?: string;
      rows?: number;
    };

export interface GlobalRuleSectionDescriptor {
  title: string;
  desc?: string;
  fields: GlobalRuleFieldDescriptor[];
}

export const GLOBAL_RULE_SECTIONS: GlobalRuleSectionDescriptor[] = [
  {
    title: '全局历法与时间分界（早晚子时 / 换月 / 换年 / 闰月）',
    fields: [
      {
        kind: 'select', id: 'gs-bazi-ziHourMode', group: 'bazi', key: 'ziHourMode', label: '八字早晚子时换日',
        options: [
          { value: '23:00', label: '23:00 换次日日柱（主流默认）' },
          { value: 'split-zi', label: '分早晚子时（23–24点保留当日日柱）' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-nightZiStemMode', group: 'bazi', key: 'nightZiStemMode', label: '晚子时天干（五鼠遁）',
        options: [
          { value: 'next-day', label: '按次日日干起时干（默认）' },
          { value: 'current-day', label: '按当日日干起时干' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-yearBoundary', group: 'bazi', key: 'yearBoundary', label: '八字年柱换年口径',
        options: [
          { value: 'lichun', label: '立春换年（主流默认）' },
          { value: 'lunar-new-year', label: '正月初一换年' },
          { value: 'dongzhi', label: '冬至换年' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-solarTermMode', group: 'bazi', key: 'solarTermMode', label: '八字月柱节气分界',
        options: [
          { value: 'exact-instant', label: '精确交节时刻换月（默认）' },
          { value: 'civil-day', label: '交节当日整日换月（00:00起）' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-dayDivide', group: 'ziwei', key: 'dayDivide', label: '紫微晚子时日界',
        options: [
          { value: 'forward', label: '23:00 进位至次日（默认）' },
          { value: 'current', label: '保留当日（00:00 换日）' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-yearDivide', group: 'ziwei', key: 'yearDivide', label: '紫微本命年界口径',
        options: [
          { value: 'normal', label: '农历正月初一（默认）' },
          { value: 'exact', label: '立春精确时刻' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-horoscopeDivide', group: 'ziwei', key: 'horoscopeDivide', label: '紫微运限年界口径',
        options: [
          { value: 'normal', label: '农历正月初一（默认）' },
          { value: 'exact', label: '立春精确时刻' },
        ],
      },
      {
        kind: 'select', id: 'gs-liuyao-ziHourMode', group: 'liuyao', key: 'ziHourMode', label: '六爻晚子时换日',
        options: [
          { value: '23:00', label: '23:00 换日柱（默认）' },
          { value: '00:00', label: '00:00 换日柱' },
        ],
      },
      {
        kind: 'select', id: 'gs-xiaoliuren-ziHourMode', group: 'xiaoliuren', key: 'ziHourMode', label: '小六壬晚子时换日',
        options: [
          { value: '00:00', label: '00:00 换日（默认）' },
          { value: '23:00', label: '23:00 换入次日农历' },
        ],
      },
      {
        kind: 'select', id: 'gs-xiaoliuren-leapMonthMode', group: 'xiaoliuren', key: 'leapMonthMode', label: '小六壬闰月折算',
        options: [
          { value: 'same', label: '闰月沿用本月序（默认）' },
          { value: 'next', label: '闰月按下一月算' },
          { value: 'split-15', label: '十五日前按本月、后按下月' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-leapMonthMode', group: 'ziwei', key: 'leapMonthMode', label: '紫微闰月折算口径',
        options: [
          { value: 'split-15', label: '十五日前按本月、十六日起按下月（默认）' },
          { value: 'same', label: '闰月全部沿用本月月序' },
          { value: 'next', label: '闰月全部按次月处理' },
        ],
      },
    ],
  },
  {
    title: '八字流派与格局神煞口径',
    fields: [
      {
        kind: 'select', id: 'gs-bazi-patternMode', group: 'bazi', key: 'patternMode', label: '格局取法口径',
        options: [
          { value: 'standard', label: '先特殊格后普通格（默认）' },
          { value: 'main-qi-first', label: '月令本气优先' },
          { value: 'special-first', label: '外格优先' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-commanderMode', group: 'bazi', key: 'commanderMode', label: '月令人元司令分野表',
        options: [
          { value: 'standard', label: '《三命通会/滴天髓》折中表（默认）' },
          { value: 'yuanhai', label: '《渊海子平》古法表（四孟月 7/5/18）' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-yangRenMode', group: 'bazi', key: 'yangRenMode', label: '羊刃神煞查法',
        options: [
          { value: 'all-stems', label: '阴阳十干皆取帝旺刃（默认）' },
          { value: 'yang-only', label: '子平正统：五阳干有刃、阴干无刃' },
          { value: 'all-stems-guandai', label: '五阴干顺取冠带刃（辰未戌丑）' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-kongWangMode', group: 'bazi', key: 'kongWangMode', label: '旬空查法',
        options: [
          { value: 'day', label: '仅以日柱查旬空（默认）' },
          { value: 'day-and-year', label: '日柱兼查年柱旬空' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-fortuneRule', group: 'bazi', key: 'fortuneRule', label: '大运起运折算',
        options: [
          { value: 'exact-3days', label: '精确到分秒折算（默认）' },
          { value: 'round-day', label: '按整日取整折算（三日一年）' },
        ],
      },
      {
        kind: 'select', id: 'gs-bazi-mingGongMethod', group: 'bazi', key: 'mingGongMethod', label: '八字命宫推算口径',
        options: [
          { value: 'traditional', label: '卯宫安命·传统（默认）' },
          { value: 'solar-position', label: '按太阳过宫校正' },
        ],
      },
      {
        kind: 'checkbox', id: 'gs-bazi-includeExtraPalaces', group: 'bazi', key: 'includeExtraPalaces', label: '输出命宫 / 身宫 / 胎元 / 胎息',
      },
    ],
  },
  {
    title: '紫微斗数与七政四余口径',
    fields: [
      {
        kind: 'select', id: 'gs-ziwei-algorithm', group: 'ziwei', key: 'algorithm', label: '紫微安星流派',
        options: [
          { value: 'default', label: '通行《全书》版（默认）' },
          { value: 'zhongzhou', label: '中州派（王亭之安星）' },
          { value: 'beipai', label: '北派飞星精简（截空单星）' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-mutagenSchool', group: 'ziwei', key: 'mutagenSchool', label: '紫微四化口诀流派',
        options: [
          { value: 'default', label: '通行 / 飞星主流（默认）' },
          { value: 'zhongzhou', label: '中州派（庚：阳武同相）' },
          { value: 'quanshu', label: '《全书》古法（戊日科·庚同阴·壬府科）' },
          { value: 'tianfu', label: '天府化科派（庚壬天府科）' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-plateType', group: 'ziwei', key: 'plateType', label: '紫微天地人三盘',
        options: [
          { value: 'heaven', label: '天盘·命宫立极（默认）' },
          { value: 'earth', label: '地盘·身宫立极' },
          { value: 'human', label: '人盘·福德宫立极' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-tianmaMode', group: 'ziwei', key: 'tianmaMode', label: '紫微天马起法',
        options: [
          { value: 'year', label: '按生年地支起年马（默认）' },
          { value: 'month', label: '按生月地支起月马' },
        ],
      },
      {
        kind: 'select', id: 'gs-ziwei-ageDivide', group: 'ziwei', key: 'ageDivide', label: '紫微虚岁与小限分界',
        options: [
          { value: 'normal', label: '按农历新年换岁（默认）' },
          { value: 'birthday', label: '按公历出生日换岁' },
        ],
      },
      {
        kind: 'select', id: 'gs-qizheng-mingGongMethod', group: 'qizheng', key: 'mingGongMethod', label: '七政立命宫与命度',
        options: [
          { value: 'mao-palace', label: '太阳加生时顺数至卯安命（默认）' },
          { value: 'ascendant', label: '出生地地平真上升点（ASC）立命' },
        ],
      },
      {
        kind: 'select', id: 'gs-qizheng-nodeModel', group: 'qizheng', key: 'nodeModel', label: '七政罗睺/计都交点模型',
        options: [
          { value: 'true', label: '天文真月交点（默认）' },
          { value: 'mean', label: 'Moshier 平均月交点' },
        ],
      },
      {
        kind: 'checkbox', id: 'gs-ziwei-includeTimeline', group: 'ziwei', key: 'includeTimeline', label: '附带紫微十二大限与流月时间线',
      },
    ],
  },
  {
    title: '奇门 / 六壬 / 金口诀 / 占星',
    fields: [
      {
        kind: 'select', id: 'gs-qimen-juMethod', group: 'qimen', key: 'juMethod', label: '奇门定局法',
        options: [
          { value: 'chaibu', label: '拆补法（默认）' },
          { value: 'zhirun', label: '置闰法' },
          { value: 'maoshan', label: '茅山道人法' },
        ],
      },
      {
        kind: 'select', id: 'gs-qimen-centerPalace', group: 'qimen', key: 'centerPalace', label: '奇门中五寄宫',
        options: [
          { value: 'kun2', label: '一律寄坤二宫（默认）' },
          { value: 'yang-gen8-yin-kun2', label: '阳遁寄艮八、阴遁寄坤二' },
        ],
      },
      {
        kind: 'select', id: 'gs-qimen-feipanMode', group: 'qimen', key: 'feipanMode', label: '飞盘奇门排布模式',
        options: [
          { value: 'star-only', label: '星飞门转（九星飞宫、门神环转，默认）' },
          { value: 'all-fly', label: '九星八门九神全飞盘（鸣法/统宗）' },
        ],
      },
      {
        kind: 'select', id: 'gs-liuren-guiRenTable', group: 'liuren', key: 'guiRenTable', label: '大六壬贵人起例',
        options: [
          { value: 'jia-wu-geng-chou-wei', label: '甲戊庚牛羊（通行，默认）' },
          { value: 'jia-yang-wu-geng-niu', label: '甲羊戊庚牛（古本）' },
        ],
      },
      {
        kind: 'select', id: 'gs-jinkoujue-guiRenTable', group: 'jinkoujue', key: 'guiRenTable', label: '金口诀贵人起例',
        options: [
          { value: 'jia-wu-geng-chou-wei', label: '甲戊庚牛羊（通行，默认）' },
          { value: 'jia-yang-wu-geng-niu', label: '甲羊戊庚牛（古本）' },
        ],
      },
      {
        kind: 'select', id: 'gs-astro-houseSystem', group: 'astro', key: 'houseSystem', label: '西洋星盘宫位制',
        options: [
          { value: 'placidus', label: '普拉西德制（Placidus，默认）' },
          { value: 'whole_sign', label: '整宫制（Whole Sign）' },
          { value: 'equal', label: '等宫制（Equal）' },
          { value: 'koch', label: '科赫制（Koch）' },
          { value: 'porphyry', label: '波菲利制（Porphyry）' },
          { value: 'regiomontanus', label: '雷吉奥蒙塔努斯制（Regiomontanus）' },
          { value: 'campanus', label: '坎帕努斯制（Campanus）' },
          { value: 'alcabitius', label: '阿尔卡比特制（Alcabitius）' },
          { value: 'morinus', label: '莫里努斯制（Morinus）' },
          { value: 'meridian', label: '子午圈制（Meridian）' },
          { value: 'polich_page', label: '波利希-佩奇制 / 顶点制（Polich-Page）' },
          { value: 'vehlow', label: '维洛等宫制（Vehlow）' },
        ],
      },
    ],
  },
  {
    title: '通用提示词与 AI 解读规则框架',
    desc: '这些规则会直接融入排盘后生成的预设提示词中，无论是一键复制给在线 AI 还是站内直连均实时生效。',
    fields: [
      {
        kind: 'checkbox', id: 'gs-prompt-includeClassics', group: 'prompt', key: 'includeClassics', label: '默认附带古籍经典原文片段（适合深度研读，提示词会更长）',
      },
      {
        kind: 'checkbox', id: 'gs-prompt-enableContract', group: 'prompt', key: 'enableContract', label: '启用内置《解读与交付契约》（防 AI 重算盘面、防推脱打太极、要求有据直断）',
      },
      {
        kind: 'checkbox', id: 'gs-prompt-topTaskAnchor', group: 'prompt', key: 'topTaskAnchor', label: '长提示词顶部加任务锚点（防止中小模型读盘跑神或中途重算）',
      },
      {
        kind: 'select',
        id: 'gs-prompt-replyStyle',
        group: 'prompt',
        key: 'replyStyle',
        label: '默认 AI 回复结构风格',
        options: [
          { value: 'standard', label: '标准四段式（结论 → 依据 → 机会阻力 → 建议，默认）' },
          { value: 'concise', label: '精简直白（大白话直给结论与 2–3 条核心依据）' },
          { value: 'deep', label: '专业详尽（分层拆解格局、古籍原文与反证条件）' },
        ],
      },
      {
        kind: 'textarea',
        id: 'gs-prompt-customFramework',
        group: 'prompt',
        key: 'customFramework',
        label: '自定义通用规则框架（留空不追加；会附在所有预设提示词末尾）',
        placeholder: '例如：请全程用通俗大白话解释专业术语；每条判断都给出一条具体可落地的现实建议；语气平和客观，不要制造焦虑。',
        rows: 4,
      },
    ],
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeGroup<T extends Record<string, unknown>>(defaults: T, raw: unknown): T {
  if (!isPlainObject(raw)) return { ...defaults };
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const val = raw[key];
    if (typeof val === typeof defaults[key]) {
      result[key] = val;
    }
  }
  return result as T;
}

/** 从 localStorage 读取全局排盘与流派偏好设置（缺失字段自动回落主流默认）。 */
export function loadGlobalRules(): GlobalRulesSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_GLOBAL_RULES);
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return structuredClone(DEFAULT_GLOBAL_RULES);
    return {
      bazi: mergeGroup(DEFAULT_GLOBAL_RULES.bazi, parsed.bazi),
      ziwei: (() => {
        const merged = mergeGroup(DEFAULT_GLOBAL_RULES.ziwei, parsed.ziwei);
        if (isPlainObject(parsed.ziwei) && parsed.ziwei.leapMonthMode === undefined && parsed.ziwei.fixLeap === false) {
          merged.leapMonthMode = 'same';
        }
        return merged;
      })(),
      qizheng: mergeGroup(DEFAULT_GLOBAL_RULES.qizheng, parsed.qizheng),
      qimen: mergeGroup(DEFAULT_GLOBAL_RULES.qimen, parsed.qimen),
      liuren: mergeGroup(DEFAULT_GLOBAL_RULES.liuren, parsed.liuren),
      jinkoujue: mergeGroup(DEFAULT_GLOBAL_RULES.jinkoujue, parsed.jinkoujue),
      liuyao: mergeGroup(DEFAULT_GLOBAL_RULES.liuyao, parsed.liuyao),
      xiaoliuren: mergeGroup(DEFAULT_GLOBAL_RULES.xiaoliuren, parsed.xiaoliuren),
      astro: mergeGroup(DEFAULT_GLOBAL_RULES.astro, parsed.astro),
      prompt: mergeGroup(DEFAULT_GLOBAL_RULES.prompt, parsed.prompt),
      time: mergeGroup(DEFAULT_GLOBAL_RULES.time, parsed.time),
      casting: (() => {
        const merged = mergeGroup(DEFAULT_GLOBAL_RULES.casting, parsed.casting);
        if (!TAROT_DECK_OPTIONS.some((d) => d.id === merged.tarotDeck)) {
          merged.tarotDeck = 'danjie-leopard';
        }
        return merged;
      })(),
    };
  } catch {
    return structuredClone(DEFAULT_GLOBAL_RULES);
  }
}

export function saveGlobalRules(settings: GlobalRulesSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 忽略隐私模式或配额限制
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('mingyu:global-rules-changed', { detail: settings }));
  }
}

function collectDiff<T extends Record<string, unknown>>(current: T, defaults: T): Partial<T> {
  const diff: Partial<T> = {};
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    if (current[key] !== defaults[key]) {
      diff[key] = current[key];
    }
  }
  return diff;
}

const ENGINE_RULE_GROUPS = [
  'bazi',
  'ziwei',
  'qizheng',
  'qimen',
  'liuren',
  'jinkoujue',
  'liuyao',
  'xiaoliuren',
  'astro',
  'prompt',
] as const;

function countNonDefaultRules(settings: GlobalRulesSettings): number {
  let count = 0;
  for (const group of ENGINE_RULE_GROUPS) {
    count += Object.keys(collectDiff(settings[group], DEFAULT_GLOBAL_RULES[group])).length;
  }
  return count;
}

function mergeNested(target: Record<string, unknown>, key: string, additions: Record<string, unknown>): void {
  if (!Object.keys(additions).length) return;
  const existing = isPlainObject(target[key]) ? target[key] : {};
  target[key] = { ...additions, ...existing };
}

const NON_CLASSICS_METHODS: ReadonlySet<Method> = new Set([
  'random-divination',
  'chinese-name',
  'chinese-naming',
  'number-energy',
  'instant',
  'calendar',
  'bazi-reverse',
  'zhouyi',
]);

/**
 * 将用户改动过的非默认流派规则自动注入对应术数的请求载荷。
 * 默认开启附经典依据时，也会为支持典籍的方法自动附带 includeClassics: true。
 */
export function applyGlobalRulesToPayload(method: Method, payload: unknown, supportsIncludeClassics: boolean): unknown {
  if (!isPlainObject(payload)) return payload;
  const settings = loadGlobalRules();
  const needsClassicsInjection =
    supportsIncludeClassics
    && !NON_CLASSICS_METHODS.has(method)
    && (settings.prompt.includeClassics || settings.prompt.includeClassics !== DEFAULT_GLOBAL_RULES.prompt.includeClassics);
  if (countNonDefaultRules(settings) === 0 && !needsClassicsInjection) return payload;

  const next: Record<string, unknown> = { ...payload };
  let changed = false;

  if (method === 'bazi') {
    const diff = collectDiff(settings.bazi, DEFAULT_GLOBAL_RULES.bazi);
    if (Object.keys(diff).length) {
      mergeNested(next, 'rules', diff);
      changed = true;
    }
  }

  if (method === 'ziwei' || method === 'ziwei-synastry' || method === 'bazi-ziwei' || method === 'minglu') {
    const { includeTimeline: _omit, ...ziweiRuleCurrent } = settings.ziwei;
    const { includeTimeline: _omitDefault, ...ziweiRuleDefault } = DEFAULT_GLOBAL_RULES.ziwei;
    const ziweiDiff = collectDiff(ziweiRuleCurrent, ziweiRuleDefault);

    if (Object.keys(ziweiDiff).length) {
      if (method === 'ziwei') {
        mergeNested(next, 'rules', ziweiDiff);
        changed = true;
      } else if (method === 'ziwei-synastry') {
        if (isPlainObject(next.person1)) {
          const p1 = { ...next.person1 };
          mergeNested(p1, 'rules', ziweiDiff);
          next.person1 = p1;
          changed = true;
        }
        if (isPlainObject(next.person2)) {
          const p2 = { ...next.person2 };
          mergeNested(p2, 'rules', ziweiDiff);
          next.person2 = p2;
          changed = true;
        }
      } else {
        mergeNested(next, 'ziweiRules', ziweiDiff);
        changed = true;
      }
    }

    if (method === 'ziwei' && settings.ziwei.includeTimeline !== DEFAULT_GLOBAL_RULES.ziwei.includeTimeline && next.includeTimeline === undefined) {
      next.includeTimeline = settings.ziwei.includeTimeline;
      changed = true;
    }
  }

  if (method === 'instant' && (next.type === 'ziwei' || next.type === 'bazi-ziwei')) {
    if (settings.ziwei.algorithm !== DEFAULT_GLOBAL_RULES.ziwei.algorithm && next.ziweiAlgorithm === undefined) {
      next.ziweiAlgorithm = settings.ziwei.algorithm;
      changed = true;
    }
  }

  if (method === 'qizheng' || method === 'qizheng-range') {
    const diff = collectDiff(settings.qizheng, DEFAULT_GLOBAL_RULES.qizheng);
    if (Object.keys(diff).length) {
      mergeNested(next, 'options', diff);
      changed = true;
    }
  }

  if (method === 'qimen') {
    const qimenDiff = collectDiff(settings.qimen, DEFAULT_GLOBAL_RULES.qimen);
    const existingQimen = isPlainObject(next.qimen) ? next.qimen : {};
    const existingScope = typeof existingQimen.scope === 'string' ? existingQimen.scope : 'hour';
    const existingMethod = typeof existingQimen.method === 'string' ? existingQimen.method : 'zhuanpan';
    const filtered: Record<string, unknown> = { ...qimenDiff };
    if (existingScope === 'month' || existingScope === 'year') {
      delete filtered.juMethod;
    }
    if (existingMethod !== 'feipan') {
      delete filtered.feipanMode;
    }
    if (Object.keys(filtered).length) {
      mergeNested(next, 'qimen', filtered);
      changed = true;
    }
  }

  if (method === 'qimen-lifetime') {
    if (settings.qimen.juMethod === 'zhirun' && next.juMethod === undefined) {
      next.juMethod = 'zhirun';
      changed = true;
    }
  }

  if (method === 'liuren') {
    const diff = collectDiff(settings.liuren, DEFAULT_GLOBAL_RULES.liuren);
    if (Object.keys(diff).length) {
      mergeNested(next, 'liuren', diff);
      changed = true;
    }
  }

  if (method === 'jinkoujue') {
    const diff = collectDiff(settings.jinkoujue, DEFAULT_GLOBAL_RULES.jinkoujue);
    if (Object.keys(diff).length) {
      mergeNested(next, 'jinkoujue', diff);
      changed = true;
    }
  }

  if (method === 'liuyao') {
    const diff = collectDiff(settings.liuyao, DEFAULT_GLOBAL_RULES.liuyao);
    if (Object.keys(diff).length) {
      mergeNested(next, 'liuyao', diff);
      changed = true;
    }
  }

  if (method === 'xiaoliuren') {
    const diff = collectDiff(settings.xiaoliuren, DEFAULT_GLOBAL_RULES.xiaoliuren);
    if (Object.keys(diff).length) {
      mergeNested(next, 'xiaoliuren', diff);
      changed = true;
    }
  }

  if (method === 'astrolabe' || method === 'astrolabe-range' || method === 'astrolabe-synastry') {
    const diff = collectDiff(settings.astro, DEFAULT_GLOBAL_RULES.astro);
    if (Object.keys(diff).length) {
      mergeNested(next, 'options', diff);
      changed = true;
    }
  }

  if (
    supportsIncludeClassics
    && !NON_CLASSICS_METHODS.has(method)
    && (settings.prompt.includeClassics || settings.prompt.includeClassics !== DEFAULT_GLOBAL_RULES.prompt.includeClassics)
  ) {
    mergeNested(next, 'prompt', { includeClassics: settings.prompt.includeClassics });
    changed = true;
  }

  return changed ? next : payload;
}

if (typeof window !== 'undefined') {
  setDefaultPromptGuidanceProvider(() => loadGlobalRules().prompt);
}
