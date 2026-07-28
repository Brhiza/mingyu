import type { ClimateRule } from '../../types';

export const DING_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-ding-xin-follow-wealth',
    label: '丁日酉月辛金从才规则',
    description:
      '丁火生酉月，若金气成势而辛金透出，不见庚金，又无比劫透干，传统多按弃命从才论，富而且贵，虽不科甲亦有异途。',
    months: ['酉'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredFormationWuxings: ['金'],
    requiredVisibleStems: ['辛'],
    maxCompanionVisibleCount: 0,
    minWuxingCounts: { 金: 4 },
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '土'],
    traceHints: ['取用层次:金气成势，辛金透干', '成格层次:弃命从才，富而且贵'],
    hint: '丁火酉月金势成局而辛透、不见庚且无比劫，可按从才格看',
  },
];
