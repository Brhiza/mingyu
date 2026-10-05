import type { ClimateRule } from '../../types';

export const DING_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-ding-jia-geng-first',
    label: '丁日辰月先甲后庚规则',
    description: '丁火生辰月，戊土泄丁，原文先以甲木引丁制土，再看庚金；地支成木局时另以庚为先。',
    priority: 119,
    months: ['辰'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火辰月，先甲后庚；木局时另取庚先',
  },
];
