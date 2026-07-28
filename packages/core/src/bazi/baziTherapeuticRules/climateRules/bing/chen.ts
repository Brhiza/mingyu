import type { ClimateRule } from '../../types';

export const BING_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-bing-jia-no-ren',
    label: '丙日辰月有甲无壬浊富规则',
    description:
      '丙火生辰月，传统以壬水为本、甲木为辅；若有甲而无壬，仅主劳碌浊富，不宜误判为富贵格。',
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
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:甲木独辅', '成格层次:劳碌浊富'],
    hint: '丙火辰月有甲无壬，多主劳碌浊富',
  },
];
