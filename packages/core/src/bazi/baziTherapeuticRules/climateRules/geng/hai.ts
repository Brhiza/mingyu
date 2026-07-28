import type { ClimateRule } from '../../types';

export const GENG_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-geng-bing-jia-first',
    label: '庚日亥月先丁后甲规则',
    description: '庚金生亥月，水冷金寒，传统多以丁火为先、甲木为佐，暖局锻链。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金亥月，先丁后甲',
  },
  {
    id: 'hai-month-geng-bing-jia',
    label: '庚日亥月丙甲并用规则',
    description:
      '庚金生亥月，寒金喜暖，丙火为先，甲木佐之。丙甲两透，富贵可期，不宜仍按冬金只取火概之。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金亥月，丙暖为先，甲木佐之，丙甲两透富贵',
  },
];
