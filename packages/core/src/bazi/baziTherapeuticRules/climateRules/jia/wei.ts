import type { ClimateRule } from '../../types';

export const JIA_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-jia-ding-geng',
    label: '甲日未月先丁后庚规则',
    description:
      '甲木未月有先丁后庚之说，同篇又分木盛先庚、庚盛先丁。丁庚为条件性取用，综合喜忌仍需结合日主承载与原局制化。',
    priority: 119,
    months: ['未'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金', '水'],
    policy: {
      mode: 'within-balance',
      source: {
        title: '穷通宝鉴',
        section: '三夏甲木',
        excerpt: '六月三伏生寒，丁火退气。先丁后庚，无癸亦可。',
        url: 'https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674',
      },
      effects: [
        { stem: '丁', wuxing: '火', role: '制金', targetStems: ['庚'], rank: 'primary' },
        { stem: '庚', wuxing: '金', role: '裁木', targetStems: ['甲'], rank: 'secondary' },
      ],
    },
    hint: '甲木未月，丁庚取用需结合木盛、庚盛等条件；身弱时以水木扶助为基础，丁火制金的作用另看原局',
  },
];
