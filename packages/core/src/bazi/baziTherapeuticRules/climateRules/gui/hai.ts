import type { ClimateRule } from '../../types';

export const GUI_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-gui-bing-xin-first',
    label: '癸日亥月先丙后辛规则',
    description: '癸水生亥月，水冷金寒，传统多以丙火解冻、辛金发源，先后有序。',
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '癸水亥月，先丙后辛',
  },
  {
    id: 'hai-month-gui-bing-xin-geng-all',
    label: '癸日亥月丙辛庚全透极品规则',
    description: '癸水生亥月，丙辛庚三者全透，较合原文"癸水生亥月，三者全透，鼎甲可期"。',
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    requiredVisibleStems: ['丙', '辛', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    traceHints: ['取用层次:丙辛庚三者全透', '成格层次:鼎甲可期'],
    hint: '癸水亥月丙辛庚三者全透，鼎甲可期',
  },
];
