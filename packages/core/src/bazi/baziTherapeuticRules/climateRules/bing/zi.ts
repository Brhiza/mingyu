import type { ClimateRule } from '../../types';

export const BING_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-bing-wu-xin-first',
    label: '丙日子月壬水为尊戊土为佐规则',
    description:
      '丙火生子月，寒冬火弱，《穷通宝鉴》三冬丙火以壬水为尊、戊土制水为佐，壬戊相配方显丙火之光。',
    priority: 121,
    months: ['子'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    hint: '丙火子月，壬水为尊，戊土为佐',
  },
  {
    id: 'zi-month-bing-ren-wu-both-visible',
    label: '丙日子月壬戊齐透取用规则',
    description: '丙火生子月，壬水与戊土齐透，原文以壬水为最、戊土为佐，并明列壬戊两透。',
    priority: 126,
    months: ['子'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['壬', '戊'],
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用条件:壬戊齐透'],
    hint: '丙火子月壬戊两透，壬为最、戊为佐',
  },
];
