import type { ClimateRule } from '../../types';

export const YI_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-yi-bing-gui-first',
    label: '乙日亥月丙用戊次规则',
    description: '乙木生亥月，壬水司令，取丙火为用、戊土次之。',
    priority: 121,
    months: ['亥'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    hint: '乙木亥月，丙火为用，戊土次之',
  },
];
