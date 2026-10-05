import type { ClimateRule } from '../../types';

export const BING_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-bing-ren-first',
    label: '丙日辰月壬水为主规则',
    description: '三月丙火气渐炎升，原文以壬水为主；支成土局时才另取甲木为辅。',
    priority: 115,
    months: ['辰'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    usefulWuxing: '水',
    hint: '丙火辰月，以壬水为主；成土局再参甲木',
  },
  {
    id: 'chen-month-bing-jia-no-ren',
    label: '丙日辰月有甲无壬浊富规则',
    description:
      '丙火生辰月，传统以壬水为本、甲木为辅；若有甲而无壬，仅主劳碌浊富，不宜误判为富贵格。',
    priority: 121,
    months: ['辰'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['甲'],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '壬'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['条件事实:甲透而壬未透', '成格层次:劳碌浊富'],
    hint: '丙火辰月有甲无壬，多主劳碌浊富',
  },
];
