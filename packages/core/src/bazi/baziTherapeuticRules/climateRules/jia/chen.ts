import type { ClimateRule } from '../../types';

export const JIA_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-jia-geng-first',
    label: '甲日辰月先庚后壬规则',
    description:
      '甲木生辰月，木气渐竭，传统多先取庚金裁木成器，次取壬水滋养，不宜仍按春木一概先火。',
    months: ['辰'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    hint: '甲木辰月，先取庚金裁木成器',
  },
];
