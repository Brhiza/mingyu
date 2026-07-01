import type { ClimateRule } from '../../types';

export const DING_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-ding-jia-geng',
    label: '丁日丑月甲木为尊庚金佐之规则',
    description: '丁火生丑月，三冬丁火传统以甲木为尊、庚金佐之，不宜只按冬火通用规则单取木火扶身。',
    priority: 116,
    months: ['丑'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火丑月，甲木为尊，庚金佐之',
  },
];
