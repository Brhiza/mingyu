import type { ClimateRule } from '../../types';

export const DING_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-ding-geng-yi-greedy-combine',
    label: '丁日卯月庚乙俱透贪合规则',
    description:
      '丁火生卯月，若庚乙俱透，庚必输情于乙，传统多断贪合而贫，不宜仍与庚透乙藏之富贵路数同论。',
    priority: 122,
    months: ['卯'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredVisibleStems: ['庚', '乙'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    traceHints: ['破格因素:庚乙贪合', '成格层次:一贫彻骨'],
    hint: '丁火卯月庚乙俱透，多主贪合贫困',
  },
  {
    id: 'mao-month-ding-jia-geng-first',
    label: '丁日卯月先庚后甲规则',
    description: '丁火生卯月，湿乙伤丁，先庚去乙，后甲引丁。',
    priority: 118,
    months: ['卯'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    hint: '丁火卯月，先庚去乙，后甲引丁',
  },
];
