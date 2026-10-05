import type { ClimateRule } from '../../types';

export const JIA_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-jia-ding-gui-first',
    label: '甲日戌月丁癸取用规则',
    description: '九月甲木独爱丁火，壬癸滋扶；原文末段专用丁癸，见戊透另论。',
    priority: 120,
    months: ['戌'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木戌月，丁火与癸水配合；木多另核庚金',
  },
];
