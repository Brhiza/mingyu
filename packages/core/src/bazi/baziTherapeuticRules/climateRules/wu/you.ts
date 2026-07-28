import type { ClimateRule } from '../../types';

export const WU_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-wu-bing-gui-all',
    label: '戊日酉月丙癸两透科甲规则',
    description: '戊土生酉月，丙癸两透时传统多断科甲，不宜与单透或全无同论。',
    months: ['酉'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['丙', '癸'],
    distinctStemGroupCounts: [
      {
        stems: ['丙', '癸'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:丙癸并用', '成格层次:科甲中人'],
    hint: '戊土酉月丙癸两透，可至科甲',
  },
  {
    id: 'you-month-wu-no-bing-no-gui',
    label: '戊日酉月癸丙全无奔流规则',
    description: '戊土生酉月，若癸丙全无，传统多断奔流之客，不应仍按普通常人收束。',
    months: ['酉'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    distinctStemGroupCounts: [
      {
        stems: ['丙', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['破格因素:癸丙全无', '成格层次:奔流之客'],
    hint: '戊土酉月癸丙全无，多主奔流',
  },
];
