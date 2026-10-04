import type { ClimateRule } from '../../types';

export const GENG_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-geng-ren-first-gui-next',
    label: '庚日午月专用壬水癸次规则',
    description: '庚金生午月，丁火旺烈，专用壬水，癸水次之。',
    priority: 122,
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '庚金午月，专用壬水，癸水次之',
  },
];
