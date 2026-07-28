import type { ClimateRule } from '../../types';

export const BING_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-bing-wu-xin-first',
    label: '丙日申月先壬后辛规则',
    description: '丙火生申月，金旺火衰，传统多以壬水通根、辛金发源，先后有序。',
    months: ['申'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '丙火申月，先壬后辛',
  },
  {
    id: 'shen-month-bing-wu-xin-geng-all',
    label: '丙日申月壬辛庚全透极品规则',
    description: '丙火生申月，壬辛庚三者全透，较合原文"丙火生申月，三者全透，鼎甲可期"。',
    months: ['申'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['壬', '辛', '庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:壬辛庚三者全透', '成格层次:鼎甲可期'],
    hint: '丙火申月壬辛庚三者全透，鼎甲可期',
  },
];
