import type { ClimateRule } from '../../types';

export const WU_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-wu-gui-bing-jia',
    label: '戊日未月先癸后丙甲规则',
    description: '戊土生未月，夏燥土厚，传统先看癸水，次用丙火、甲木，不宜仍只按土旺扶抑泛论。',
    months: ['未'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '木'],
    hint: '戊土未月，先看癸水，次用丙火甲木',
  },
  {
    id: 'wei-month-wu-gui-jia-no-bing',
    label: '戊日未月有癸无丙见甲规则',
    description: '戊土生未月，有癸无丙时，若再见甲木，传统多断可许秀才，层次高于无甲者。',
    months: ['未'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['癸', '甲'],
    distinctStemGroupCounts: [
      {
        stems: ['丙', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木', '火'],
    traceHints: ['取用层次:癸水为主，甲木辅佐', '成格层次:见甲可许秀才'],
    hint: '戊土未月有癸无丙而见甲，可许秀才',
  },
  {
    id: 'wei-month-wu-gui-no-bing-no-jia',
    label: '戊日未月有癸无丙无甲规则',
    description: '戊土生未月，有癸无丙且不见甲木时，传统仅言略富，不应与见甲者同断。',
    months: ['未'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['癸'],
    forbiddenVisibleStems: ['甲'],
    distinctStemGroupCounts: [
      {
        stems: ['丙', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '木'],
    traceHints: ['取用层次:癸水独用', '成格层次:无甲略富'],
    hint: '戊土未月有癸无丙且无甲，仅主略富',
  },
];
