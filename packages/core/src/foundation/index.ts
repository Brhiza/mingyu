/**
 * @file 命语公共地基工具箱
 * @description 统一导出干支、五行、方位与通用神煞能力，供核心包、API 和 MCP 复用。
 */

import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  SIXTY_CYCLE,
  CHANGSHENG_ORDER,
} from '../ganzhi/data';
import { describeGanZhi, getBranchRelations, getStemRelations } from '../ganzhi';
import { WUXING, analyzeWuxing } from '../wuxing';
import { BAGUA, TWENTY_FOUR_MOUNTAINS } from '../direction';
import { listShensha } from '../shensha';

export interface FoundationCapabilities {
  version: string;
  singleSourceModules: string[];
  constants: {
    heavenlyStems: string[];
    earthlyBranches: string[];
    zodiacs: string[];
    sixtyCycle: string[];
    changshengOrder: string[];
    wuxing: string[];
    bagua: string[];
    twentyFourMountains: string[];
  };
  commonShensha: { id: string; name: string; scope: string }[];
}

/** 获取可复用底层能力目录。 */
export function getFoundationCapabilities(): FoundationCapabilities {
  return {
    version: '1.0.0',
    singleSourceModules: ['ganzhi', 'wuxing', 'direction', 'shensha'],
    constants: {
      heavenlyStems: [...HEAVENLY_STEMS],
      earthlyBranches: [...EARTHLY_BRANCHES],
      zodiacs: [...ZODIACS],
      sixtyCycle: [...SIXTY_CYCLE],
      changshengOrder: [...CHANGSHENG_ORDER],
      wuxing: [...WUXING],
      bagua: [...BAGUA],
      twentyFourMountains: [...TWENTY_FOUR_MOUNTAINS],
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
