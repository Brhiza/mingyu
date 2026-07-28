import type { ClimateRule } from '../../types';

export const JI_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-ji-gui-bing-first',
    label: '己日午月先癸后丙规则',
    description: '己土生午月，夏燥正盛，传统多以癸水润燥为先、丙火暖局为佐。',
    months: ['午'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '己土午月，先癸后丙',
  },
  {
    id: 'wu-month-ji-gui-bing-xin-all',
    label: '己日午月癸丙辛全透极品规则',
    description: '己土生午月，癸丙辛三者全透，较合原文"己土生午月，三者全透，鼎甲可期"。',
    months: ['午'],
    dayMasters: ['土'],
    dayStems: ['己'],
    requiredVisibleStems: ['癸', '丙', '辛'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '金'],
    traceHints: ['取用层次:癸丙辛三者全透', '成格层次:鼎甲可期'],
    hint: '己土午月癸丙辛三者全透，鼎甲可期',
  },
];
