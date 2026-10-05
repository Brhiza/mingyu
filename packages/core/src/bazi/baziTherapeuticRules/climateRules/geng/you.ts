import type { ClimateRule } from '../../types';

export const GENG_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-geng-jia-ding-first',
    label: '庚日酉月先丁次甲规则',
    description: '庚金生酉月，金旺极而刚，需丁火锻炼、甲木裁抑，方能成器。',
    priority: 120,
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金酉月，先丁次甲',
  },
  {
    id: 'you-month-geng-ding-jia',
    label: '庚日酉月丁甲丙同见规则',
    description: '庚金生酉月，丁甲透而又见丙火，原文论功名显赫。',
    priority: 123,
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丁', '甲', '丙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金酉月丁甲透且见丙，原文论功名显赫',
  },
];
