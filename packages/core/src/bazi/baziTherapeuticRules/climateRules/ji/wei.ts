import type { ClimateRule } from '../../types';

export const JI_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-wu-wei-month-ji-no-gui-ren-allowed',
    label: '己日夏月无癸有壬权代规则',
    description: '己土生夏月，最喜癸润；若无癸而壬透，传统亦可暂取壬水权代，不应退回普通扶抑。',
    priority: 121,
    months: ['巳', '午', '未'],
    dayMasters: ['土'],
    dayStems: ['己'],
    requiredVisibleStems: ['壬'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    traceHints: ['取用层次:壬水权代', '成格层次:可用但不大发'],
    hint: '己土夏月无癸而壬透，可暂取壬水权代',
  },
];
