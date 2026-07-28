import type { ClimateRule } from '../../types';

export const GUI_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-gui-bing-xin-first',
    label: '癸日巳月先丙后辛规则',
    description: '癸水生巳月，火旺水弱，传统多以丙火调候、辛金发源，先后有序。',
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '癸水巳月，先丙后辛',
  },
  {
    id: 'si-month-gui-bing-xin-geng-all',
    label: '癸日巳月丙辛庚全透极品规则',
    description: '癸水生巳月，丙辛庚三者全透，较合原文"癸水生巳月，三者全透，鼎甲可期"。',
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    requiredVisibleStems: ['丙', '辛', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    traceHints: ['取用层次:丙辛庚三者全透', '成格层次:鼎甲可期'],
    hint: '癸水巳月丙辛庚三者全透，鼎甲可期',
  },
];
