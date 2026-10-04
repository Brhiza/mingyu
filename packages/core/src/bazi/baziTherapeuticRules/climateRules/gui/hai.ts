import type { ClimateRule } from '../../types';

export const GUI_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-gui-geng-xin',
    label: '癸日亥月庚辛发源规则',
    description: '癸水生亥月，原文谓亥中甲木泄散元神，宜庚辛金发源；丁火伤金时须另核。',
    priority: 121,
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '金',
    favorableOrder: ['金'],
    hint: '癸水亥月，核对庚辛发源及丁火伤金',
  },
];
