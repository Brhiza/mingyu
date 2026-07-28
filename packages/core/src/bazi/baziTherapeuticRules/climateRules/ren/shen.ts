import type { ClimateRule } from '../../types';

export const REN_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-ren-wu-ding',
    label: '壬日申月戊丁为用规则',
    description: '壬水生申月，源远转强，传统专取戊土制水，丁火为佐，不宜仍按秋水清润一概论。',
    months: ['申'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    hint: '壬水申月，专用戊土，丁火为佐',
  },
  {
    id: 'shen-month-ren-wu-ding-first',
    label: '壬日申月先戊后丁规则',
    description: '壬水生申月，源远流长，传统多以戊土制水为先、丁火为佐，不宜仍按秋水清润一概论。',
    months: ['申'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    hint: '壬水申月，先戊后丁',
  },
  {
    id: 'shen-month-ren-wu-ding-jia-all',
    label: '壬日申月戊丁甲全透极品规则',
    description: '壬水生申月，戊丁甲三者全透，较合原文"壬水生申月，三者全透，鼎甲可期"。',
    months: ['申'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['戊', '丁', '甲'],
    usefulWuxing: '土',
    favorableOrder: ['土', '火', '木'],
    traceHints: ['取用层次:戊丁甲三者全透', '成格层次:鼎甲可期'],
    hint: '壬水申月戊丁甲三者全透，鼎甲可期',
  },
];
