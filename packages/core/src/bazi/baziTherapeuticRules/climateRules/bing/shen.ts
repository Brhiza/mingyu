import type { ClimateRule } from '../../types';

export const BING_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-bing-wu-xin-first',
    label: '丙日申月取壬映光规则',
    description: '丙火生申月，以壬水辅映光辉；壬多时取戊制水，一派辛金另作从财论。',
    priority: 120,
    months: ['申'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    usefulWuxing: '水',
    favorableOrder: ['水'],
    hint: '丙火申月，取壬映光；壬多时取戊制水',
  },
];
