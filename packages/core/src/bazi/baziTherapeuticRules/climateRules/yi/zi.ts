import type { ClimateRule } from '../../types';

export const YI_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-yi-bing-only',
    label: '乙日子月专用丙火解冻规则',
    description: '十一月乙木专用丙火解冻；癸水冻木，壬癸出干而有戊制须另核条件。',
    priority: 121,
    months: ['子'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: '乙木子月专用丙火解冻',
  },
];
