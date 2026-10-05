import type { ClimateRule } from '../../types';

export const DING_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-ding-geng-jia-first',
    label: '丁日巳月甲引丁庚劈甲规则',
    description: '丁火生巳月，取甲引丁、庚劈甲；甲多时庚为先，有庚无甲而戊透时另取戊。',
    priority: 119,
    months: ['巳'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火巳月，取甲引丁、庚劈甲；甲多时庚为先',
  },
];
