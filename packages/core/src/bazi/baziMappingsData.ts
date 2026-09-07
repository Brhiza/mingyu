/**
 * 八字核心映射关系
 */

import type { CommanderEntry } from './baziTypes';
import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  STEM_WUXING as STEM_WUXING_BY_NAME,
  STEM_YINYANG as STEM_YINYANG_BY_NAME,
  NAYIN_MAP,
} from '../ganzhi/data';
import {
  ANHE_MAP,
  BRANCH_HIDDEN_STEMS,
  BRANCH_SANHE,
  BRANCH_SANXING,
  BRANCH_WUXING as BRANCH_WUXING_BY_NAME,
  KE_MAP,
  LIUHAI_MAP,
  LIUCHONG_MAP,
  LIUHE_MAP,
  LIUPO_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  SHENG_MAP,
  TIAN_GAN_CHONG,
  TIAN_GAN_HE,
} from '../ganzhi/relations';

type RelationMap = { [key: string]: string };
type MultiRelationMap = { [key: string]: string[] };

export { HEAVENLY_STEMS, EARTHLY_BRANCHES, ZODIACS, SIXTY_CYCLE, NAYIN_MAP };

export const BASIC_MAPPINGS: {
  HEAVENLY_STEMS: typeof HEAVENLY_STEMS;
  EARTHLY_BRANCHES: typeof EARTHLY_BRANCHES;
  SIXTY_CYCLE: readonly string[];
  STEM_WUXING: string[];
  BRANCH_WUXING: string[];
  STEM_YINYANG: string[];
  WUXING_SHENG: RelationMap;
  WUXING_KE: RelationMap;
  TIAN_GAN_WU_HE: RelationMap;
  TIAN_GAN_CHONG: RelationMap;
  DI_ZHI_LIU_HE: RelationMap;
  DI_ZHI_SAN_HE: MultiRelationMap;
  DI_ZHI_CHONG: RelationMap;
  DI_ZHI_SAN_HUI: MultiRelationMap;
  DI_ZHI_AN_HE: RelationMap;
  DI_ZHI_XING: MultiRelationMap;
  DI_ZHI_HAI: RelationMap;
  DI_ZHI_PO: RelationMap;
} = {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  SIXTY_CYCLE,
  STEM_WUXING: HEAVENLY_STEMS.map((stem) => STEM_WUXING_BY_NAME[stem]),
  BRANCH_WUXING: EARTHLY_BRANCHES.map((branch) => BRANCH_WUXING_BY_NAME[branch]),
  STEM_YINYANG: HEAVENLY_STEMS.map((stem) => STEM_YINYANG_BY_NAME[stem]),
  WUXING_SHENG: SHENG_MAP,
  WUXING_KE: KE_MAP,
  TIAN_GAN_WU_HE: Object.fromEntries(
    Object.entries(TIAN_GAN_HE).map(([stem, relation]) => [stem, relation.partner]),
  ),
  TIAN_GAN_CHONG,
  DI_ZHI_LIU_HE: LIUHE_MAP,
  DI_ZHI_SAN_HE: Object.fromEntries(
    Object.entries(BRANCH_SANHE).map(([branch, relation]) => [branch, relation.partners]),
  ),
  DI_ZHI_CHONG: LIUCHONG_MAP,
  DI_ZHI_SAN_HUI: Object.fromEntries(
    Object.values(SANHUI_GROUPS).map((members) => [members.join(''), members]),
  ),
  DI_ZHI_AN_HE: ANHE_MAP,
  DI_ZHI_XING: BRANCH_SANXING,
  DI_ZHI_HAI: LIUHAI_MAP,
  DI_ZHI_PO: LIUPO_MAP,
};

/** 兼容八字旧名，实际与公共地支藏干表为同一真相源。 */
export const HIDDEN_STEMS = BRANCH_HIDDEN_STEMS;

export const MONTH_COMMANDER: Record<string, CommanderEntry[]> = {
  寅: [
    ['戊', 7],
    ['丙', 7],
    ['甲', 16],
  ],
  卯: [
    ['甲', 10],
    ['乙', 20],
  ],
  辰: [
    ['乙', 9],
    ['癸', 3],
    ['戊', 18],
  ],
  巳: [
    ['戊', 5],
    ['庚', 9],
    ['丙', 16],
  ],
  午: [
    ['丙', 10],
    ['己', 9],
    ['丁', 11],
  ],
  未: [
    ['丁', 9],
    ['乙', 3],
    ['己', 18],
  ],
  申: [
    ['戊', 7],
    ['壬', 7],
    ['庚', 16],
  ],
  酉: [
    ['庚', 10],
    ['辛', 20],
  ],
  戌: [
    ['辛', 9],
    ['丁', 3],
    ['戊', 18],
  ],
  亥: [
    ['戊', 7],
    ['甲', 7],
    ['壬', 16],
  ],
  子: [
    ['壬', 10],
    ['癸', 20],
  ],
  丑: [
    ['癸', 9],
    ['辛', 3],
    ['己', 18],
  ],
};

export const TWELVE_STAGES_MAP: Record<string, Record<string, string>> = {
  甲: {
    亥: '长生',
    子: '沐浴',
    丑: '冠带',
    寅: '临官',
    卯: '帝旺',
    辰: '衰',
    巳: '病',
    午: '死',
    未: '墓',
    申: '绝',
    酉: '胎',
    戌: '养',
  },
  乙: {
    午: '长生',
    巳: '沐浴',
    辰: '冠带',
    卯: '临官',
    寅: '帝旺',
    丑: '衰',
    子: '病',
    亥: '死',
    戌: '墓',
    酉: '绝',
    申: '胎',
    未: '养',
  },
  丙: {
    寅: '长生',
    卯: '沐浴',
    辰: '冠带',
    巳: '临官',
    午: '帝旺',
    未: '衰',
    申: '病',
    酉: '死',
    戌: '墓',
    亥: '绝',
    子: '胎',
    丑: '养',
  },
  丁: {
    酉: '长生',
    申: '沐浴',
    未: '冠带',
    午: '临官',
    巳: '帝旺',
    辰: '衰',
    卯: '病',
    寅: '死',
    丑: '墓',
    子: '绝',
    亥: '胎',
    戌: '养',
  },
  戊: {
    寅: '长生',
    卯: '沐浴',
    辰: '冠带',
    巳: '临官',
    午: '帝旺',
    未: '衰',
    申: '病',
    酉: '死',
    戌: '墓',
    亥: '绝',
    子: '胎',
    丑: '养',
  },
  己: {
    酉: '长生',
    申: '沐浴',
    未: '冠带',
    午: '临官',
    巳: '帝旺',
    辰: '衰',
    卯: '病',
    寅: '死',
    丑: '墓',
    子: '绝',
    亥: '胎',
    戌: '养',
  },
  庚: {
    巳: '长生',
    午: '沐浴',
    未: '冠带',
    申: '临官',
    酉: '帝旺',
    戌: '衰',
    亥: '病',
    子: '死',
    丑: '墓',
    寅: '绝',
    卯: '胎',
    辰: '养',
  },
  辛: {
    子: '长生',
    亥: '沐浴',
    戌: '冠带',
    酉: '临官',
    申: '帝旺',
    未: '衰',
    午: '病',
    巳: '死',
    辰: '墓',
    卯: '绝',
    寅: '胎',
    丑: '养',
  },
  壬: {
    申: '长生',
    酉: '沐浴',
    戌: '冠带',
    亥: '临官',
    子: '帝旺',
    丑: '衰',
    寅: '病',
    卯: '死',
    辰: '墓',
    巳: '绝',
    午: '胎',
    未: '养',
  },
  癸: {
    卯: '长生',
    寅: '沐浴',
    丑: '冠带',
    子: '临官',
    亥: '帝旺',
    戌: '衰',
    酉: '病',
    申: '死',
    未: '墓',
    午: '绝',
    巳: '胎',
    辰: '养',
  },
};

/**
 * 建禄格精确映射：日干在月支为临官禄位
 * 甲禄在寅、乙禄在卯、丙禄在巳、丁禄在午、戊禄在巳、己禄在午、庚禄在申、辛禄在酉、壬禄在亥、癸禄在子
 */
export const LU_BRANCH_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TWELVE_STAGES_MAP).map(([stem, stages]) => {
    const luBranch = Object.entries(stages).find(([, stage]) => stage === '临官');
    return [stem, luBranch ? luBranch[0] : ''];
  }),
);

/**
 * 月刃格精确映射：阳干在月支为帝旺羊刃位
 * 甲刃在卯、丙戊刃在午、庚刃在酉、壬刃在子（阴干无真正羊刃）
 */
export const REN_BRANCH_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TWELVE_STAGES_MAP)
    .filter(([stem]) => ['甲', '丙', '戊', '庚', '壬'].includes(stem))
    .map(([stem, stages]) => {
      const renBranch = Object.entries(stages).find(([, stage]) => stage === '帝旺');
      return [stem, renBranch ? renBranch[0] : ''];
    }),
);

/**
 * 三合局定义（按局名→三支列表格式）
 * 与 BASIC_MAPPINGS.DI_ZHI_SAN_HE 互补：那边是每支→另两支，这边是局名→三支
 */
export const SAN_HE_MAP: Record<string, string[]> = Object.fromEntries(
  Object.values(SANHE_GROUPS).map((members) => [members.join(''), members]),
);

/**
 * 三会局定义（与 BASIC_MAPPINGS.DI_ZHI_SAN_HUI 数据一致，独立导出便于直接引用）
 */
export const SAN_HUI_MAP: Record<string, string[]> = Object.fromEntries(
  Object.values(SANHUI_GROUPS).map((members) => [members.join(''), members]),
);

/**
 * 辰戌丑未四库全
 */
export const SI_KU = ['辰', '戌', '丑', '未'];
