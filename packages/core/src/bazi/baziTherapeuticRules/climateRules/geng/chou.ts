import type { ClimateRule } from '../../types';

export const GENG_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-geng-bing-first',
    label: '庚日丑月先丁后甲规则',
    description: '庚金生丑月，湿寒交加，传统多以丁火解冻、甲木疏土为用，较冬金寒土更细。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金丑月，先丁后甲',
  },
  {
    id: 'chou-month-geng-bing-jia',
    label: '庚日丑月丙甲并用规则',
    description:
      '庚金生丑月，寒冻之极，丙火解冻为先，甲木佐之。丙甲两透，富贵可期，不宜仍只按冬金取火。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金丑月，丙火为先，甲木佐之，丙甲两透富贵',
  },
];
