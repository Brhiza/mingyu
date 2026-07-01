import type { ClimateRule } from '../../types';

export const WU_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-wu-jia-bing-gui',
    label: '戊日戌月先甲后丙癸规则',
    description:
      '戊土生戌月，燥土当令，传统先用甲木疏土，次取丙火暖照、癸水润燥，不宜退回普通扶抑泛论。',
    priority: 120,
    months: ['戌'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火', '水'],
    hint: '戊土戌月，先甲疏土，次用丙火癸水',
  },
];
