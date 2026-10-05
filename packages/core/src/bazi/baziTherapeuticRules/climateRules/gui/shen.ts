import type { ClimateRule } from '../../types';

export const GUI_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-gui-ding-first',
    label: '癸日申月丁火制庚规则',
    description: '癸水生申月，申中庚金刚锐，原文取丁火制庚；丁透有甲为另列的条件。',
    priority: 120,
    months: ['申'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: '癸水申月取丁火制庚，见甲再核丁火作用',
  },
];
