import type { ClimateRule } from '../../types';

export const BING_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-bing-hidden-ren-gui-page',
    label: '丙日戌月壬癸藏支页监规则',
    description:
      '丙火生戌月，若壬癸仅藏支而不透，传统多断页监而已，不宜误判为甲壬富贵或甲壬癸俱无下格。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬癸藏支', '成格层次:页监而已'],
    hint: '丙火戌月壬癸藏支不透，多主页监而已',
  },
  {
    id: 'xu-month-bing-geng-wu-trap-jia-ren',
    label: '丙日戌月庚戊困木水庸才规则',
    description:
      '丙火生戌月，若甲木壬癸本可为用，却又见庚戊同透困其水木，传统多断庸才，不宜仍按甲壬并透上格直断。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['庚', '戊', '甲'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:庚戊困木水', '成格层次:庸才'],
    hint: '丙火戌月庚戊困住木水，多主庸才',
  },
  {
    id: 'xu-month-bing-hidden-jia-ren-no-geng',
    label: '丙日戌月甲藏壬透秀才规则',
    description:
      '丙火生戌月，若甲木藏支、壬水透干，且不见庚金破甲，传统多许秀才，不宜与甲壬两透之富贵层次混同。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['壬'],
    requiredHiddenStems: ['甲'],
    forbiddenVisibleStems: ['庚'],
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
    traceHints: ['取用层次:甲木藏支，壬水透干', '成格层次:可许秀才'],
    hint: '丙火戌月甲藏壬透而无庚破甲，可许秀才',
  },
  {
    id: 'xu-month-bing-jia-ren-all',
    label: '丙日戌月甲壬两透富贵规则',
    description:
      '丙火生戌月，传统必须先用甲木，次取壬水；若甲壬两透，多断富贵非凡，不宜仍按普通衰火泛论。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '壬'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:甲木为先，壬水继之', '成格层次:甲壬两透，富贵非凡'],
    hint: '丙火戌月甲壬两透，多主富贵非凡',
  },
  {
    id: 'xu-month-bing-jia-gui-no-ren',
    label: '丙日戌月有甲无壬得癸规则',
    description:
      '丙火生戌月，若甲木已透而壬水不见，得癸透干亦可权代，传统多断异路功名，不宜误提到甲壬两透之层次。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['甲', '癸'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:甲木为先，癸水权代', '成格层次:异路功名'],
    hint: '丙火戌月有甲无壬而癸透，可作异路功名',
  },
  {
    id: 'xu-month-bing-no-jia-no-ren-no-gui',
    label: '丙日戌月无甲壬癸下格规则',
    description: '丙火生戌月，若甲壬癸俱无，传统直断下格，不应仍退回普通病药提示收束。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['甲', '壬', '癸'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:甲壬癸俱无', '成格层次:下格'],
    hint: '丙火戌月无甲壬癸，可直断下格',
  },
];
