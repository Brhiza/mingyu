import type { ClimateRule } from '../../types';

export const GENG_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-geng-ren-wu-bing-first',
    label: '庚日巳月先壬次戊丙佐规则',
    description: '庚金生巳月，先取壬水中和，次取戊土，丙火佐之。',
    priority: 122,
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '土', '火'],
    hint: '庚金巳月，先壬次戊，丙火佐之',
  },
  {
    id: 'si-month-geng-ren-wu-bing-visible',
    label: '庚日巳月壬戊丙俱全登科规则',
    description: '庚金生巳月，壬戊丙三者俱透，登科及第。',
    priority: 123,
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['壬', '戊', '丙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '土', '火'],
    traceHints: ['取用层次:壬戊丙俱透', '成格层次:登科及第'],
    hint: '庚金巳月壬戊丙俱透，登科及第',
  },
];
