/**
 * @file 命语公共地基工具箱
 * @description 统一导出干支、五行、方位与通用神煞能力，供核心包、API 和 MCP 复用。
 */

import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  SIX_XUN_HEADS,
  CHANGSHENG_ORDER,
} from '../ganzhi/data';
import { describeGanZhi, getBranchRelations, getStemRelations } from '../ganzhi';
import { WUXING, analyzeWuxing } from '../wuxing';
import { BAGUA, TWENTY_FOUR_MOUNTAINS } from '../direction';
import { listShensha } from '../shensha';
import { CHINA_DST_YEARS, SHICHEN_PERIODS } from '../calendar';

export interface FoundationCapabilities {
  version: string;
  singleSourceModules: string[];
  evidenceOutputs: {
    ganzhi: string[];
    wuxing: string[];
  };
  constants: {
    heavenlyStems: string[];
    earthlyBranches: string[];
    zodiacs: string[];
    sixtyCycle: string[];
    sixXunHeads: string[];
    changshengOrder: string[];
    wuxing: string[];
    bagua: string[];
    twentyFourMountains: string[];
    shichenPeriods: Array<{
      index: number;
      branch: string;
      name: string;
      range: string;
      hour: number;
    }>;
    chinaDstYears: number[];
  };
  commonShensha: { id: string; name: string; scope: string }[];
}

/** 获取可复用底层能力目录。 */
export function getFoundationCapabilities(): FoundationCapabilities {
  return {
    version: '1.0.0',
    singleSourceModules: ['calendar', 'ganzhi', 'wuxing', 'direction', 'shensha'],
    evidenceOutputs: {
      ganzhi: ['稳定键', '计算链', '来源事实', '证据汇总', '解释限制', '可复制证据文本'],
      wuxing: [
        '稳定键',
        '逐项五行与藏干贡献',
        '计算链',
        '并列最高最低项',
        '证据汇总',
        '解释限制',
        '可复制证据文本',
      ],
    },
    constants: {
      heavenlyStems: [...HEAVENLY_STEMS],
      earthlyBranches: [...EARTHLY_BRANCHES],
      zodiacs: [...ZODIACS],
      sixtyCycle: [...SIXTY_CYCLE],
      sixXunHeads: [...SIX_XUN_HEADS],
      changshengOrder: [...CHANGSHENG_ORDER],
      wuxing: [...WUXING],
      bagua: [...BAGUA],
      twentyFourMountains: [...TWENTY_FOUR_MOUNTAINS],
      shichenPeriods: SHICHEN_PERIODS.map((period) => ({ ...period })),
      chinaDstYears: [...CHINA_DST_YEARS],
    },
    commonShensha: listShensha('common').map(({ id, name, scope }) => ({ id, name, scope })),
  };
}

export const foundation = {
  getFoundationCapabilities,
  describeGanZhi,
  getStemRelations,
  getBranchRelations,
  analyzeWuxing,
};

export { describeGanZhi, getStemRelations, getBranchRelations } from '../ganzhi';
export { analyzeWuxing } from '../wuxing';
