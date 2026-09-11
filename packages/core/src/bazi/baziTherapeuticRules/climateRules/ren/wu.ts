import type { ClimateRule } from '../../types';

export const REN_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-ren-gui-geng',
    label: '壬日午月癸庚并用规则',
    description: '五月壬水，丁旺壬弱，取癸水为用、庚金为佐，辛金与癸水亦可参用。',
    priority: 118,
    months: ['午'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '壬水午月，取癸为用，庚金为佐',
  },
];
