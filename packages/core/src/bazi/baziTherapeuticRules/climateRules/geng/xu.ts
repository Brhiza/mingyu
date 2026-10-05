import type { ClimateRule } from '../../types';

export const GENG_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-geng-jia-ren',
    label: '庚日戌月甲先壬后规则',
    description: '庚金生戌月，戊土司令，甲木疏厚土为先，壬水洗金为后。',
    priority: 120,
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    hint: '庚金戌月，甲先疏土，壬后洗金',
  },
];
