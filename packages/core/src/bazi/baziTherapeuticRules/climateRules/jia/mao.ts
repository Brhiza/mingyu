import type { ClimateRule } from '../../types';

export const JIA_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-jia-geng-wu-first',
    label: '甲日卯月庚金财资规则',
    description: '二月甲木以庚金驾阳刃，须戊土财星资庚；丁火透出另按原文条件论。',
    priority: 120,
    months: ['卯'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '金',
    favorableOrder: ['金', '土'],
    hint: '甲木卯月庚金得所，须财资之；丁透另论',
  },
];
