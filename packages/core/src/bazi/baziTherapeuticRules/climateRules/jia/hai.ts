import type { ClimateRule } from '../../types';

export const JIA_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-jia-bing-gui-first',
    label: '甲日亥月庚丁为要丙次规则',
    description: '甲木生亥月，庚金与丁火为要，丙火次之。',
    priority: 121,
    months: ['亥'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '甲木亥月，庚丁为要，丙火次之',
  },
];
