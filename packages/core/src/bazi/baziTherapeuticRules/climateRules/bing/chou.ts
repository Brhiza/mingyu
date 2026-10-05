import type { ClimateRule } from '../../types';

export const BING_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-bing-wu-xin-first',
    label: '丙日丑月取壬及土多取甲规则',
    description: '丙火生丑月，喜壬为用；己土司令，土多时还须甲木，原文亦有无甲而壬透之例。',
    priority: 121,
    months: ['丑'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    usefulWuxing: '水',
    favorableOrder: ['水'],
    hint: '丙火丑月，喜壬为用；土多时还须甲木',
  },
];
