import type { ClimateRule } from '../../types';

export const REN_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-ren-wu-ding',
    label: '壬日申月戊丁为用规则',
    description: '壬水生申月，原文专用戊土、丁火为佐；戊土取辰戌所藏，不取申中受病之戊。',
    priority: 120,
    months: ['申'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    hint: '壬水申月，专用戊土，丁火为佐',
  },
];
