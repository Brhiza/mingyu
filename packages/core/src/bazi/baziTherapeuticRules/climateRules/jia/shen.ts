import type { ClimateRule } from '../../types';

export const JIA_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-jia-bing-gui-first',
    label: '甲日申月丁尊庚次规则',
    description: '甲木生申月，丁火为尊、庚金次之，庚金不可少；丁火镕庚须甲木引助。',
    priority: 120,
    months: ['申'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '甲木申月，丁火为尊，庚金次之',
  },
];
