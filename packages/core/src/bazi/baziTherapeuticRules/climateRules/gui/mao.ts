import type { ClimateRule } from '../../types';

export const GUI_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-gui-geng-first',
    label: '癸日卯月庚辛为先规则',
    description:
      '癸水生卯月，木旺泄水，传统常先取庚金发源，辛金次之，不宜只按一般身弱扶抑或泛取火土。',
    months: ['卯'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '癸水卯月，先取庚辛发源护身',
  },
];
