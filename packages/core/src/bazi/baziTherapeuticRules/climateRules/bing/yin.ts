import type { ClimateRule } from '../../types';

export const BING_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-bing-no-ren-use-gui',
    label: '丙日寅月无壬用癸规则',
    description:
      '丙火生寅月，以壬水为尊；若壬水不透而癸透，亦可权代，但层次仅略富贵，不能与壬水同论。',
    months: ['寅'],
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
    traceHints: ['取用层次:癸水权代', '成格层次:略富贵'],
    hint: '丙火寅月无壬而癸透，可先取癸水权代',
  },
  {
    id: 'yin-month-bing-double-geng-no-xin',
    label: '丙日寅月双庚无辛清贵规则',
    description: '丙火生寅月，若庚金双透而不杂辛，传统多断清贵，不宜仍与庚辛混杂同论。',
    months: ['寅'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    minVisibleStemCounts: { 庚: 2 },
    maxVisibleStemCounts: { 庚: 2 },
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:壬水为尊，庚金并透', '成格层次:双庚无辛，定主清贵'],
    hint: '丙火寅月双庚无辛，可上清贵',
  },
  {
    id: 'yin-month-bing-geng-xin-mixed',
    label: '丙日寅月庚辛混杂常人规则',
    description: '丙火生寅月，若庚辛并透而相混，传统多断常人，不宜仍与双庚无辛之清贵格同论。',
    months: ['寅'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['破格因素:庚辛混杂', '成格层次:常人'],
    hint: '丙火寅月庚辛并透，多主常人',
  },
];
