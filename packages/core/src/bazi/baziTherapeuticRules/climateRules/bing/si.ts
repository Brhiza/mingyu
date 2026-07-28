import type { ClimateRule } from '../../types';

export const BING_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-bing-no-ren-use-gui',
    label: '丙日巳月无壬用癸规则',
    description: '丙火生巳月，原法专用壬水；若壬水不透而癸水透，亦可权代，但层次逊于壬水正用。',
    months: ['巳'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['癸'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:癸水权代', '成格层次:不富必贵但逊于壬水正用'],
    hint: '丙火巳月无壬透而癸透，可先取癸水权代',
  },
  {
    id: 'si-month-bing-no-ren-gui-geng',
    label: '丙日巳月无壬见庚透癸规则',
    description:
      '丙火生巳月，无壬而癸透已属权代；若再得庚金发源，传统多断不富必贵，层次高于单见癸水。',
    months: ['巳'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['癸', '庚'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:癸水权代', '成格层次:见庚透癸，不富必贵'],
    hint: '丙火巳月无壬而庚癸同透，层次可至不富必贵',
  },
];
